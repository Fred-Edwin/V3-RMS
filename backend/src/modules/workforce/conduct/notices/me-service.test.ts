import { describe, expect, it } from 'vitest';
import { chooseColumns, type StaffList } from './me-service';

const counts = (extra: Partial<StaffList['counts']>): StaffList['counts'] => ({ toSign: 0, canAppeal: 0, ended: 0, appealed: 0, replaced: 0, withdrawn: 0, ...extra });

describe('chooseColumns (S7)', () => {
  it('puts TO SIGN first when something waits, then the two highest non-zero', () => {
    expect(chooseColumns(counts({ toSign: 1, canAppeal: 1, ended: 2 })).map((c) => c.key)).toEqual(['toSign', 'ended', 'canAppeal']);
  });

  it('after an appeal: the appealed and replaced columns lead, as Paper step 04 shows', () => {
    expect(chooseColumns(counts({ appealed: 1, replaced: 1 })).map((c) => [c.label, c.value])).toEqual([['APPEALED', 1], ['REPLACED', 1], ['TO SIGN', 0]]);
  });

  it('an empty file shows TO SIGN, CAN APPEAL and ENDED at zero', () => {
    expect(chooseColumns(counts({})).map((c) => c.key)).toEqual(['toSign', 'canAppeal', 'ended']);
  });

  it('never returns more than three', () => {
    expect(chooseColumns(counts({ toSign: 2, canAppeal: 3, appealed: 4, replaced: 5, withdrawn: 6, ended: 7 }))).toHaveLength(3);
  });
});
