import { describe, expect, it } from 'vitest';
import {
  checklistPercent,
  checklistRows,
  fileParts,
  gapsOf,
  ringPercent,
  type FileFacts,
} from './people-completeness';

const complete: FileFacts = {
  casual: false,
  hasNationalId: true,
  hasPhone: true,
  hasPosition: true,
  hasDepartment: true,
  payAmountSet: true,
  payoutComplete: true,
  hasLogin: true,
  hasNssf: true,
  hasSha: true,
  hasPhoto: true,
  hasPersonalDetails: true,
  hasEmergencyContact: true,
  contractActive: true,
};

describe('file completeness', () => {
  it('a finished file is 100 percent with no gaps', () => {
    const states = fileParts(complete);
    expect(ringPercent(states)).toBe(100);
    expect(checklistPercent(checklistRows(states))).toBe(100);
    expect(gapsOf(states, [])).toEqual([]);
  });

  it('a casual is not asked for bank, login, NSSF, photo or contract', () => {
    const states = fileParts({ ...complete, casual: true, hasLogin: false, hasNssf: false, hasPhoto: false, contractActive: false, payoutComplete: false });
    expect(gapsOf(states, [])).toEqual([]);
    expect(ringPercent(states)).toBe(100);
  });

  it('counts the ring over six parts', () => {
    const states = fileParts({ ...complete, payoutComplete: false, contractActive: false });
    expect(ringPercent(states)).toBe(67);
  });

  it('hides gaps in groups the viewer cannot see', () => {
    const states = fileParts({ ...complete, payAmountSet: false, payoutComplete: false, hasNationalId: false, hasLogin: false });
    expect(gapsOf(states, [])).toEqual(['IDENTITY', 'PAY', 'BANK', 'LOGIN']);
    expect(gapsOf(states, ['pay', 'bank', 'ids'])).toEqual(['LOGIN']);
  });

  it('merges parts into the checklist rows', () => {
    const rows = checklistRows(fileParts({ ...complete, payoutComplete: false }));
    expect(rows.find((r) => r.row === 'PAY_AND_BANK')).toEqual({ row: 'PAY_AND_BANK', applicable: true, done: false });
    expect(rows.find((r) => r.row === 'WHO_AND_JOB')?.done).toBe(true);
  });
});
