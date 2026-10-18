import { describe, expect, it } from 'vitest';

import { AFTERNOON, MORNING } from '../../_shared/lib/rota-fixture';
import { cellChangeFor } from './grid-keys';

describe('Grid keys', () => {
  it('sets a shift by its letter, either case', () => {
    expect(cellChangeFor('m', [MORNING, AFTERNOON])).toBe('t-morning');
    expect(cellChangeFor('A', [MORNING, AFTERNOON])).toBe('t-afternoon');
  });
  it('clears the day on Delete or Backspace', () => {
    expect(cellChangeFor('Delete', [MORNING])).toBeNull();
    expect(cellChangeFor('Backspace', [MORNING])).toBeNull();
  });
  it('ignores a letter no shift uses and keys that are not letters', () => {
    expect(cellChangeFor('z', [MORNING])).toBeUndefined();
    expect(cellChangeFor('Tab', [MORNING])).toBeUndefined();
  });
});
