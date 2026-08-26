export type RegionId = 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'ap-south-1' | 'sa-east-1';

export type NodeStatus = 'healthy' | 'degraded' | 'unreachable' | 'isolated';

export interface EdgeNode {
  id: string;
  region: RegionId;
  name: string;
  endpoint: string;
  status: NodeStatus;
  capacityTokensPerSec: number;
  activeConnections: number;
  currentQueueDepth: number;
  pewmaLatencyMs: number;
  lastHeartbeat: number;
  version: number;
}

export interface PewmaState {
  mean: number;
  variance: number;
  standardDeviation: number;
  alpha: number;
  beta: number;
  lastObservation: number;
  sampleCount: number;
}

export interface RoutingDecision {
  requestId: string;
  selectedNodeId: string;
  candidateA: string;
  candidateB: string;
  candidateALatencyPewma: number;
  candidateBLatencyPewma: number;
  decisionTimeMicros: number;
  spillover: boolean;
  targetRegion: RegionId;
}

export interface InferenceResponse {
  requestId: string;
  completion: string;
  routedNode: EdgeNode;
  routingDecision: RoutingDecision;
  tokensGenerated: number;
  durationMs: number;
  cached: boolean;
  costMicroUSD: number;
}

export interface AgentSessionState {
  sessionId: string;
  agentId: string;
  contextWindow: string[];
  toolLocks: Record<string, string>;
  counters: {
    totalTokens: number;
    stepCount: number;
  };
  metadata: Record<string, string>;
  vectorClock: Record<string, number>;
  updatedAt: number;
}

export interface MeshMetrics {
  totalRequests: number;
  totalTokensGenerated: number;
  spilloverCount: number;
  averageRoutingLatencyUs: number;
  p99LatencyMs: number;
  cacheHitRatio: number;
  partitionActive: boolean;
  activeNodesCount: number;
  convergenceTimeMs: number;
}
