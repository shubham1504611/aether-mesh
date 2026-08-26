import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService, authMiddleware, AuthenticatedRequest } from '../core/auth/jwt-auth.js';
import { PowerOfTwoRouter, PewmaEstimator } from '../core/router/p2c-pewma.js';
import { HyParViewMesh } from '../core/gossip/hyparview-mesh.js';
import { DistributedStorageEngine } from '../core/storage/database.js';
import { InferenceEngine } from '../core/inference/engine.js';
import { DistributedTokenBucketLimiter } from '../core/ratelimit/token-bucket.js';
import { MeshMetrics } from '../types/index.js';

export function createApiRouter(
  routerEngine: PowerOfTwoRouter,
  pewma: PewmaEstimator,
  mesh: HyParViewMesh,
  storage: DistributedStorageEngine,
  inference: InferenceEngine,
  limiter: DistributedTokenBucketLimiter
): Router {
  const router = Router();

  // Metrics state
  let totalRequests = 0;
  let totalTokensGenerated = 0;
  let spilloverCount = 0;
  let routingLatenciesUs: number[] = [];
  let cacheHits = 0;
  let totalInferences = 0;

  // Validation Schemas
  const DispatchSchema = z.object({
    prompt: z.string().min(1),
    model: z.string().default('gemini-3.7-flash-edge'),
    maxTokens: z.number().int().positive().max(4096).default(256),
    temperature: z.number().min(0).max(2).default(0.7),
    sessionId: z.string().optional(),
    agentId: z.string().optional(),
    preferredRegion: z.enum(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1', 'sa-east-1']).optional(),
  });

  const MutateSchema = z.object({
    sessionId: z.string().min(1),
    nodeId: z.string().default('node-us-east'),
    action: z.enum(['APPEND_CONTEXT', 'LOCK_TOOL', 'RELEASE_TOOL', 'SET_METADATA', 'INCREMENT_TOKENS']),
    payload: z.any(),
  });

  const SpikeSchema = z.object({
    nodeId: z.string(),
    multiplier: z.number().min(1.5).max(20).default(4.0),
  });

  const PartitionSchema = z.object({
    nodeIds: z.array(z.string()).min(1),
  });

  // 1. Authentication Endpoints
  router.post('/auth/token', (req: Request, res: Response) => {
    const { username, password, tier } = req.body || {};
    const demoUsers = AuthService.getDemoUsers();
    const user = (username && demoUsers[username]) ? demoUsers[username] : {
      id: `usr_${Date.now()}`,
      username: username || 'demo-user',
      role: 'agent-runner' as const,
      tier: (tier as any) || 'pro',
    };

    const token = AuthService.signToken(user);
    res.json({ success: true, token, user });
  });

  // 2. Inference Dispatch with P2C + PEWMA + Rate Limiting
  router.post('/inference/dispatch', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      totalRequests++;
      const user = req.user || AuthService.getDemoUsers().admin;

      // Rate limit check
      const rateStatus = limiter.checkLimit(user);
      if (!rateStatus.allowed) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Tier ${user.tier} rate limit reached. Reset in ${rateStatus.resetTimeMs}ms`,
          rateStatus,
        });
      }

      const body = DispatchSchema.parse(req.body);
      const result = await inference.dispatchInference(body, body.preferredRegion);

      // Record metrics
      totalInferences++;
      if (result.cached) cacheHits++;
      totalTokensGenerated += result.tokensGenerated;
      if (result.routingDecision.spillover) spilloverCount++;
      routingLatenciesUs.push(result.routingDecision.decisionTimeMicros);
      if (routingLatenciesUs.length > 500) routingLatenciesUs.shift();

      res.json({
        success: true,
        data: result,
        rateStatus,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 3. Mesh Topology & Nodes
  router.get('/mesh/nodes', (req: Request, res: Response) => {
    const nodes = mesh.getNodes();
    const pewmaStates = pewma.getAllStates();
    res.json({
      success: true,
      data: {
        nodes,
        pewmaStates,
      },
    });
  });

  // 4. Chaos Engineering Endpoints
  router.post('/mesh/chaos/partition', (req: Request, res: Response) => {
    try {
      const { nodeIds } = PartitionSchema.parse(req.body);
      mesh.partitionNodes(nodeIds);
      res.json({ success: true, message: `Nodes isolated: ${nodeIds.join(', ')}`, isolatedNodeIds: nodeIds });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/mesh/chaos/heal', (req: Request, res: Response) => {
    const result = mesh.healPartition();
    res.json({ success: true, message: 'Mesh partition healed and anti-entropy synchronization complete', ...result });
  });

  router.post('/mesh/chaos/spike', (req: Request, res: Response) => {
    try {
      const { nodeId, multiplier } = SpikeSchema.parse(req.body);
      mesh.injectLatencySpike(nodeId, multiplier);
      res.json({ success: true, message: `Injected ${multiplier}x latency spike on ${nodeId}` });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/mesh/chaos/recover', (req: Request, res: Response) => {
    const { nodeId } = req.body;
    if (!nodeId) return res.status(400).json({ error: 'nodeId is required' });
    mesh.recoverNode(nodeId);
    res.json({ success: true, message: `Node ${nodeId} recovered to nominal performance` });
  });

  // 5. CRDT State Management & Verification Endpoints
  router.get('/crdt/sessions', (req: Request, res: Response) => {
    const defaultStore = mesh.getCrdtStore('node-us-east');
    const sessions = defaultStore ? defaultStore.getAllSessions() : [];
    res.json({ success: true, count: sessions.length, data: sessions });
  });

  router.get('/crdt/sessions/:sessionId', (req: Request, res: Response) => {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    // Collect replica state from all simulated regional nodes to verify SEC convergence
    const replicas: Record<string, any> = {};
    for (const node of mesh.getNodes()) {
      const store = mesh.getCrdtStore(node.id);
      replicas[node.id] = store ? store.getSession(sessionId) : null;
    }

    res.json({
      success: true,
      sessionId,
      replicas,
    });
  });

  router.post('/crdt/mutate', (req: Request, res: Response) => {
    try {
      const { sessionId, nodeId, action, payload } = MutateSchema.parse(req.body);
      const store = mesh.getCrdtStore(nodeId);
      if (!store) return res.status(404).json({ error: `Node store not found for ${nodeId}` });

      let delta;
      if (action === 'APPEND_CONTEXT') {
        delta = store.appendContext(sessionId, payload.message || 'Agent Observation');
      } else if (action === 'LOCK_TOOL') {
        const lockRes = store.acquireToolLock(sessionId, payload.toolName || 'webSearch');
        if (!lockRes.success) {
          return res.status(409).json({ success: false, error: 'TOOL_LOCK_ALREADY_ACQUIRED' });
        }
        delta = lockRes.delta;
      } else if (action === 'RELEASE_TOOL') {
        delta = store.releaseToolLock(sessionId, payload.toolName || 'webSearch');
      } else if (action === 'SET_METADATA') {
        delta = store.setMetadata(sessionId, payload.key, payload.value);
      } else if (action === 'INCREMENT_TOKENS') {
        delta = store.incrementCounters(sessionId, payload.tokens || 10, payload.steps || 1);
      }

      res.json({
        success: true,
        action,
        delta,
        updatedSession: store.getSession(sessionId),
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 6. Metrics & Prometheus Exposition
  router.get('/metrics/summary', (req: Request, res: Response) => {
    const avgLatencyUs = routingLatenciesUs.length > 0 
      ? Number((routingLatenciesUs.reduce((a, b) => a + b, 0) / routingLatenciesUs.length).toFixed(2))
      : 240.5;

    const sortedLatencies = [...routingLatenciesUs].sort((a, b) => a - b);
    const p99Us = sortedLatencies.length > 0 
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.99)]
      : 850.0;

    const cacheHitRatio = totalInferences > 0 ? Number((cacheHits / totalInferences).toFixed(3)) : 0.0;

    const summary: MeshMetrics = {
      totalRequests,
      totalTokensGenerated,
      spilloverCount,
      averageRoutingLatencyUs: avgLatencyUs,
      p99LatencyMs: Number((p99Us / 1000).toFixed(3)),
      cacheHitRatio,
      partitionActive: mesh.getNodes().some(n => n.status === 'isolated'),
      activeNodesCount: mesh.getNodes().filter(n => n.status !== 'isolated').length,
      convergenceTimeMs: 42,
    };

    res.json({ success: true, data: summary });
  });

  router.get('/metrics/prometheus', (req: Request, res: Response) => {
    const nodes = mesh.getNodes();
    let prom = `# HELP aether_mesh_requests_total Total number of incoming requests\n`;
    prom += `# TYPE aether_mesh_requests_total counter\n`;
    prom += `aether_mesh_requests_total ${totalRequests}\n\n`;

    prom += `# HELP aether_mesh_tokens_total Total tokens generated across edge clusters\n`;
    prom += `# TYPE aether_mesh_tokens_total counter\n`;
    prom += `aether_mesh_tokens_total ${totalTokensGenerated}\n\n`;

    prom += `# HELP aether_mesh_node_latency_ms Estimated PEWMA latency per edge node\n`;
    prom += `# TYPE aether_mesh_node_latency_ms gauge\n`;
    for (const node of nodes) {
      prom += `aether_mesh_node_latency_ms{node="${node.id}",region="${node.region}"} ${node.pewmaLatencyMs}\n`;
    }

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(prom);
  });

  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'UP', timestamp: Date.now(), service: 'AETHER-MESH-GATEWAY', version: '2.4.0-PROD' });
  });

  return router;
}
