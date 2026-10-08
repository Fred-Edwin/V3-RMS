import { describe, expect, it } from 'vitest';

import { moveDay } from './date-range-picker';

const today = '2026-10-08'; // a Thursday

describe('moveDay (the calendar keys)', () => {
  it('arrows move by a day and a week', () => {
    expect(moveDay('2026-10-05', 'ArrowRight', today)).toBe('2026-10-06');
    expect(moveDay('2026-10-05', 'ArrowLeft', today)).toBe('2026-10-04');
    expect(moveDay('2026-10-05', 'ArrowDown', today)).toBe('2026-10-08'); // exactly a week later is the 12th, held at today
    expect(moveDay('2026-10-05', 'ArrowUp', today)).toBe('2026-09-28');
  });
  it('crosses month and year ends', () => {
    expect(moveDay('2026-09-30', 'ArrowRight', today)).toBe('2026-10-01');
    expect(moveDay('2026-01-01', 'ArrowLeft', today)).toBe('2025-12-31');
  });
  it('Home and End go to Monday and Sunday of that week', () => {
    expect(moveDay('2026-09-23', 'Home', today)).toBe('2026-09-21');
    expect(moveDay('2026-09-23', 'End', today)).toBe('2026-09-27');
    expect(moveDay('2026-09-21', 'Home', today)).toBe('2026-09-21');
  });
  it('PageUp and PageDown move a month and keep to the month’s last day', () => {
    expect(moveDay('2026-03-31', 'PageUp', today)).toBe('2026-02-28');
    expect(moveDay('2026-01-31', 'PageDown', today)).toBe('2026-02-28');
    expect(moveDay('2026-08-15', 'PageDown', today)).toBe('2026-09-15');
  });
  it('never goes past today', () => {
    expect(moveDay(today, 'ArrowRight', today)).toBe(today);
    expect(moveDay('2026-10-05', 'End', today)).toBe(today);
    expect(moveDay('2026-09-20', 'PageDown', today)).toBe('2026-10-08');
  });
  it('ignores other keys', () => {
    expect(moveDay('2026-10-05', 'a', today)).toBeNull();
    expect(moveDay('2026-10-05', 'Enter', today)).toBeNull();
  });
});
