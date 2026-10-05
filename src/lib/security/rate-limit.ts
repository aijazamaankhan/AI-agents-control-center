export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

/**
 * Fixed-window limiter, per process. Adequate for a single instance; Phase 4
 * swaps in a Redis implementation of the same interface for multi-instance deploys.
 */
export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
      if (this.buckets.size > 10_000) this.sweep(now);
    }
    bucket.count += 1;
    const ok = bucket.count <= limit;
    return {
      ok,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterMs: ok ? 0 : bucket.resetAt - now,
    };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  private sweep(now: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

const globalForLimiter = globalThis as unknown as { rateLimiter?: RateLimiter };
export const rateLimiter: RateLimiter = (globalForLimiter.rateLimiter ??= new MemoryRateLimiter());

export const RATE_LIMITS = {
  loginPerEmail: { limit: 10, windowMs: 15 * 60 * 1000 },
  loginPerIp: { limit: 50, windowMs: 15 * 60 * 1000 },
  signupPerIp: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const;
