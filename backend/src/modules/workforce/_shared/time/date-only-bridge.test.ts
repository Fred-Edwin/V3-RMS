import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateOnly, getTodayDateOnly, parseDateOnly } from '../../../../utils/date-only';
import { fromDateColumn, nairobiToday, parseNairobiDate, toDateColumn } from './nairobi-time';

describe('bridge to utils/date-only.ts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('toDateColumn equals parseDateOnly and fromDateColumn equals formatDateOnly', () => {
    const date = parseNairobiDate('2026-10-06');
    expect(toDateColumn(date).getTime()).toBe(parseDateOnly('2026-10-06').getTime());
    expect(fromDateColumn(parseDateOnly('2026-10-06'))).toBe(formatDateOnly(parseDateOnly('2026-10-06')));
  });

  it.each(['2026-10-05T20:59:00Z', '2026-10-05T21:01:00Z'])('agrees with getTodayDateOnly at %s', (iso) => {
    vi.setSystemTime(new Date(iso));
    const now = new Date();
    expect(toDateColumn(nairobiToday(now)).getTime()).toBe(getTodayDateOnly().getTime());
  });
});
