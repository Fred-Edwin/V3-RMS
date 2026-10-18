import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workforceEvents } from '../../_shared/events';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { createChangeBatcher } from './change-batcher';

const d = (s: string): NairobiDate => s as NairobiDate;
const change = (employeeId: string, date: string) => ({ siteId: 's1', employeeId, userId: `u-${employeeId}`, date: d(date), changedById: 'boss' });

describe('change batcher: one notice per person after a quiet period', () => {
  const seen = vi.fn();
  let off: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    seen.mockClear();
    off = workforceEvents.on('rota.shifts_changed', (e) => seen(e.payload));
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
  });

  it('says nothing until the quiet period has passed, then once per person', () => {
    const batcher = createChangeBatcher(1000);
    batcher.record([change('a', '2026-10-20'), change('b', '2026-10-20'), change('a', '2026-10-21')]);
    vi.advanceTimersByTime(999);
    expect(seen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'a', userId: 'u-a', dates: ['2026-10-20', '2026-10-21'], changeCount: 2 }));
  });

  it('a further change restarts that person’s timer', () => {
    const batcher = createChangeBatcher(1000);
    batcher.record([change('a', '2026-10-20')]);
    vi.advanceTimersByTime(800);
    batcher.record([change('a', '2026-10-22')]);
    vi.advanceTimersByTime(800);
    expect(seen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0]?.[0]).toMatchObject({ changeCount: 2 });
  });

  it('flushAll sends what is waiting and leaves nothing pending', () => {
    const batcher = createChangeBatcher(60_000);
    batcher.record([change('a', '2026-10-20')]);
    batcher.flushAll();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(batcher.pendingCount()).toBe(0);
  });
});
