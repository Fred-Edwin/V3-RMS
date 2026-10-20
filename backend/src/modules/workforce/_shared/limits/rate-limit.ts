import { redisClient } from '../../../../config/redis';

/**
 * A fixed-window counter shared by the Workforce routes that must be rate limited (the chain check, the public verify page).
 * Redis when it answers (so every API instance counts together), a per-process counter when it does not: a limiter that
 * fails open must still slow a flood on one instance. After a Redis failure Redis is skipped for 30 seconds.
 */
export interface HitResult {
  allowed: boolean;
  count: number;
}

const REDIS_TIMEOUT_MS = 300;
const REDIS_COOLDOWN_MS = 30_000;
const memory = new Map<string, { count: number; resetAt: number }>();
let redisDownUntil = 0;

const withTimeout = <T>(work: Promise<T>): Promise<T> =>
  Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), REDIS_TIMEOUT_MS))]);

function hitMemory(key: string, limit: number, windowSec: number, now: number): HitResult {
  if (memory.size > 5_000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  const found = memory.get(key);
  const cell = found && found.resetAt > now ? found : { count: 0, resetAt: now + windowSec * 1000 };
  cell.count += 1;
  memory.set(key, cell);
  return { allowed: cell.count <= limit, count: cell.count };
}

/** Counts one hit against `key`. `allowed` is false once the window already holds `limit` hits. */
export async function hitLimit(key: string, limit: number, windowSec: number, now: number = Date.now()): Promise<HitResult> {
  if (now >= redisDownUntil) {
    try {
      const redisKey = `wf:limit:${key}`;
      const count = await withTimeout(redisClient.incr(redisKey));
      if (count === 1) await withTimeout(redisClient.expire(redisKey, windowSec));
      return { allowed: count <= limit, count };
    } catch {
      redisDownUntil = now + REDIS_COOLDOWN_MS;
    }
  }
  return hitMemory(key, limit, windowSec, now);
}

/** Test seam: forget every in-memory counter and the Redis cooldown. */
export function resetRateLimits(): void {
  memory.clear();
  redisDownUntil = 0;
}
