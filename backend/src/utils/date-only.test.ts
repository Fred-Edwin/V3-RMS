import { describe, expect, it } from 'vitest';
import { formatDateOnly, getTodayDateOnly, parseDateOnly, toIsoDateOnly } from './date-only';

describe('date-only utilities', () => {
  it('round-trips YYYY-MM-DD without timezone drift', () => {
    const parsed = parseDateOnly('2026-02-24');
    expect(toIsoDateOnly(parsed)).toBe('2026-02-24');
    expect(formatDateOnly(parsed)).toBe('2026-02-24');
  });

  it('normalizes local today to a stable date-only string', () => {
    const today = getTodayDateOnly();
    const rendered = toIsoDateOnly(today);
    expect(rendered).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
