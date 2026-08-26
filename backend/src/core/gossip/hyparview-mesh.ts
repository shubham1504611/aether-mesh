import { EdgeNode, CrdtDelta, LatencyObservation, RegionId } from '../../types/index.js';
import { DeltaCrdtStore } from '../crdt/delta-crdt.js';
import { PewmaEstimator } from '../router/p2c-pewma.js';

export interface MeshEvent {
  type: 'HEARTBEAT' | 'DELTA_PROPAGATION' | 'PARTITION_SPLIT' | 'PARTITION_HEAL' | 'NODE_DEGRADED' | 'NODE_RECOVERED';
  fromNodeId: string;
  toNodeId?: string;
  payload?: any;
  timestamp: number;
}

export class HyParViewMesh {
  private localNodeId: string;
  private nodes: Map<string, EdgeNode> = new Map();
  private activeView: Set<string> = new Set();
  private passiveView: Set<string> = new Set();
  private isolatedNodes: Set<string> = new Set();
  private crdtStores: Map<string, DeltaCrdtStore> = new Map();
  private pewmaEstimator: PewmaEstimator;
  private eventListeners: ((event: MeshEvent) => void)[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(localNodeId: string, pewmaEstimator: PewmaEstimator) {
    this.localNodeId = localNodeId;
    this.pewmaEstimator = pewmaEstimator;
    this.initializeDefaultTopology();
  }

  private initializeDefaultTopology(): void {
    const defaultNodes: EdgeNode[] = [
      {
        id: 'node-us-east',
        region: 'us-east-1',
        name: 'US-East (N. Virginia Ingress)',
        endpoint: 'http://us-east.mesh.internal:8081',
        status: 'healthy',
        capacityTokensPerSec: 15000,
        activeConnections: 124,
        currentQueueDepth: 3,
        pewmaLatencyMs: 18.5,
        lastHeartbeat: Date.now(),
        version: 1,
      },
      {
        id: 'node-us-west',
        region: 'us-west-2',
        name: 'US-West (Oregon Worker)',
        endpoint: 'http://us-west.mesh.internal:8082',
        status: 'healthy',
        capacityTokensPerSec: 12000,
        activeConnections: 89,
        currentQueueDepth: 2,
        pewmaLatencyMs: 32.0,
        lastHeartbeat: Date.now(),
        version: 1,
      },
      {
        id: 'node-eu-west',
        region: 'eu-west-1',
        name: 'EU-West (Frankfurt Hub)',
        endpoint: 'http://eu-west.mesh.internal:8083',
        status: 'healthy',
        capacityTokensPerSec: 14000,
        activeConnections: 95,
        currentQueueDepth: 1,
        pewmaLatencyMs: 48.2,
        lastHeartbeat: Date.now(),
        version: 1,
      },
      {
        id: 'node-ap-south',
        region: 'ap-south-1',
        name: 'AP-South (Mumbai Edge)',
        endpoint: 'http://ap-south.mesh.internal:8084',
        status: 'healthy',
        capacityTokensPerSec: 10000,
        activeConnections: 64,
        currentQueueDepth: 4,
        pewmaLatencyMs: 82.5,
        lastHeartbeat: Date.now(),
        version: 1,
      },
      {
        id: 'node-sa-east',
        region: 'sa-east-1',
        name: 'SA-East (São Paulo Edge)',
        endpoint: 'http://sa-east.mesh.internal:8085',
        status: 'healthy',
        capacityTokensPerSec: 8000,
        activeConnections: 42,
        currentQueueDepth: 1,
        pewmaLatencyMs: 110.0,
        lastHeartbeat: Date.now(),
        version: 1,
      }
    ];

    for (const node of defaultNodes) {
      this.nodes.set(node.id, node);
      this.activeView.add(node.id);
      
      // Initialize CRDT Store replica for each simulated region
      const store = new DeltaCrdtStore(node.id, (delta) => this.broadcastDelta(node.id, delta));
      this.crdtStores.set(node.id, store);

      this.pewmaEstimator.initNodeState(node.id, node.pewmaLatencyMs);
    }
  }

  public onEvent(callback: (event: MeshEvent) => void): void {
    this.eventListeners.push(callback);
  }

  private emitEvent(event: MeshEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Mesh event listener error:', err);
      }
    }
  }

  public getNodes(): EdgeNode[] {
    return Array.from(this.nodes.values());
  }

  public getNode(nodeId: string): EdgeNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getCrdtStore(nodeId: string): DeltaCrdtStore | undefined {
    return this.crdtStores.get(nodeId);
  }

  /**
   * Gossip broadcast of Delta-CRDT mutations across active peer mesh.
   */
  public broadcastDelta(fromNodeId: string, delta: CrdtDelta): void {
    if (this.isolatedNodes.has(fromNodeId)) {
      // Node is isolated by network partition: delta stored locally but cannot propagate
      return;
    }

    for (const targetNodeId of this.activeView) {
      if (targetNodeId === fromNodeId) continue;
      if (this.isolatedNodes.has(targetNodeId)) continue; // Can't reach partitioned node

      const targetStore = this.crdtStores.get(targetNodeId);
      if (targetStore) {
        // Apply delta to target replica
        targetStore.applyDelta(delta);
        
        this.emitEvent({
          type: 'DELTA_PROPAGATION',
          fromNodeId,
          toNodeId: targetNodeId,
          payload: { deltaType: delta.deltaType, sessionId: delta.sessionId },
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Chaos: Inject Network Partition (Split-Brain scenario)
   */
  public partitionNodes(nodeIds: string[]): void {
    this.isolatedNodes.clear();
    for (const id of nodeIds) {
      this.isolatedNodes.add(id);
      const node = this.nodes.get(id);
      if (node) {
        node.status = 'isolated';
      }
    }

    this.emitEvent({
      type: 'PARTITION_SPLIT',
      fromNodeId: this.localNodeId,
      payload: { isolatedNodeIds: Array.from(this.isolatedNodes) },
      timestamp: Date.now(),
    });
  }

  /**
   * Chaos: Heal Network Partition & Trigger Anti-Entropy State Reconciliation
   */
  public healPartition(): { repairedSessionsCount: number; convergenceTimeMs: number } {
    const startTime = Date.now();
    this.isolatedNodes.clear();

    for (const node of this.nodes.values()) {
      if (node.status === 'isolated') {
        node.status = 'healthy';
      }
    }

    // Anti-entropy join: merge full states of all nodes together
    let totalSessions = 0;
    const allStores = Array.from(this.crdtStores.values());
    for (const sourceStore of allStores) {
      for (const session of sourceStore.getAllSessions()) {
        totalSessions++;
        for (const targetStore of allStores) {
          if (sourceStore !== targetStore) {
            targetStore.joinFullState(session);
          }
        }
      }
    }

    const convergenceTimeMs = Date.now() - startTime;

    this.emitEvent({
      type: 'PARTITION_HEAL',
      fromNodeId: this.localNodeId,
      payload: { totalRepairedSessions: totalSessions, convergenceTimeMs },
      timestamp: Date.now(),
    });

    return { repairedSessionsCount: totalSessions, convergenceTimeMs };
  }

  /**
   * Chaos: Inject Latency Degradation / Spike on a specific regional node
   */
  public injectLatencySpike(nodeId: string, latencyMultiplier: number = 4.0): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.status = 'degraded';
    node.pewmaLatencyMs = Number((node.pewmaLatencyMs * latencyMultiplier).toFixed(2));
    node.currentQueueDepth += 15;

    // Update PEWMA estimator with high latency observation
    this.pewmaEstimator.updateObservation({
      nodeId,
      rttMs: node.pewmaLatencyMs,
      timestamp: Date.now(),
      statusCode: 200,
    });

    this.emitEvent({
      type: 'NODE_DEGRADED',
      fromNodeId: nodeId,
      payload: { newLatencyMs: node.pewmaLatencyMs, queueDepth: node.currentQueueDepth },
      timestamp: Date.now(),
    });
  }

  /**
   * Chaos: Recover Node to normal operation
   */
  public recoverNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.status = 'healthy';
    node.currentQueueDepth = Math.floor(Math.random() * 3) + 1;
    // Reset to baseline region latency
    const baselineMap: Record<RegionId, number> = {
      'us-east-1': 18.5,
      'us-west-2': 32.0,
      'eu-west-1': 48.2,
      'ap-south-1': 82.5,
      'sa-east-1': 110.0,
    };
    node.pewmaLatencyMs = baselineMap[node.region] || 25.0;

    this.pewmaEstimator.updateObservation({
      nodeId,
      rttMs: node.pewmaLatencyMs,
      timestamp: Date.now(),
      statusCode: 200,
    });

    this.emitEvent({
      type: 'NODE_RECOVERED',
      fromNodeId: nodeId,
      payload: { latencyMs: node.pewmaLatencyMs },
      timestamp: Date.now(),
    });
  }

  public startHeartbeat(intervalMs: number = 2500): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const node of this.nodes.values()) {
        if (node.status !== 'isolated') {
          node.lastHeartbeat = now;
          // Slight jitter in observations for realistic PEWMA tracking
          if (node.status === 'healthy') {
            const jitter = (Math.random() - 0.5) * 4.0;
            const observedRtt = Math.max(5.0, node.pewmaLatencyMs + jitter);
            this.pewmaEstimator.updateObservation({
              nodeId: node.id,
              rttMs: observedRtt,
              timestamp: now,
              statusCode: 200,
            });
          }
        }
      }

      this.emitEvent({
        type: 'HEARTBEAT',
        fromNodeId: this.localNodeId,
        payload: { activeCount: this.activeView.size - this.isolatedNodes.size },
        timestamp: now,
      });
    }, intervalMs);
  }

  public stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
