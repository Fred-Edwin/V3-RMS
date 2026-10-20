const TTL_MS = 10_000;

interface Entry<T> {
  value: T;
  until: number;
}

/**
 * A ten second memory for the session gate's two lookups, so a Workforce call does not always cost two database reads. A change made
 * in this process clears the person at once; another process catches up within ten seconds.
 */
export function createSessionCache<T>() {
  const entries = new Map<string, Entry<T>>();
  return {
    get(key: string, now: number): T | undefined {
      const hit = entries.get(key);
      return hit && hit.until > now ? hit.value : undefined;
    },
    set(key: string, value: T, now: number): void {
      if (entries.size > 5_000) entries.clear(); // a bound, not a policy
      entries.set(key, { value, until: now + TTL_MS });
    },
    forget(userId: string): void {
      for (const key of entries.keys()) if (key.startsWith(`${userId}:`)) entries.delete(key);
    },
    clear: (): void => entries.clear(),
  };
}
