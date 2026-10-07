import { describe, expect, it } from 'vitest';
import { addDays, clockText, dayEndInstant, dayStartInstant, nairobiDay, startOfNairobiDay } from './nairobi-time';

describe('nairobi-time', () => {
  it('reads 21:30 UTC as the next Nairobi day', () => {
    expect(nairobiDay(new Date('2026-10-12T21:30:00Z'))).toBe('2026-10-13');
    expect(nairobiDay(new Date('2026-10-12T20:59:59Z'))).toBe('2026-10-12');
  });

  it('starts a Nairobi day at 21:00 UTC the day before and ends it 24 hours later', () => {
    expect(dayStartInstant('2026-10-13').toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(dayEndInstant('2026-10-13').toISOString()).toBe('2026-10-13T21:00:00.000Z');
    expect(startOfNairobiDay(new Date('2026-10-13T08:00:00Z')).toISOString()).toBe('2026-10-12T21:00:00.000Z');
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-10-01', -29)).toBe('2026-09-02');
  });

  it('writes the Nairobi clock', () => {
    expect(clockText(new Date('2026-10-13T11:20:00Z'))).toBe('14:20');
  });
});
