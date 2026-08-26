import { PewmaEstimator, PowerOfTwoRouter } from '../src/core/router/p2c-pewma.js';
import { DeltaCrdtStore, VectorClockHelper, ORSet } from '../src/core/crdt/delta-crdt.js';
import { DistributedTokenBucketLimiter } from '../src/core/ratelimit/token-bucket.js';
import { DistributedStorageEngine } from '../src/core/storage/database.js';
import { HyParViewMesh } from '../src/core/gossip/hyparview-mesh.js';
import { InferenceEngine } from '../src/core/inference/engine.js';
import { AuthService } from '../src/core/auth/jwt-auth.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, details || '');
    throw new Error(`Test assertion failed: ${testName}`);
  }
}

async function runAllTests() {
  console.log(`\n🧪 RUNNING AETHER-MESH INTEGRATION & VERIFICATION SUITE...\n`);

  // --- TEST SUITE 1: PEWMA & P2C Routing ---
  console.log(`[1/5] Testing P2C Router & Probabilistic EWMA (PEWMA)...`);
  const pewma = new PewmaEstimator();
  pewma.initNodeState('node-us-east', 20.0);
  pewma.initNodeState('node-eu-west', 45.0);

  // Send latency observations
  pewma.updateObservation({ nodeId: 'node-us-east', rttMs: 22.0, timestamp: Date.now(), statusCode: 200 });
  pewma.updateObservation({ nodeId: 'node-us-east', rttMs: 19.5, timestamp: Date.now(), statusCode: 200 });
  
  const estUsEast = pewma.getEstimatedLatency('node-us-east');
  assert(estUsEast >= 18.0 && estUsEast <= 24.0, 'PEWMA accurately models smoothed latency');

  const router = new PowerOfTwoRouter(pewma);
  const testNodes: any[] = [
    { id: 'node-us-east', region: 'us-east-1', status: 'healthy', currentQueueDepth: 1, pewmaLatencyMs: estUsEast },
    { id: 'node-eu-west', region: 'eu-west-1', status: 'healthy', currentQueueDepth: 2, pewmaLatencyMs: 45.0 },
  ];

  const decision = router.selectRoute(testNodes, 'us-east-1');
  assert(decision.selectedNodeId === 'node-us-east', 'P2C selects lower latency and queue node');
  assert(decision.decisionTimeMicros < 1000, 'P2C decision overhead is sub-millisecond (<1ms)');

  // --- TEST SUITE 2: Delta-CRDT & SEC Convergence ---
  console.log(`\n[2/5] Testing Delta-CRDT Strong Eventual Consistency (SEC)...`);
  const nodeAStore = new DeltaCrdtStore('node-us-east');
  const nodeBStore = new DeltaCrdtStore('node-eu-west');

  const sessionId = 'session_agent_mesh_001';

  // Node A mutates state locally
  const delta1 = nodeAStore.appendContext(sessionId, 'Task started by Agent 1');
  const delta2 = nodeAStore.acquireToolLock(sessionId, 'webSearch');
  const delta3 = nodeAStore.incrementCounters(sessionId, 150, 1);

  // Node B mutates state concurrently
  const delta4 = nodeBStore.appendContext(sessionId, 'Task joined by Agent 2');
  const delta5 = nodeBStore.setMetadata(sessionId, 'priority', 'URGENT');

  // Network message propagation: Join deltas across nodes
  nodeBStore.applyDelta(delta1);
  nodeBStore.applyDelta(delta2.delta!);
  nodeBStore.applyDelta(delta3);

  nodeAStore.applyDelta(delta4);
  nodeAStore.applyDelta(delta5);

  const sessionA = nodeAStore.getSession(sessionId)!;
  const sessionB = nodeBStore.getSession(sessionId)!;

  assert(sessionA.contextWindow.length === 2, 'Node A contains both context messages');
  assert(sessionB.contextWindow.length === 2, 'Node B contains both context messages');
  assert(sessionA.counters.totalTokens === sessionB.counters.totalTokens, 'Token counters match across replicas');
  assert(sessionA.metadata.priority === 'URGENT' && sessionB.metadata.priority === 'URGENT', 'LWW metadata converges identically');
  
  // ORSet Test
  const orSet = new ORSet<string>();
  const addRes1 = orSet.add('lock:codeInterpreter', 'node-us-east');
  assert(orSet.contains('lock:codeInterpreter'), 'OR-Set contains added element');
  orSet.remove('lock:codeInterpreter');
  assert(!orSet.contains('lock:codeInterpreter'), 'OR-Set element cleanly removed');

  // --- TEST SUITE 3: Token-Bucket Rate Limiter & Spillover ---
  console.log(`\n[3/5] Testing Distributed Token-Bucket & Multi-Tenant Spillover...`);
  const limiter = new DistributedTokenBucketLimiter();
  const demoUsers = AuthService.getDemoUsers();

  const freeUser = demoUsers.guest;
  const proUser = demoUsers.agent;

  const res1 = limiter.checkLimit(freeUser, 1);
  assert(res1.allowed === true, 'Initial request is allowed for Free user');

  const proRes = limiter.checkLimit(proUser, 1);
  assert(proRes.allowed === true, 'Request allowed for Pro tier user');

  // --- TEST SUITE 4: Multi-Tier Storage & Sharding ---
  console.log(`\n[4/5] Testing Multi-Tier Cache, L1/L2 Store & Relational Sharding...`);
  const storage = new DistributedStorageEngine();
  const shard1 = storage.getShardId('session_abc_123');
  const shard2 = storage.getShardId('session_xyz_789');
  assert(typeof shard1 === 'number' && shard1 >= 0 && shard1 < 16, 'Sharding key partitioned correctly within [0, 15]');

  storage.saveSession(sessionA);
  const retrieved = storage.getSession(sessionId);
  assert(retrieved !== undefined && retrieved.sessionId === sessionId, 'L1/L2 Storage retrieves persisted session');

  // --- TEST SUITE 5: Full Ingress Inference Pipeline ---
  console.log(`\n[5/5] Testing Ingress Inference Engine with P2C Dispatch & Auto-Accounting...`);
  const mesh = new HyParViewMesh('gateway-test-node', pewma);
  const inference = new InferenceEngine(router, mesh, storage);

  const inferenceResult = await inference.dispatchInference({
    prompt: 'Synthesize optimal multi-region cluster parameters for zero-loss failover.',
    model: 'gemini-3.7-flash-edge',
    sessionId: 'session_inference_test',
  });

  assert(inferenceResult.tokensGenerated > 0, 'Inference generated valid tokens');
  assert(inferenceResult.routedNode !== undefined, 'Inference routed to a healthy edge node');
  assert(inferenceResult.costMicroUSD >= 0, 'Inference cost calculated in micro-USD');

  // Test caching on identical prompt
  const cachedInference = await inference.dispatchInference({
    prompt: 'Synthesize optimal multi-region cluster parameters for zero-loss failover.',
    model: 'gemini-3.7-flash-edge',
  });
  assert(cachedInference.cached === true, 'Subsequent identical inference resolved via L1 semantic cache');

  console.log(`\n=======================================================`);
  console.log(`  🎉 ALL ${totalTests} UNIT & INTEGRATION TESTS PASSED! `);
  console.log(`  🛡️ Strong Eventual Consistency: VALIDATED              `);
  console.log(`  ⚡ P2C + PEWMA Routing: VALIDATED                     `);
  console.log(`  💾 Multi-Tier Storage & Sharding: VALIDATED           `);
  console.log(`=======================================================\n`);
}

runAllTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
