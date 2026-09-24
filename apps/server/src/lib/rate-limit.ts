/**
 * Limiteur à fenêtre fixe : Redis si disponible (partagé entre instances),
 * sinon mémoire locale.
 */
import type { Redis } from 'ioredis';

export interface RateLimiter {
  /** Renvoie vrai si l'action est autorisée. */
  hit(key: string, limit: number, windowSec: number): Promise<boolean>;
  reset(key: string): Promise<void>;
}

export function createRateLimiter(redis: Redis | null): RateLimiter {
  if (redis) {
    return {
      async hit(key, limit, windowSec) {
        const k = `rl:${key}`;
        const n = await redis.incr(k);
        if (n === 1) await redis.expire(k, windowSec);
        return n <= limit;
      },
      async reset(key) {
        await redis.del(`rl:${key}`);
      },
    };
  }
  const buckets = new Map<string, { n: number; until: number }>();
  return {
    async hit(key, limit, windowSec) {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || b.until < now) {
        buckets.set(key, { n: 1, until: now + windowSec * 1000 });
        return true;
      }
      b.n++;
      return b.n <= limit;
    },
    async reset(key) {
      buckets.delete(key);
    },
  };
}

/** Seau à jetons en mémoire (commandes socket, chat). */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
  }
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
