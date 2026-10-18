import { workforceEvents } from '../../_shared/events';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { CHANGE_QUIET_MS } from '../rota.constants';
import type { PersonChange } from '../rota.types';

interface Pending {
  siteId: string;
  employeeId: string;
  userId: string | null;
  dates: Set<NairobiDate>;
  count: number;
  changedById: string;
  timer: ReturnType<typeof setTimeout>;
}

export interface ChangeBatcher {
  /** Remember changes; each person's timer restarts, and when it runs out one event goes out for that person. */
  record(changes: readonly PersonChange[]): void;
  /** Send everything waiting now (shutdown and tests). */
  flushAll(): void;
  pendingCount(): number;
}

/**
 * "Your shifts changed" is told once per person after a quiet period, not once per click (owner decision, 18 Oct 2026).
 * It is in memory on purpose: a restart loses a notice that was still waiting, the shifts themselves are saved (decision R6).
 * Delivery is a later slice; a listener turns the event into a log line until Notifications exist.
 */
export function createChangeBatcher(quietMs: number): ChangeBatcher {
  const waiting = new Map<string, Pending>();

  const send = (employeeId: string): void => {
    const pending = waiting.get(employeeId);
    if (!pending) return;
    clearTimeout(pending.timer);
    waiting.delete(employeeId);
    workforceEvents.emit('rota.shifts_changed', {
      siteId: pending.siteId,
      employeeId,
      userId: pending.userId,
      dates: [...pending.dates].sort(),
      changeCount: pending.count,
      changedById: pending.changedById,
    });
  };

  return {
    record(changes) {
      for (const change of changes) {
        const existing = waiting.get(change.employeeId);
        if (existing) clearTimeout(existing.timer);
        const timer = setTimeout(() => send(change.employeeId), quietMs);
        timer.unref();
        waiting.set(change.employeeId, {
          siteId: change.siteId,
          employeeId: change.employeeId,
          userId: change.userId,
          dates: existing?.dates ?? new Set(),
          count: (existing?.count ?? 0) + 1,
          changedById: change.changedById,
          timer,
        });
        waiting.get(change.employeeId)?.dates.add(change.date);
      }
    },
    flushAll() {
      for (const employeeId of [...waiting.keys()]) send(employeeId);
    },
    pendingCount: () => waiting.size,
  };
}

export const changeBatcher: ChangeBatcher = createChangeBatcher(CHANGE_QUIET_MS);
