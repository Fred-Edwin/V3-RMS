import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { actingEndsOn, addMonths, canUndoExit, probationEnd, undoUntil } from '../people-dates';

const d = parseNairobiDate;

describe('people dates', () => {
  it('adds months and clamps to the end of a shorter month', () => {
    expect(addMonths(d('2026-01-31'), 1)).toBe('2026-02-28');
    expect(addMonths(d('2028-01-31'), 1)).toBe('2028-02-29');
    expect(addMonths(d('2026-10-17'), 3)).toBe('2027-01-17');
    expect(addMonths(d('2026-03-15'), 0)).toBe('2026-03-15');
    expect(addMonths(d('2026-01-15'), -2)).toBe('2025-11-15');
    expect(addMonths(d('2026-12-31'), 12)).toBe('2027-12-31');
  });

  it('gives a probation end only when the rule gives months', () => {
    expect(probationEnd(d('2026-10-17'), 3)).toBe('2027-01-17');
    expect(probationEnd(d('2026-10-17'), 0)).toBeNull();
  });

  it('keeps the undo window at the last day plus seven', () => {
    expect(undoUntil(d('2026-10-31'))).toBe('2026-11-07');
    expect(canUndoExit(d('2026-10-31'), d('2026-11-07'))).toBe(true);
    expect(canUndoExit(d('2026-10-31'), d('2026-11-08'))).toBe(false);
    expect(canUndoExit(d('2026-10-31'), d('2026-10-20'))).toBe(true);
  });

  it('ends an acting head the day before they return', () => {
    expect(actingEndsOn(d('2026-11-01'))).toBe('2026-10-31');
  });
});
