import { describe, expect, it } from 'vitest';
import { timesText } from './rules-cards';

describe('timesText', () => {
  it('trims zeros after a decimal point only', () => {
    expect(timesText('1.50')).toBe('1.5 ×');
    expect(timesText('2.0')).toBe('2 ×');
    expect(timesText('2')).toBe('2 ×');
  });
  it('keeps the zero of a whole number', () => {
    expect(timesText('10')).toBe('10 ×');
  });
});
