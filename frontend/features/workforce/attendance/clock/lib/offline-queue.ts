import type { ClockOutBody, TapBody } from '../../_shared/types/attendance-types';

/**
 * Taps made with no signal. Each one keeps its own `clientEventId` and the phone's own time, so sending it later (even twice) makes one
 * event counted at the moment of the tap. The queue lives in the browser's storage; if storage is blocked the queue is empty and the
 * person is told the tap was not saved.
 */

export interface QueuedTap {
  kind: 'IN' | 'OUT';
  /** The phone's clock when the person tapped, an ISO string. */
  deviceAt: string;
  body: TapBody | ClockOutBody;
}

const KEY = 'wendo.attendance.queue.v1';

export function loadQueue(): QueuedTap[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedTap[]).filter((t) => typeof t?.body?.clientEventId === 'string') : [];
  } catch {
    return [];
  }
}

function save(queue: readonly QueuedTap[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

/** Adds a tap (once per `clientEventId`). Returns false when the browser would not keep it. */
export function enqueue(tap: QueuedTap): boolean {
  const queue = loadQueue();
  if (queue.some((t) => t.body.clientEventId === tap.body.clientEventId)) return true;
  return save([...queue, tap]);
}

export function dequeue(clientEventId: string): void {
  save(loadQueue().filter((t) => t.body.clientEventId !== clientEventId));
}

/** A fresh id for one tap; kept for every retry of that tap. */
export function newTapId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `tap-${random}`;
}

/** The body to send now: the stored one with `sentAt` set to the phone's clock at the moment of sending. */
export const readyToSend = (tap: QueuedTap, now: Date = new Date()): TapBody | ClockOutBody => ({ ...tap.body, deviceAt: tap.deviceAt, sentAt: now.toISOString() });
