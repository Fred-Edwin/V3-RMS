import { describe, expect, it } from 'vitest';
import { quantityLabel, shortPerson } from './branch-waste-people';

describe('branch waste people and quantity wording', () => {
  it('shortens a name to a first name and a last initial', () => {
    expect(shortPerson('Joseph Mwangi')).toBe('Joseph M.');
    expect(shortPerson('Grace')).toBe('Grace');
    expect(shortPerson('Mary Wanjiru Kamau')).toBe('Mary K.');
  });

  it('drops trailing zeros from a quantity', () => {
    expect(quantityLabel('2.0000', 'kg')).toBe('2 kg');
    expect(quantityLabel('2.5', 'L')).toBe('2.5 L');
    expect(quantityLabel('1.50', 'kg')).toBe('1.5 kg');
  });
});
