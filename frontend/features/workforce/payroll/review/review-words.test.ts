import { describe, expect, it } from 'vitest';

import type { ReviewLine } from '../_shared/types/action-types';
import { bulkKind, checkboxName, checkedWords, filterQuery, kindWords } from './review-words';

const line = (over: Partial<ReviewLine>): ReviewLine => ({ id: 'l', kind: 'LATENESS_DEDUCTION', severity: 'TICK', employeeId: 'e', name: 'Esther Mwende', siteId: 's', siteName: 'Nyeri Town', text: '', state: 'OPEN', checkedBy: null, checkedAt: null, actions: [], ...over });

describe('review card words', () => {
  it('turns a filter chip into the server query', () => {
    expect(filterQuery('blocks')).toEqual({ severity: 'BLOCK' });
    expect(filterQuery('tick')).toEqual({ severity: 'TICK', state: 'OPEN' });
    expect(filterQuery('ticked')).toEqual({ state: 'CHECKED' });
    expect(filterQuery('all')).toEqual({});
  });
  it('offers a bulk tick only for several open, non-blocking lines of a kind that allows it', () => {
    const two = [line({ id: '1' }), line({ id: '2' })];
    expect(bulkKind(two, 'LATENESS_DEDUCTION')).toBe('LATENESS_DEDUCTION');
    expect(bulkKind([line({})], 'LATENESS_DEDUCTION')).toBeNull();
    expect(bulkKind([line({ kind: 'BIG_CHANGE' }), line({ kind: 'BIG_CHANGE' })], 'BIG_CHANGE')).toBeNull();
    expect(bulkKind([line({ severity: 'BLOCK' }), line({ severity: 'BLOCK' })], 'LATENESS_DEDUCTION')).toBeNull();
    expect(bulkKind(two, undefined)).toBeNull();
  });
  it('names a line for a screen reader', () => {
    expect(checkboxName(line({ kind: 'UNPAID_ABSENCE' }))).toBe('Check: Esther Mwende, Nyeri Town, Unpaid absence');
    expect(checkedWords(3, 5)).toBe('3 of 5 checked');
    expect(kindWords('SOMETHING_NEW')).toBe('something new');
  });
});
