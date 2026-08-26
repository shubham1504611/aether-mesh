import { AgentSessionState, InferenceResponse } from '../../types/index.js';

export interface StorageRecord<T> {
  key: string;
  data: T;
  shardId: number;
  createdAt: number;
  updatedAt: number;
}

export class LruCache<K, V> {
  private capacity: number;
  private cache: Map<K, { value: V; expiresAt: number }> = new Map();

  constructor(capacity: number = 5000) {
    this.capacity = capacity;
  }

  public get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  public set(key: K, value: V, ttlMs: number = 300000): void {
    if (this.cache.size >= this.capacity) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public size(): number {
    return this.cache.size;
  }
}

/**
 * Multi-Tier Storage Engine with Sharded Relational Indexing and Schema DDL.
 */
export class DistributedStorageEngine {
  private l1Cache: LruCache<string, any>;
  private l2Store: Map<string, StorageRecord<any>> = new Map();
  private shardCount: number = 16;
  private sessionIndex: Map<string, string[]> = new Map(); // agentId -> sessionIds[]

  constructor() {
    this.l1Cache = new LruCache<string, any>(10000);
  }

  public getShardId(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % this.shardCount;
  }

  public saveSession(session: AgentSessionState): void {
    const key = `session:${session.sessionId}`;
    const shardId = this.getShardId(session.sessionId);
    const now = Date.now();

    const record: StorageRecord<AgentSessionState> = {
      key,
      data: session,
      shardId,
      createdAt: session.updatedAt,
      updatedAt: now,
    };

    // Write to L1 Cache
    this.l1Cache.set(key, session, 600000); // 10 min TTL

    // Write to L2 Persistent Store
    this.l2Store.set(key, record);

    // Index by Agent ID
    const agentSessions = this.sessionIndex.get(session.agentId) || [];
    if (!agentSessions.includes(session.sessionId)) {
      agentSessions.push(session.sessionId);
      this.sessionIndex.set(session.agentId, agentSessions);
    }
  }

  public getSession(sessionId: string): AgentSessionState | undefined {
    const key = `session:${sessionId}`;
    
    // 1. Check L1 Cache
    const cached = this.l1Cache.get(key);
    if (cached) return cached;

    // 2. Check L2 Store
    const record = this.l2Store.get(key);
    if (record) {
      this.l1Cache.set(key, record.data, 600000);
      return record.data;
    }

    return undefined;
  }

  public cacheInference(promptHash: string, response: InferenceResponse): void {
    this.l1Cache.set(`inference_cache:${promptHash}`, response, 120000); // 2 min semantic cache
  }

  public getCachedInference(promptHash: string): InferenceResponse | undefined {
    return this.l1Cache.get(`inference_cache:${promptHash}`);
  }

  public getStats(): { l1Size: number; l2Size: number; shardCount: number } {
    return {
      l1Size: this.l1Cache.size(),
      l2Size: this.l2Store.size,
      shardCount: this.shardCount,
    };
  }

  /**
   * Generates PostgreSQL DDL migrations for global production deployment.
   */
  public static getPostgresSchemaDDL(): string {
    return `
-- AETHER-MESH Multi-Region Distributed Relational Schema (PostgreSQL / Google Cloud Spanner)
CREATE TABLE IF NOT EXISTS edge_nodes (
    node_id VARCHAR(64) PRIMARY KEY,
    region VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'healthy',
    capacity_tokens_sec INT NOT NULL DEFAULT 10000,
    pewma_latency_ms NUMERIC(8, 2) NOT NULL DEFAULT 25.0,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_sessions (
    session_id VARCHAR(128) NOT NULL,
    agent_id VARCHAR(128) NOT NULL,
    shard_key INT NOT NULL,
    vector_clock JSONB NOT NULL DEFAULT '{}',
    context_window JSONB NOT NULL DEFAULT '[]',
    tool_locks JSONB NOT NULL DEFAULT '{}',
    counters JSONB NOT NULL DEFAULT '{"totalTokens":0,"stepCount":0}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, shard_key)
) PARTITION BY HASH (shard_key);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at ON agent_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS crdt_delta_log (
    delta_id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(128) NOT NULL,
    source_node_id VARCHAR(64) NOT NULL,
    delta_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    vector_clock JSONB NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crdt_delta_session ON crdt_delta_log(session_id, applied_at);
    `.trim();
  }
}
