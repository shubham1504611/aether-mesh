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

export interface LatencyObservation {
  nodeId: string;
  rttMs: number;
  timestamp: number;
  statusCode: number;
}

// CRDT Types
export type VectorClock = Record<string, number>;

export interface LWWRegister<T> {
  value: T;
  timestamp: number;
  nodeId: string;
}

export interface ORSetElement<T> {
  element: T;
  tag: string;
  timestamp: number;
}

export interface ORSetDelta<T> {
  additions: ORSetElement<T>[];
  removals: string[]; // tag IDs
}

export interface AgentSessionState {
  sessionId: string;
  agentId: string;
  contextWindow: string[];
  toolLocks: Record<string, string>; // toolName -> lockHolderNodeId
  counters: {
    totalTokens: number;
    stepCount: number;
  };
  metadata: Record<string, string>;
  vectorClock: VectorClock;
  updatedAt: number;
}

export interface CrdtDelta {
  sessionId: string;
  sourceNodeId: string;
  vectorClock: VectorClock;
  deltaType: 'CONTEXT_APPEND' | 'TOOL_LOCK' | 'TOOL_RELEASE' | 'COUNTER_INC' | 'METADATA_SET' | 'STATE_JOIN';
  payload: any;
  timestamp: number;
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

export interface InferenceRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  sessionId?: string;
  agentId?: string;
  stream?: boolean;
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

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'agent-runner' | 'observer';
  tier: 'free' | 'pro' | 'enterprise';
}
