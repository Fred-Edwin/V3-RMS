'use client';

import { useCallback, useEffect, useState } from 'react';

const storageKey = (userId: string) => `leaveAcknowledged:${userId}`;

function readSet(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    // Corrupted entry — start fresh
  }
  return new Set();
}

function writeSet(userId: string, set: Set<string>): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(Array.from(set)));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/**
 * Persists a per-user set of acknowledged leave request IDs in localStorage.
 * Used by the dashboard widget so resolved requests (APPROVED/REJECTED) don't
 * disappear automatically — the manager must explicitly tap "Got it" first.
 */
export function useLeaveAcknowledgements(userId: string | null) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  // Hydrate from localStorage once userId is available
  useEffect(() => {
    if (!userId) return;
    setAcknowledged(readSet(userId));
  }, [userId]);

  const acknowledge = useCallback(
    (requestId: string) => {
      if (!userId) return;
      setAcknowledged((prev) => {
        const next = new Set(prev);
        next.add(requestId);
        writeSet(userId, next);
        return next;
      });
    },
    [userId],
  );

  const isAcknowledged = useCallback(
    (requestId: string) => acknowledged.has(requestId),
    [acknowledged],
  );

  return { acknowledge, isAcknowledged };
}
