import { AuthUser } from '../../types/index.js';

export interface RateLimitStatus {
  allowed: boolean;
  tokensRemaining: number;
  resetTimeMs: number;
  spilloverRecommended: boolean;
  tier: string;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRatePerSec: number;
}

export class DistributedTokenBucketLimiter {
  private buckets: Map<string, Bucket> = new Map();
  private tierConfigs = {
    free: { capacity: 20, refillRatePerSec: 2 },        // 120 req/min
    pro: { capacity: 100, refillRatePerSec: 20 },       // 1200 req/min
    enterprise: { capacity: 1000, refillRatePerSec: 200 } // 12000 req/min
  };

  /**
   * Evaluates request against token bucket and computes spillover pressure.
   */
  public checkLimit(user: AuthUser, cost: number = 1): RateLimitStatus {
    const key = `user_${user.id}_${user.tier}`;
    const config = this.tierConfigs[user.tier] || this.tierConfigs.free;

    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: config.capacity,
        lastRefill: now,
        capacity: config.capacity,
        refillRatePerSec: config.refillRatePerSec,
      };
      this.buckets.set(key, bucket);
    } else {
      // Refill tokens based on elapsed time
      const elapsedSec = (now - bucket.lastRefill) / 1000;
      const refilled = elapsedSec * bucket.refillRatePerSec;
      bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refilled);
      bucket.lastRefill = now;
    }

    // Spillover is recommended if tokens drop below 25% of capacity
    const spilloverRecommended = bucket.tokens < bucket.capacity * 0.25;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      const resetTimeMs = Math.ceil(((config.capacity - bucket.tokens) / config.refillRatePerSec) * 1000);
      return {
        allowed: true,
        tokensRemaining: Math.floor(bucket.tokens),
        resetTimeMs,
        spilloverRecommended,
        tier: user.tier,
      };
    } else {
      // If enterprise or pro, allow soft spillover without hard rejection
      if (user.tier === 'enterprise' || user.tier === 'pro') {
        return {
          allowed: true,
          tokensRemaining: 0,
          resetTimeMs: 1000,
          spilloverRecommended: true,
          tier: user.tier,
        };
      }

      return {
        allowed: false,
        tokensRemaining: 0,
        resetTimeMs: Math.ceil((cost / config.refillRatePerSec) * 1000),
        spilloverRecommended: true,
        tier: user.tier,
      };
    }
  }

  public resetUser(userId: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(`user_${userId}`)) {
        this.buckets.delete(key);
      }
    }
  }
}
