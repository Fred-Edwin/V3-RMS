import { describe, expect, it } from 'vitest';
import {
  formatDateOnly,
  formatNairobiDate,
  formatNairobiTime,
  getTodayDateOnly,
  parseDateOnly,
  toIsoDateOnly,
} from './date-only';

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

  describe('Nairobi formatters render in EAT (UTC+3) regardless of server zone', () => {
    // 16:46 UTC is 19:46 in Nairobi — the exact bug that printed receipts 3h early.
    it('formats time in Kenya time, not UTC', () => {
      const instant = new Date('2026-06-17T16:46:00Z');
      expect(formatNairobiTime(instant)).toBe('19:46');
    });

    it('rolls the date forward when UTC instant crosses midnight into EAT', () => {
      // 22:30 UTC on the 17th is 01:30 on the 18th in Nairobi.
      const instant = new Date('2026-06-17T22:30:00Z');
      expect(formatNairobiTime(instant)).toBe('01:30');
      expect(formatNairobiDate(instant)).toBe('18/06/2026');
    });
  });
});
