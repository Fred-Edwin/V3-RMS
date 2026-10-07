import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';
import type { RunDetail } from '../../_shared/types/prep-contract';
import { cancelEffectRows, checkRows, fixFailure, hasChanges, linesFromRun, reasonLabel, type FixLine } from './fix-logic';

const run = {
  id: 'r1',
  reference: 'PREP-0130',
  outputName: 'Marinated chicken',
  made: '38',
  unit: 'portions',
  inputs: [
    { itemId: 'a', itemName: 'Chicken, cut', quantity: '10', unit: 'kg' },
    { itemId: 'b', itemName: 'Garlic-ginger paste', quantity: '1', unit: 'kg' },
  ],
} as unknown as RunDetail;

const lines = (over: Partial<Record<'a' | 'b', string>> = {}): FixLine[] =>
  linesFromRun(run).map((l) => ({ ...l, quantity: over[l.itemId as 'a' | 'b'] ?? l.quantity }));

describe('hasChanges', () => {
  it('is false for the recorded figures, true for any amount, the made figure, an added line or a removed one', () => {
    expect(hasChanges(run, lines(), '38')).toBe(false);
    expect(hasChanges(run, lines(), '38.0')).toBe(false);
    expect(hasChanges(run, lines({ a: '9' }), '38')).toBe(true);
    expect(hasChanges(run, lines(), '40')).toBe(true);
    expect(hasChanges(run, [...lines(), { itemId: 'c', name: 'Salt', unit: 'kg', quantity: '1', was: null }], '38')).toBe(true);
    expect(hasChanges(run, lines({ b: '0' }), '38')).toBe(true);
  });

  it('ignores an added line that was left at zero', () => {
    expect(hasChanges(run, [...lines(), { itemId: 'c', name: 'Salt', unit: 'kg', quantity: '0', was: null }], '38')).toBe(false);
  });
});

describe('checkRows (Paper step 15)', () => {
  it('shows "10 kg → 9 kg", "1 kg · no change" and the made figure', () => {
    expect(checkRows(run, lines({ a: '9' }), '38')).toEqual([
      { label: 'Chicken, cut', value: '10 kg → 9 kg', changed: true },
      { label: 'Garlic-ginger paste', value: '1 kg · no change', changed: false },
      { label: 'Marinated chicken', value: '38 portions · no change', changed: false },
    ]);
  });

  it('reads a removed line as "not used" and an added one as "Added"', () => {
    const rows = checkRows(run, [...lines({ b: '0' }), { itemId: 'c', name: 'Salt', unit: 'kg', quantity: '2', was: null }], '40');
    expect(rows.map((r) => r.value)).toEqual(['10 kg · no change', '1 kg → not used', 'Added 2 kg', '38 portions → 40 portions']);
  });
});

describe('cancelEffectRows (Paper steps 16 and 18)', () => {
  it('puts the inputs back and removes the output', () => {
    expect(cancelEffectRows(run)).toEqual([
      { label: 'Chicken, cut', value: '10 kg put back', tone: 'back' },
      { label: 'Garlic-ginger paste', value: '1 kg put back', tone: 'back' },
      { label: 'Marinated chicken', value: '38 portions removed', tone: 'out' },
    ]);
  });
});

describe('reasonLabel', () => {
  it('names both reason sets and never goes blank', () => {
    expect(reasonLabel('WRONG_QUANTITY')).toBe('Wrong quantity');
    expect(reasonLabel('ENTERED_TWICE')).toBe('Entered twice');
    expect(reasonLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

describe('fixFailure: errors as people read them', () => {
  const fallback = 'Try again.';
  it('maps the lock, the closed run, the validation codes and the auth codes', () => {
    expect(fixFailure(new ApiError('x', 403, 'PREP_RUN_LOCKED'), fallback)).toMatchObject({ locked: true, message: expect.stringContaining('24 hours') });
    expect(fixFailure(new ApiError('x', 409, 'RUN_NOT_OPEN'), fallback)).toMatchObject({ notOpen: true });
    expect(fixFailure(new ApiError('x', 422, 'QUANTITY_NOT_POSITIVE'), fallback).message).toContain('more than zero');
    expect(fixFailure(new ApiError('x', 401, 'AUTHENTICATION_ERROR'), fallback).message).toContain('Sign in');
    expect(fixFailure(new ApiError('x', 403, 'AUTHORIZATION_ERROR'), fallback).message).toContain('permission');
  });

  it('never shows a raw code: a server fault and a network failure read as the fallback', () => {
    expect(fixFailure(new ApiError('boom', 500, 'INTERNAL_ERROR'), fallback)).toEqual({ message: fallback, locked: false, notOpen: false });
    expect(fixFailure(new TypeError('Failed to fetch'), fallback).message).toBe(fallback);
  });
});
