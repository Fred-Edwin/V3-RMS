import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';

import { chosenRow, problemOf, slowedLine } from './unlock-logic';

describe('what the code screen says', () => {
  it('reads a wrong code, with the wait that comes from the 5th wrong try', () => {
    expect(problemOf(new ApiError('That code is not right.', 403, 'CODE_WRONG'))).toEqual({ kind: 'wrong', waitSeconds: null });
    expect(problemOf(new ApiError('x', 403, 'CODE_WRONG', { waitSeconds: 4 }))).toEqual({ kind: 'wrong', waitSeconds: 4 });
  });
  it('reads a pause as a pause (429), never a lock', () => {
    expect(problemOf(new ApiError('x', 429, 'CODE_SLOWED', { waitSeconds: 8 }))).toEqual({ kind: 'slowed', waitSeconds: 8 });
    expect(slowedLine(8)).toBe('Wait 8 seconds, then try again.');
    expect(slowedLine(1)).toBe('Wait 1 second, then try again.');
  });
  it('knows no code is set, no signal, and anything else by the server words', () => {
    expect(problemOf(new ApiError('x', 409, 'NO_CODE_SET')).kind).toBe('noCode');
    expect(problemOf(new ApiError('x', 0, 'NETWORK')).kind).toBe('offline');
    expect(problemOf(new ApiError('Server said so', 500, 'BOOM'))).toEqual({ kind: 'other', message: 'Server said so' });
    expect(problemOf(new TypeError('Failed to fetch')).kind).toBe('other');
  });
  it('opens the chosen month, or the newest when none is chosen', () => {
    const rows = [{ id: 'sep' }, { id: 'aug' }];
    expect(chosenRow(rows, 'aug')?.id).toBe('aug');
    expect(chosenRow(rows, null)?.id).toBe('sep');
    expect(chosenRow([], null)).toBeNull();
  });
});
