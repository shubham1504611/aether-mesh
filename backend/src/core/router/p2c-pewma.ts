import { EdgeNode, PewmaState, RoutingDecision, LatencyObservation, RegionId } from '../../types/index.js';

export class PewmaEstimator {
  private states: Map<string, PewmaState> = new Map();
  private readonly defaultAlpha: number = 0.25; // Base smoothing factor
  private readonly beta: number = 0.15;        // Variance smoothing factor
  private readonly minVariance: number = 1.0;  // Variance floor to prevent division by zero

  constructor(initialNodes?: EdgeNode[]) {
    if (initialNodes) {
      for (const node of initialNodes) {
        this.initNodeState(node.id, node.pewmaLatencyMs || 25.0);
      }
    }
  }

  public initNodeState(nodeId: string, initialLatencyMs: number = 25.0): void {
    this.states.set(nodeId, {
      mean: initialLatencyMs,
      variance: 25.0,
      standardDeviation: 5.0,
      alpha: this.defaultAlpha,
      beta: this.beta,
      lastObservation: initialLatencyMs,
      sampleCount: 1,
    });
  }

  public updateObservation(obs: LatencyObservation): PewmaState {
    let state = this.states.get(obs.nodeId);
    if (!state) {
      this.initNodeState(obs.nodeId, obs.rttMs);
      state = this.states.get(obs.nodeId)!;
    }

    const x = obs.rttMs;
    const prevMean = state.mean;
    const prevVar = Math.max(state.variance, this.minVariance);

    // Probability Density Calculation (Gaussian kernel)
    const deviation = x - prevMean;
    const zScoreSq = (deviation * deviation) / (2 * prevVar);
    // Probabilistic weighting factor: transient outliers have low probability, so alpha_t decreases
    const probWeight = Math.exp(-Math.min(zScoreSq, 20)); // Clamped to avoid underflow
    const dynamicAlpha = Math.max(0.01, Math.min(0.95, this.defaultAlpha * probWeight + (1 - probWeight) * 0.05));

    // Update dynamic mean
    const newMean = (1 - dynamicAlpha) * prevMean + dynamicAlpha * x;

    // Update variance
    const diffToNewMean = x - newMean;
    const newVar = (1 - this.beta) * prevVar + this.beta * (diffToNewMean * diffToNewMean);

    state.mean = Number(newMean.toFixed(2));
    state.variance = Number(newVar.toFixed(2));
    state.standardDeviation = Number(Math.sqrt(newVar).toFixed(2));
    state.alpha = Number(dynamicAlpha.toFixed(4));
    state.lastObservation = x;
    state.sampleCount += 1;

    this.states.set(obs.nodeId, state);
    return state;
  }

  public getEstimatedLatency(nodeId: string): number {
    const state = this.states.get(nodeId);
    if (!state) return 50.0;
    return state.mean;
  }

  public getState(nodeId: string): PewmaState | undefined {
    return this.states.get(nodeId);
  }

  public getAllStates(): Record<string, PewmaState> {
    const result: Record<string, PewmaState> = {};
    for (const [id, st] of this.states.entries()) {
      result[id] = st;
    }
    return result;
  }
}

export class PowerOfTwoRouter {
  private pewma: PewmaEstimator;

  constructor(pewmaEstimator: PewmaEstimator) {
    this.pewma = pewmaEstimator;
  }

  /**
   * Evaluates Power of Two Choices (P2C) over active nodes using PEWMA + Queue Depth scoring.
   * Time complexity: O(1) decision time.
   */
  public selectRoute(
    nodes: EdgeNode[],
    preferredRegion?: RegionId,
    requestId: string = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  ): RoutingDecision {
    const startTimeMicros = process.hrtime.bigint();

    // Filter available nodes (healthy or degraded)
    const eligibleNodes = nodes.filter(n => n.status === 'healthy' || n.status === 'degraded');
    
    if (eligibleNodes.length === 0) {
      throw new Error('No available edge nodes in cluster topology');
    }

    if (eligibleNodes.length === 1) {
      const single = eligibleNodes[0];
      const lat = this.pewma.getEstimatedLatency(single.id);
      const endTimeMicros = process.hrtime.bigint();
      return {
        requestId,
        selectedNodeId: single.id,
        candidateA: single.id,
        candidateB: single.id,
        candidateALatencyPewma: lat,
        candidateBLatencyPewma: lat,
        decisionTimeMicros: Number(endTimeMicros - startTimeMicros) / 1000,
        spillover: false,
        targetRegion: single.region,
      };
    }

    // Pick two random distinct candidates
    const idxA = Math.floor(Math.random() * eligibleNodes.length);
    let idxB = Math.floor(Math.random() * (eligibleNodes.length - 1));
    if (idxB >= idxA) idxB++;

    const candA = eligibleNodes[idxA];
    const candB = eligibleNodes[idxB];

    const latA = this.pewma.getEstimatedLatency(candA.id);
    const latB = this.pewma.getEstimatedLatency(candB.id);

    // Compute composite load score: PEWMA latency * (1 + 0.2 * QueueDepth) * HealthMultiplier
    const scoreA = this.computeScore(candA, latA, preferredRegion);
    const scoreB = this.computeScore(candB, latB, preferredRegion);

    const winner = scoreA <= scoreB ? candA : candB;
    const isSpillover = preferredRegion !== undefined && winner.region !== preferredRegion;

    const endTimeMicros = process.hrtime.bigint();
    const decisionTimeMicros = Number(endTimeMicros - startTimeMicros) / 1000;

    return {
      requestId,
      selectedNodeId: winner.id,
      candidateA: candA.id,
      candidateB: candB.id,
      candidateALatencyPewma: latA,
      candidateBLatencyPewma: latB,
      decisionTimeMicros: Number(decisionTimeMicros.toFixed(3)),
      spillover: isSpillover,
      targetRegion: winner.region,
    };
  }

  private computeScore(node: EdgeNode, pewmaLatency: number, preferredRegion?: RegionId): number {
    let score = pewmaLatency * (1 + 0.15 * node.currentQueueDepth);
    
    // Status penalty
    if (node.status === 'degraded') {
      score *= 1.8;
    }

    // Regional locality preference bonus (reduces score by 15% if in local region)
    if (preferredRegion && node.region === preferredRegion) {
      score *= 0.85;
    }

    return score;
  }
}
