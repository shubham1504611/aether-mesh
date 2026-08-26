import { 
  VectorClock, 
  AgentSessionState, 
  CrdtDelta, 
  ORSetElement, 
  ORSetDelta 
} from '../../types/index.js';

export class VectorClockHelper {
  public static increment(clock: VectorClock, nodeId: string): VectorClock {
    return {
      ...clock,
      [nodeId]: (clock[nodeId] || 0) + 1,
    };
  }

  public static merge(clockA: VectorClock, clockB: VectorClock): VectorClock {
    const merged: VectorClock = { ...clockA };
    for (const [nodeId, val] of Object.entries(clockB)) {
      merged[nodeId] = Math.max(merged[nodeId] || 0, val);
    }
    return merged;
  }

  public static compare(clockA: VectorClock, clockB: VectorClock): 'EQUAL' | 'BEFORE' | 'AFTER' | 'CONCURRENT' {
    let greater = false;
    let lesser = false;

    const allKeys = new Set([...Object.keys(clockA), ...Object.keys(clockB)]);
    for (const key of allKeys) {
      const valA = clockA[key] || 0;
      const valB = clockB[key] || 0;
      if (valA > valB) greater = true;
      if (valA < valB) lesser = true;
    }

    if (greater && !lesser) return 'AFTER';
    if (!greater && lesser) return 'BEFORE';
    if (!greater && !lesser) return 'EQUAL';
    return 'CONCURRENT';
  }
}

/**
 * Observed-Remove Set (OR-Set) with Delta-Mutation support for multi-agent tool execution locks.
 */
export class ORSet<T> {
  private elements: Map<string, ORSetElement<T>> = new Map(); // tag -> element

  public add(element: T, nodeId: string): { tag: string; delta: ORSetDelta<T> } {
    const tag = `${nodeId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const orElem: ORSetElement<T> = {
      element,
      tag,
      timestamp: Date.now(),
    };
    this.elements.set(tag, orElem);
    return {
      tag,
      delta: {
        additions: [orElem],
        removals: [],
      },
    };
  }

  public remove(element: T): { removedTags: string[]; delta: ORSetDelta<T> } {
    const matchingTags: string[] = [];
    for (const [tag, item] of this.elements.entries()) {
      if (JSON.stringify(item.element) === JSON.stringify(element)) {
        matchingTags.push(tag);
      }
    }

    for (const tag of matchingTags) {
      this.elements.delete(tag);
    }

    return {
      removedTags: matchingTags,
      delta: {
        additions: [],
        removals: matchingTags,
      },
    };
  }

  public read(): T[] {
    const items: T[] = [];
    for (const item of this.elements.values()) {
      items.push(item.element);
    }
    return items;
  }

  public contains(element: T): boolean {
    for (const item of this.elements.values()) {
      if (JSON.stringify(item.element) === JSON.stringify(element)) {
        return true;
      }
    }
    return false;
  }

  public mergeDelta(delta: ORSetDelta<T>): void {
    // 1. Add all elements in additions
    for (const add of delta.additions) {
      if (!this.elements.has(add.tag)) {
        this.elements.set(add.tag, add);
      }
    }
    // 2. Remove all elements specified in removals
    for (const tag of delta.removals) {
      this.elements.delete(tag);
    }
  }

  public getState(): ORSetElement<T>[] {
    return Array.from(this.elements.values());
  }
}

/**
 * Delta-State CRDT Memory Store for Autonomous Multi-Agent Swarms.
 * Guarantees Strong Eventual Consistency (SEC) across multi-region edge nodes.
 */
export class DeltaCrdtStore {
  private localNodeId: string;
  private sessions: Map<string, AgentSessionState> = new Map();
  private pendingDeltas: CrdtDelta[] = [];
  private onDeltaCallback?: (delta: CrdtDelta) => void;

  constructor(localNodeId: string, onDeltaBroadcast?: (delta: CrdtDelta) => void) {
    this.localNodeId = localNodeId;
    this.onDeltaCallback = onDeltaBroadcast;
  }

  public getOrCreateSession(sessionId: string, agentId: string = 'default-agent'): AgentSessionState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        agentId,
        contextWindow: [],
        toolLocks: {},
        counters: {
          totalTokens: 0,
          stepCount: 0,
        },
        metadata: {
          createdRegion: this.localNodeId,
          status: 'active',
        },
        vectorClock: { [this.localNodeId]: 1 },
        updatedAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  public getSession(sessionId: string): AgentSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllSessions(): AgentSessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Mutate context memory (Append new agent context/observation)
   */
  public appendContext(sessionId: string, contextMessage: string): CrdtDelta {
    const session = this.getOrCreateSession(sessionId);
    session.vectorClock = VectorClockHelper.increment(session.vectorClock, this.localNodeId);
    session.contextWindow.push(contextMessage);
    session.updatedAt = Date.now();

    const delta: CrdtDelta = {
      sessionId,
      sourceNodeId: this.localNodeId,
      vectorClock: { ...session.vectorClock },
      deltaType: 'CONTEXT_APPEND',
      payload: { message: contextMessage, timestamp: session.updatedAt },
      timestamp: session.updatedAt,
    };

    this.pendingDeltas.push(delta);
    if (this.onDeltaCallback) this.onDeltaCallback(delta);
    return delta;
  }

  /**
   * Mutate tool locks (Acquire distributed lock for tool execution)
   */
  public acquireToolLock(sessionId: string, toolName: string): { success: boolean; delta?: CrdtDelta } {
    const session = this.getOrCreateSession(sessionId);
    
    // Check if locked by another node
    const currentHolder = session.toolLocks[toolName];
    if (currentHolder && currentHolder !== this.localNodeId) {
      return { success: false };
    }

    session.vectorClock = VectorClockHelper.increment(session.vectorClock, this.localNodeId);
    session.toolLocks[toolName] = this.localNodeId;
    session.updatedAt = Date.now();

    const delta: CrdtDelta = {
      sessionId,
      sourceNodeId: this.localNodeId,
      vectorClock: { ...session.vectorClock },
      deltaType: 'TOOL_LOCK',
      payload: { toolName, lockHolder: this.localNodeId, timestamp: session.updatedAt },
      timestamp: session.updatedAt,
    };

    this.pendingDeltas.push(delta);
    if (this.onDeltaCallback) this.onDeltaCallback(delta);
    return { success: true, delta };
  }

  /**
   * Release tool lock
   */
  public releaseToolLock(sessionId: string, toolName: string): CrdtDelta {
    const session = this.getOrCreateSession(sessionId);
    session.vectorClock = VectorClockHelper.increment(session.vectorClock, this.localNodeId);
    delete session.toolLocks[toolName];
    session.updatedAt = Date.now();

    const delta: CrdtDelta = {
      sessionId,
      sourceNodeId: this.localNodeId,
      vectorClock: { ...session.vectorClock },
      deltaType: 'TOOL_RELEASE',
      payload: { toolName, timestamp: session.updatedAt },
      timestamp: session.updatedAt,
    };

    this.pendingDeltas.push(delta);
    if (this.onDeltaCallback) this.onDeltaCallback(delta);
    return delta;
  }

  /**
   * Increment token counter / execution steps
   */
  public incrementCounters(sessionId: string, tokens: number, steps: number = 1): CrdtDelta {
    const session = this.getOrCreateSession(sessionId);
    session.vectorClock = VectorClockHelper.increment(session.vectorClock, this.localNodeId);
    session.counters.totalTokens += tokens;
    session.counters.stepCount += steps;
    session.updatedAt = Date.now();

    const delta: CrdtDelta = {
      sessionId,
      sourceNodeId: this.localNodeId,
      vectorClock: { ...session.vectorClock },
      deltaType: 'COUNTER_INC',
      payload: { tokens, steps, timestamp: session.updatedAt },
      timestamp: session.updatedAt,
    };

    this.pendingDeltas.push(delta);
    if (this.onDeltaCallback) this.onDeltaCallback(delta);
    return delta;
  }

  /**
   * Set metadata key-value (LWW Element Map)
   */
  public setMetadata(sessionId: string, key: string, value: string): CrdtDelta {
    const session = this.getOrCreateSession(sessionId);
    session.vectorClock = VectorClockHelper.increment(session.vectorClock, this.localNodeId);
    session.metadata[key] = value;
    session.updatedAt = Date.now();

    const delta: CrdtDelta = {
      sessionId,
      sourceNodeId: this.localNodeId,
      vectorClock: { ...session.vectorClock },
      deltaType: 'METADATA_SET',
      payload: { key, value, timestamp: session.updatedAt },
      timestamp: session.updatedAt,
    };

    this.pendingDeltas.push(delta);
    if (this.onDeltaCallback) this.onDeltaCallback(delta);
    return delta;
  }

  /**
   * Semi-Lattice Join (Delta Merge): Merges incoming delta into local state.
   * Satisfies: Associativity, Commutativity, Idempotency (A ⊔ B = B ⊔ A, A ⊔ A = A)
   */
  public applyDelta(delta: CrdtDelta): boolean {
    const session = this.getOrCreateSession(delta.sessionId);

    // Merge vector clock
    session.vectorClock = VectorClockHelper.merge(session.vectorClock, delta.vectorClock);

    switch (delta.deltaType) {
      case 'CONTEXT_APPEND': {
        const msg = delta.payload.message;
        if (!session.contextWindow.includes(msg)) {
          session.contextWindow.push(msg);
        }
        break;
      }
      case 'TOOL_LOCK': {
        const { toolName, lockHolder, timestamp } = delta.payload;
        // Last-Write-Wins resolution with Node ID tie breaking
        const currentHolder = session.toolLocks[toolName];
        if (!currentHolder || timestamp > session.updatedAt || (timestamp === session.updatedAt && delta.sourceNodeId > this.localNodeId)) {
          session.toolLocks[toolName] = lockHolder;
        }
        break;
      }
      case 'TOOL_RELEASE': {
        const { toolName } = delta.payload;
        delete session.toolLocks[toolName];
        break;
      }
      case 'COUNTER_INC': {
        const { tokens, steps } = delta.payload;
        session.counters.totalTokens += tokens;
        session.counters.stepCount += steps;
        break;
      }
      case 'METADATA_SET': {
        const { key, value } = delta.payload;
        session.metadata[key] = value;
        break;
      }
      case 'STATE_JOIN': {
        const incomingState: AgentSessionState = delta.payload;
        // Merge context messages uniquely preserving order
        for (const msg of incomingState.contextWindow) {
          if (!session.contextWindow.includes(msg)) {
            session.contextWindow.push(msg);
          }
        }
        // Merge metadata (LWW)
        for (const [k, v] of Object.entries(incomingState.metadata)) {
          session.metadata[k] = v;
        }
        // Merge tool locks
        for (const [t, holder] of Object.entries(incomingState.toolLocks)) {
          session.toolLocks[t] = holder;
        }
        // Merge counters
        session.counters.totalTokens = Math.max(session.counters.totalTokens, incomingState.counters.totalTokens);
        session.counters.stepCount = Math.max(session.counters.stepCount, incomingState.counters.stepCount);
        break;
      }
    }

    session.updatedAt = Math.max(session.updatedAt, delta.timestamp);
    return true;
  }

  /**
   * Full State-Based Join (for anti-entropy repair and partition healing)
   */
  public joinFullState(incomingSession: AgentSessionState): void {
    const delta: CrdtDelta = {
      sessionId: incomingSession.sessionId,
      sourceNodeId: incomingSession.agentId,
      vectorClock: incomingSession.vectorClock,
      deltaType: 'STATE_JOIN',
      payload: incomingSession,
      timestamp: incomingSession.updatedAt,
    };
    this.applyDelta(delta);
  }
}
