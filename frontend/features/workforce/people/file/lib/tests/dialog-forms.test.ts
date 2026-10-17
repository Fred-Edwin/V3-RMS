import { describe, expect, it } from 'vitest';

import { hasErrors, toContractBody, toLoginBody, toPayChangeBody, toProbationBody, validateContract, validateDecision, validateLogin, validatePayChange, validateProbation } from '../dialog-forms';
import { exitLines, loanLines, toExitBody, toLoanBody, validateExit, validateLoan, validateTransfer } from '../move-forms';
import { fileProblem } from '../upload-rules';

const today = '2026-10-17';
const rule = { defaultMonths: 3, maxExtensions: 1, maxExtensionMonths: 3 };

describe('change pay', () => {
  const ok = { amount: '31000', startsOn: '2026-11-01', reason: 'PROMOTION' as const, note: '' };
  it('accepts a complete form and sends money with two decimals', () => {
    expect(hasErrors(validatePayChange(ok, today, '28000.00'))).toBe(false);
    expect(toPayChangeBody(ok)).toEqual({ amount: '31000.00', effectiveFrom: '2026-11-01', reason: 'PROMOTION' });
  });
  it('refuses the pay already in force, a past day, no reason, and Other without words', () => {
    expect(validatePayChange({ ...ok, amount: '28000' }, today, '28000.00').amount).toMatch(/already in force/);
    expect(validatePayChange({ ...ok, startsOn: '2026-10-01' }, today, null).startsOn).toMatch(/past/);
    expect(validatePayChange({ ...ok, reason: '' }, today, null).reason).toBeTruthy();
    expect(validatePayChange({ ...ok, reason: 'OTHER' }, today, null).note).toBeTruthy();
  });
});

describe('the Director decision', () => {
  it('needs a reason only to decline', () => {
    expect(validateDecision('APPROVE', '')).toBeNull();
    expect(validateDecision('DECLINE', ' ')).toMatch(/why/);
    expect(validateDecision('DECLINE', 'Too high')).toBeNull();
  });
});

describe('probation', () => {
  it('confirms and ends without extra fields', () => {
    expect(hasErrors(validateProbation({ choice: 'CONFIRM', months: '', reason: '' }, rule, 1))).toBe(false);
    expect(toProbationBody({ choice: 'END', months: '', reason: '' })).toEqual({ decision: 'END' });
  });
  it('an extension needs 1 to 3 months, a reason, and an extension left', () => {
    expect(validateProbation({ choice: 'EXTEND', months: '4', reason: 'x' }, rule, 1).months).toMatch(/1 to 3/);
    expect(validateProbation({ choice: 'EXTEND', months: '2', reason: '' }, rule, 1).reason).toBeTruthy();
    expect(validateProbation({ choice: 'EXTEND', months: '2', reason: 'x' }, rule, 0).choice).toBeTruthy();
    expect(toProbationBody({ choice: 'EXTEND', months: '2', reason: ' slow start ' })).toEqual({ decision: 'EXTEND', months: 2, reason: 'slow start' });
  });
});

describe('contract and login', () => {
  it('a timed contract needs an end that is not before the start', () => {
    expect(validateContract({ contractTypeId: 't', startsOn: '2026-10-20', endsOn: '' }, true).endsOn).toBeTruthy();
    expect(validateContract({ contractTypeId: 't', startsOn: '2026-10-20', endsOn: '2026-10-01' }, true).endsOn).toMatch(/before/);
    expect(toContractBody({ contractTypeId: '', startsOn: '2026-10-20', endsOn: '' })).toEqual({ startsOn: '2026-10-20' });
  });
  it('a login needs a real email, a role and a password of 8 characters', () => {
    expect(Object.keys(validateLogin({ email: 'nope', loginRole: '', temporaryPassword: 'abc' }))).toEqual(['email', 'loginRole', 'temporaryPassword']);
    expect(toLoginBody({ email: ' a@b.co ', loginRole: 'BARISTA', temporaryPassword: 'maji-jua-1234' }).email).toBe('a@b.co');
  });
});

describe('moves', () => {
  const file = { organization: { id: 's1', name: 'Town' }, department: { id: 'd1', name: 'Barista' } };
  it('a transfer needs a place, a new department and a day that is not past', () => {
    expect(Object.keys(validateTransfer({ toSiteId: '', toDepartmentId: '', toPositionId: '', startsOn: today }, file, today))).toEqual(['toSiteId', 'toDepartmentId']);
    expect(validateTransfer({ toSiteId: 's1', toDepartmentId: 'd1', toPositionId: '', startsOn: today }, file, today).toDepartmentId).toMatch(/already/);
    expect(validateTransfer({ toSiteId: 's2', toDepartmentId: 'd9', toPositionId: '', startsOn: '2026-10-01' }, file, today).startsOn).toBeTruthy();
  });
  it('an exit allows up to a week back, and Other needs words', () => {
    expect(validateExit({ lastDay: '2026-10-09', reason: 'RESIGNED', uniformReturned: false, note: '' }, today).lastDay).toBeTruthy();
    expect(validateExit({ lastDay: '2026-10-12', reason: 'OTHER', uniformReturned: false, note: '' }, today).note).toBeTruthy();
    expect(toExitBody({ lastDay: '2026-10-31', reason: 'RESIGNED', uniformReturned: true, note: '' })).toEqual({ lastDay: '2026-10-31', reason: 'RESIGNED', uniformReturned: true });
  });
  it('the exit lines name the day and the undo window', () => {
    const lines = exitLines('2026-10-31', 7, null);
    expect(lines[0]).toMatch(/31 October/);
    expect(lines[2]).toMatch(/7 days/);
  });
  it('a loan is for today, until a day, or open-ended', () => {
    expect(toLoanBody({ toSiteId: 's2', mode: 'today', until: '' }, today)).toEqual({ toSiteId: 's2', from: today, until: today });
    expect(toLoanBody({ toSiteId: 's2', mode: 'back', until: '' }, today).until).toBeNull();
    expect(validateLoan({ toSiteId: 's2', mode: 'until', until: '' }, today).until).toBeTruthy();
    expect(loanLines({ toSiteId: 's2', mode: 'back', until: '' }, 'Highway', 'Town', 'Joy', today)[2]).toMatch(/bring Joy back/);
  });
});

describe('uploads', () => {
  it('refuses big, empty and wrong-type files', () => {
    const accept = 'image/jpeg,image/png,application/pdf';
    expect(fileProblem({ name: 'a.pdf', size: 11_000_000, type: 'application/pdf' }, accept)).toMatch(/10 MB/);
    expect(fileProblem({ name: 'a.pdf', size: 0, type: 'application/pdf' }, accept)).toMatch(/empty/);
    expect(fileProblem({ name: 'a.doc', size: 100, type: 'application/msword' }, accept)).toMatch(/JPG/);
    expect(fileProblem({ name: 'a.png', size: 100, type: 'image/png' }, accept)).toBeNull();
    expect(fileProblem(null, accept)).toBeNull();
  });
});
