import { describe, expect, it } from 'vitest';

import { adjustBlocker, parseAdd } from './adjust-input';

describe('parseAdd', () => {
  it('accepts whole numbers either way', () => {
    expect(parseAdd('2')).toEqual({ kind: 'ok', value: 2 });
    expect(parseAdd('-1')).toEqual({ kind: 'ok', value: -1 });
    expect(parseAdd('+3')).toEqual({ kind: 'ok', value: 3 });
  });
  it('says what is wrong in the spec words', () => {
    expect(parseAdd('')).toEqual({ kind: 'empty' });
    expect(parseAdd('1.5')).toEqual({ kind: 'invalid', message: 'Use a whole number such as 2 or -1.' });
    expect(parseAdd('0')).toEqual({ kind: 'invalid', message: 'Nothing to change yet.' });
    expect(parseAdd('61')).toMatchObject({ kind: 'invalid' });
  });
});

describe('adjustBlocker', () => {
  const ready = { hasPerson: true, hasType: true, add: { kind: 'ok', value: 2 } as const, hasReason: true, otherNeedsNote: false };
  it('is null when everything is there', () => expect(adjustBlocker(ready)).toBeNull());
  it('names the first thing missing, in order', () => {
    expect(adjustBlocker({ ...ready, hasPerson: false, hasReason: false })).toBe('Choose a person.');
    expect(adjustBlocker({ ...ready, add: { kind: 'empty' } })).toBe('Add or take off some days.');
    expect(adjustBlocker({ ...ready, hasReason: false })).toBe('Choose a reason.');
    expect(adjustBlocker({ ...ready, otherNeedsNote: true })).toBe('Say why, in a few words.');
  });
});
