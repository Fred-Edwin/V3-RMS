import * as React from 'react';

/**
 * Hidden amounts (PD8): hidden by default, one preference per device and per person, kept in local storage under the person's id.
 * First paint is always hidden. If storage is blocked it stays hidden and the eye still toggles for the visit.
 */
const key = (userId: string): string => `wendo.payslips.amounts.${userId}`;
const visit = new Map<string, boolean>();
const listeners = new Set<() => void>();
let version = 0;

export function readShown(userId: string | null): boolean {
  if (!userId) return false;
  if (visit.has(userId)) return visit.get(userId) === true;
  try {
    return window.localStorage.getItem(key(userId)) === 'shown';
  } catch {
    return false;
  }
}

export function writeShown(userId: string, shown: boolean): void {
  visit.set(userId, shown);
  try {
    window.localStorage.setItem(key(userId), shown ? 'shown' : 'hidden');
  } catch {
    // blocked: the visit-only value above still works
  }
  version += 1;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** `shown` is false on the server and on the first client render, then the saved value. */
export function useAmountsShown(userId: string | null): { shown: boolean; toggle: () => void } {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  React.useSyncExternalStore(subscribe, () => version, () => 0);
  const shown = hydrated && readShown(userId);
  const toggle = React.useCallback(() => {
    if (userId) writeShown(userId, !readShown(userId));
  }, [userId]);
  return { shown, toggle };
}
