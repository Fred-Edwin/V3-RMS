import { beforeEach, describe, expect, it, vi } from 'vitest';

const incr = vi.fn();
const expire = vi.fn();
vi.mock('../../../../config/redis', () => ({ redisClient: { incr: (k: string) => incr(k), expire: (k: string, s: number) => expire(k, s) } }));

import { hitLimit, resetRateLimits } from './rate-limit';

describe('the shared rate limiter', () => {
  beforeEach(() => {
    resetRateLimits();
    incr.mockReset();
    expire.mockReset();
  });

  it('counts in Redis and sets the window on the first hit', async () => {
    incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await hitLimit('k', 1, 60)).toEqual({ allowed: true, count: 1 });
    expect(expire).toHaveBeenCalledWith('wf:limit:k', 60);
    expect(await hitLimit('k', 1, 60)).toEqual({ allowed: false, count: 2 });
  });

  it('falls back to a per-process counter when Redis is down, and does not retry Redis for 30 seconds', async () => {
    incr.mockRejectedValue(new Error('down'));
    const t = 1_000_000;
    expect((await hitLimit('m', 2, 60, t)).allowed).toBe(true);
    expect((await hitLimit('m', 2, 60, t + 1)).allowed).toBe(true);
    expect((await hitLimit('m', 2, 60, t + 2)).allowed).toBe(false);
    expect(incr).toHaveBeenCalledTimes(1);
  });

  it('the in-memory window ends', async () => {
    incr.mockRejectedValue(new Error('down'));
    const t = 5_000_000;
    await hitLimit('w', 1, 10, t);
    expect((await hitLimit('w', 1, 10, t + 1000)).allowed).toBe(false);
    expect((await hitLimit('w', 1, 10, t + 11_000)).allowed).toBe(true);
  });
});
