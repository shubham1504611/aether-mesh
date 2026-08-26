import { 
  InferenceRequest, 
  InferenceResponse, 
  EdgeNode, 
  RoutingDecision 
} from '../../types/index.js';
import { PowerOfTwoRouter } from '../router/p2c-pewma.js';
import { HyParViewMesh } from '../gossip/hyparview-mesh.js';
import { DistributedStorageEngine } from '../storage/database.js';

export class InferenceEngine {
  private router: PowerOfTwoRouter;
  private mesh: HyParViewMesh;
  private storage: DistributedStorageEngine;

  private modelPricing: Record<string, { promptPerM: number; completionPerM: number }> = {
    'gemini-3.7-flash-edge': { promptPerM: 0.075, completionPerM: 0.30 },
    'deepseek-r1-distill-q8': { promptPerM: 0.15, completionPerM: 0.60 },
    'llama-3.3-70b-instruct': { promptPerM: 0.20, completionPerM: 0.80 },
    'claude-3.5-haiku-edge': { promptPerM: 0.25, completionPerM: 1.00 },
  };

  constructor(router: PowerOfTwoRouter, mesh: HyParViewMesh, storage: DistributedStorageEngine) {
    this.router = router;
    this.mesh = mesh;
    this.storage = storage;
  }

  private hashPrompt(prompt: string, model: string): string {
    let hash = 0;
    const str = `${model}::${prompt.trim()}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `phash_${Math.abs(hash)}`;
  }

  public async dispatchInference(
    request: InferenceRequest,
    preferredRegion?: any
  ): Promise<InferenceResponse> {
    const startTime = Date.now();
    const promptHash = this.hashPrompt(request.prompt, request.model || 'gemini-3.7-flash-edge');

    // 1. Check Semantic Prompt Cache
    const cached = this.storage.getCachedInference(promptHash);
    if (cached) {
      return {
        ...cached,
        requestId: `req_cache_${Date.now()}`,
        durationMs: 4.2,
        cached: true,
      };
    }

    // 2. Select Route via P2C + PEWMA
    const nodes = this.mesh.getNodes();
    const decision = this.router.selectRoute(nodes, preferredRegion);
    const selectedNode = this.mesh.getNode(decision.selectedNodeId)!;

    // 3. Simulate High-Throughput Edge Model Execution
    const maxTokens = request.maxTokens || 128;
    const completion = this.generateSyntheticCompletion(request.prompt, request.model || 'gemini-3.7-flash-edge');
    const tokenCount = Math.min(maxTokens, Math.floor(completion.split(' ').length * 1.3) + 15);

    // Compute execution duration based on node's PEWMA latency + token generation rate
    const tokenGenTimeMs = (tokenCount / (selectedNode.capacityTokensPerSec / 100)) * 10;
    const durationMs = Number((selectedNode.pewmaLatencyMs + tokenGenTimeMs + Math.random() * 5).toFixed(1));

    // Pricing calculation in micro-USD
    const pricing = this.modelPricing[request.model] || this.modelPricing['gemini-3.7-flash-edge'];
    const costMicroUSD = Number((((request.prompt.length / 4) * pricing.promptPerM + tokenCount * pricing.completionPerM) / 1000).toFixed(4));

    const response: InferenceResponse = {
      requestId: decision.requestId,
      completion,
      routedNode: selectedNode,
      routingDecision: decision,
      tokensGenerated: tokenCount,
      durationMs,
      cached: false,
      costMicroUSD,
    };

    // 4. Update CRDT Session State & Increment Distributed Token Counters
    if (request.sessionId) {
      const crdtStore = this.mesh.getCrdtStore(selectedNode.id);
      if (crdtStore) {
        crdtStore.appendContext(request.sessionId, `User: ${request.prompt.substring(0, 100)}`);
        crdtStore.appendContext(request.sessionId, `Assistant (${selectedNode.region}): ${completion.substring(0, 100)}`);
        crdtStore.incrementCounters(request.sessionId, tokenCount, 1);
        
        const updatedSession = crdtStore.getSession(request.sessionId);
        if (updatedSession) {
          this.storage.saveSession(updatedSession);
        }
      }
    }

    // 5. Store in L1 Semantic Cache
    this.storage.cacheInference(promptHash, response);

    return response;
  }

  private generateSyntheticCompletion(prompt: string, model: string): string {
    const templates = [
      `[Model: ${model}] Successfully analyzed multi-region execution parameters. Dispatched optimized vector payload with zero anomalous latency. Context state successfully converged under Delta-CRDT Strong Eventual Consistency.`,
      `[Model: ${model}] Executed distributed agent task. Synthesized reasoning steps with sub-millisecond P2C path allocation. All tool execution locks verified and synchronized across global edge mesh.`,
      `[Model: ${model}] Inference pipeline verified. Processed telemetry input through adaptive PEWMA filter. Generated response satisfies deterministic zero-loss invariants across all active partitions.`
    ];

    const idx = Math.abs(prompt.length) % templates.length;
    return `${templates[idx]} Processed prompt (${prompt.length} chars) with peak memory efficiency.`;
  }
}
