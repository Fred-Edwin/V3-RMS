import { describe, expect, it } from 'vitest';
import { formatDayAndClock, formatQuantity, parseTypedQuantity, stepForUnit, stepQuantity } from './prep-format';

describe('stepper arithmetic', () => {
  it('steps 0.5 for kg and litres, 1 for portions and pieces', () => {
    expect(stepForUnit('kg')).toBe(0.5);
    expect(stepForUnit('L')).toBe(0.5);
    expect(stepForUnit('portions')).toBe(1);
    expect(stepForUnit('pcs')).toBe(1);
  });
  it('steps without float drift and never below zero', () => {
    expect(stepQuantity('1', 1, 'kg')).toBe('1.5');
    expect(stepQuantity('0.5', -1, 'kg')).toBe('0');
    expect(stepQuantity('0', -1, 'kg')).toBe('0');
    expect(stepQuantity('0.1', 1, 'portions')).toBe('1.1');
    expect(stepQuantity('37', 1, 'portions')).toBe('38');
  });
  it('treats junk as zero', () => {
    expect(stepQuantity('abc', 1, 'kg')).toBe('0.5');
    expect(formatQuantity('abc')).toBe('0');
  });
});

describe('tap-to-type', () => {
  it('accepts numbers and a comma decimal', () => {
    expect(parseTypedQuantity('12')).toBe('12');
    expect(parseTypedQuantity('1,5')).toBe('1.5');
    expect(parseTypedQuantity(' 0.25 ')).toBe('0.25');
  });
  it('rejects empty and non-numbers so the old value stays', () => {
    expect(parseTypedQuantity('')).toBeNull();
    expect(parseTypedQuantity('.')).toBeNull();
    expect(parseTypedQuantity('1e3')).toBeNull();
    expect(parseTypedQuantity('-2')).toBeNull();
  });
});

describe('formatQuantity', () => {
  it('drops trailing zeros', () => {
    expect(formatQuantity('10.0000')).toBe('10');
    expect(formatQuantity('1.5000')).toBe('1.5');
  });
});

describe('formatDayAndClock', () => {
  const now = new Date('2026-10-12T10:00:00Z');
  it('says today, tomorrow and yesterday in Nairobi time', () => {
    expect(formatDayAndClock('2026-10-12T04:20:00Z', now)).toBe('today 07:20');
    expect(formatDayAndClock('2026-10-13T04:20:00Z', now)).toBe('tomorrow 07:20');
    expect(formatDayAndClock('2026-10-11T04:20:00Z', now)).toBe('yesterday 07:20');
  });
});
