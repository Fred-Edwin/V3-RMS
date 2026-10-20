import { describe, expect, it } from 'vitest';

import type { StaffDetail } from '../../../_shared/types/conduct-types';
import { appealProblem } from '../appeal-rules';
import { appealLine, decisionLine, primaryAction, signStats } from '../notice-view';

const base: StaffDetail = {
  view: 'STAFF',
  id: 'n1',
  title: 'Written warning · WRN-0007',
  level: 'WRITTEN_WARNING',
  number: 'WRN-0007',
  aboutLabel: 'Lateness',
  issuerRole: 'Branch Manager',
  issuedAt: '2026-10-09T13:42:00.000Z',
  status: 'SIGNED',
  statusWord: 'Signed',
  factsLine: null,
  verbalLine: null,
  ackDays: 3,
  appealDays: 7,
  validUntil: '2027-04-09',
  steps: [
    { key: 'issued', state: 'done', title: 'Issued to you', line: '' },
    { key: 'appeal', state: 'current', title: 'You can appeal', line: 'Until Fri 16 Oct · HR decides, not your manager' },
  ],
  actions: { canSign: false, canAppeal: true, canDownload: true, downloadVersion: 1 },
  appeal: null,
  decision: null,
  replacedById: null,
  replacesNoticeId: null,
};

describe('primaryAction', () => {
  it('is Sign while the notice waits to be signed', () => {
    expect(primaryAction({ ...base, status: 'ISSUED', actions: { ...base.actions, canSign: true } })).toBe('sign');
  });
  it('is Download once signed and a letter exists', () => {
    expect(primaryAction(base)).toBe('download');
  });
  it('is nothing for a verbal note (no letter)', () => {
    expect(primaryAction({ ...base, level: 'VERBAL_NOTE', actions: { ...base.actions, canDownload: false } })).toBeNull();
  });
});

describe('appealLine', () => {
  it('shows nothing while the Appeal button shows', () => {
    expect(appealLine(base)).toBeNull();
  });
  it('says the appeal is with HR once sent', () => {
    expect(appealLine({ ...base, appeal: { appealedAt: '2026-10-10T06:15:00.000Z', reasonLabel: 'x', text: 'y' }, actions: { ...base.actions, canAppeal: false } })).toBe('Your appeal is with HR.');
  });
  it('says it is too late after the days', () => {
    expect(appealLine({ ...base, actions: { ...base.actions, canAppeal: false } })).toBe('You can no longer appeal this notice. Speak to HR.');
  });
  it('says nothing for a notice made by a reduction (no appeal step)', () => {
    expect(appealLine({ ...base, steps: [base.steps[0]!], actions: { ...base.actions, canAppeal: false } })).toBeNull();
  });
  it('says nothing for a replaced notice', () => {
    expect(appealLine({ ...base, status: 'REPLACED', actions: { ...base.actions, canAppeal: false } })).toBeNull();
  });
});

describe('signStats', () => {
  it('reads the days to sign and the months on file from the notice itself', () => {
    expect(signStats(base)).toEqual([
      { label: 'SIGN WITHIN', value: '3 days' },
      { label: 'STAYS ON FILE', value: '6 months' },
    ]);
  });
});

describe('decisionLine', () => {
  it('gives the outcome, the reason and "HR" as the decider', () => {
    const line = decisionLine({ ...base, decision: { outcome: 'REDUCE_TO_VERBAL', reason: 'The bus broke down.', decidedAt: '2026-10-12T08:20:00.000Z', decidedByLabel: 'HR' } });
    expect(line?.title).toBe('Decided: now a verbal note');
    expect(line?.reason).toBe('The bus broke down.');
    expect(line?.by).toContain('Decided by HR');
  });
  it('is absent before a decision', () => {
    expect(decisionLine(base)).toBeNull();
  });
});

describe('appealProblem', () => {
  it('asks for a chip first', () => {
    expect(appealProblem(null, 'a long enough reason')).toBe('Choose why you disagree.');
  });
  it('asks for at least 10 characters of reason', () => {
    expect(appealProblem('GOOD_REASON', 'too short')).toContain('at least 10');
  });
  it('lets a chip and 10 characters go', () => {
    expect(appealProblem('GOOD_REASON', 'The bus broke down twice.')).toBeNull();
  });
  it('refuses more than 1,000 characters', () => {
    expect(appealProblem('OTHER', 'x'.repeat(1001))).toContain('1000');
  });
});
