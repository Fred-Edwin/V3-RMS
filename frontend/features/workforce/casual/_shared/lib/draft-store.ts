import type { DraftLine } from '../types/casual-types';

/**
 * What the head's phone keeps while there is no signal (PD28): the lines of one department's day, the sheet version they were made
 * against and one idempotency key. The key stays the same for the same lines, so a retry after a lost answer is safe; new lines get
 * a new key. Kept in local storage under the person; blocked storage means the draft lives for the visit only.
 */
export interface Draft {
  version: number;
  idempotencyKey: string;
  lines: DraftLine[];
  savedAt: number;
}

const memory = new Map<string, Draft>();
export const draftKey = (userId: string, siteId: string, departmentId: string, date: string): string => `wendo.casual.draft.${userId}.${siteId}.${departmentId}.${date}`;

export function newKey(): string {
  return globalThis.crypto.randomUUID();
}

export function readDraft(key: string): Draft | null {
  const held = memory.get(key);
  if (held) return held;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: Draft): void {
  memory.set(key, draft);
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // blocked: the in-memory copy above keeps it for this visit
  }
}

export function clearDraft(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing to clear
  }
}

/** The day rate last seen for a department, so an offline preview can price the lines. */
const rateKey = (siteId: string, departmentId: string): string => `wendo.casual.rate.${siteId}.${departmentId}`;
export function writeRate(siteId: string, departmentId: string, rate: string | null): void {
  try {
    if (rate) window.localStorage.setItem(rateKey(siteId, departmentId), rate);
  } catch {
    // blocked: the preview needs a signal
  }
}
export function readRate(siteId: string, departmentId: string): string | null {
  try {
    return window.localStorage.getItem(rateKey(siteId, departmentId));
  } catch {
    return null;
  }
}

/** "My casuals" kept for picking with no signal: names and masked ID numbers only. */
export interface CachedWorker {
  id: string;
  fullName: string;
  idMasked: string;
  lastWorked: string | null;
}

const peopleKey = (siteId: string, departmentId: string): string => `wendo.casual.people.${siteId}.${departmentId}`;

export function readPeople(siteId: string, departmentId: string): CachedWorker[] {
  try {
    const raw = window.localStorage.getItem(peopleKey(siteId, departmentId));
    return raw ? (JSON.parse(raw) as CachedWorker[]) : [];
  } catch {
    return [];
  }
}

export function writePeople(siteId: string, departmentId: string, workers: readonly CachedWorker[]): void {
  try {
    window.localStorage.setItem(peopleKey(siteId, departmentId), JSON.stringify(workers.map(({ id, fullName, idMasked, lastWorked }) => ({ id, fullName, idMasked, lastWorked }))));
  } catch {
    // blocked: picking works only with a signal
  }
}
