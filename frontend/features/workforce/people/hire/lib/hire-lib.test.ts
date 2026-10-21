import { describe, expect, it } from 'vitest';

import { addMonths, hourlyEquivalent, hourlyWorking, probationEndsOn } from './hire-figures';
import { emptyHire, fromDraft, stepsFor, toDraft, toHireBody, type HireState } from './hire-model';
import { hasErrors, validateStep } from './hire-validation';

const filled = (over: Partial<HireState> = {}): HireState => ({
  ...emptyHire('2026-10-05'),
  name: 'Wanjiru Kamau',
  phone: '0712 345 678',
  nationalId: '31245678',
  email: 'Wanjiru.Kamau@wendocoffee.com',
  siteId: 's1',
  departmentId: 'd1',
  positionId: 'p1',
  amount: '28000',
  kraPin: 'A012345678Z',
  payoutMethod: 'BANK',
  bankName: 'Equity Bank',
  accountNumber: '0123454821',
  loginEmail: 'wanjiru.kamau@wendocoffee.com',
  loginRole: 'BARISTA',
  temporaryPassword: 'maji-kahawa-4721',
  ...over,
});

describe('the steps of a hire', () => {
  it('has five for monthly staff, three for a casual, and two for someone who may not set pay', () => {
    expect(stepsFor({ employment: 'MONTHLY_WITH_CONTRACT' }, true)).toEqual(['who', 'job', 'pay', 'statutory', 'login']);
    expect(stepsFor({ employment: 'CASUAL' }, true)).toEqual(['who', 'job', 'pay']);
    expect(stepsFor({ employment: 'MONTHLY_NO_CONTRACT_YET' }, false)).toEqual(['who', 'job']);
  });
});

describe('what a hire sends', () => {
  it('sends everything for monthly staff, with the email lower-cased by the server and the empty parts left out', () => {
    const body = toHireBody(filled(), true, 'draft-1');
    expect(body.draftId).toBe('draft-1');
    expect(body.pay).toEqual({ amount: '28000', overtimeEligible: false, standardWeekHours: '48', standardDayHours: undefined });
    expect(body.statutory?.bankName).toBe('Equity Bank');
    expect(body.statutory?.nssfNumber).toBeUndefined();
    expect(body.login?.loginRole).toBe('BARISTA');
  });
  it('sends no statutory part and no login for a casual', () => {
    const body = toHireBody(filled({ employment: 'CASUAL', dayHours: '8', amount: '1200' }), true);
    expect(body.statutory).toBeUndefined();
    expect(body.login).toBeUndefined();
    expect(body.pay).toMatchObject({ amount: '1200', standardDayHours: '8', standardWeekHours: undefined });
  });
  it('sends only the basics and the job when the person may not set pay', () => {
    const body = toHireBody(filled(), false);
    expect(body.pay).toBeUndefined();
    expect(body.login).toBeUndefined();
    expect(body.job.reportsToId).toBeNull();
  });
  it('sends the bank account only for a bank payout, and the M-Pesa phone only for M-Pesa', () => {
    expect(toHireBody(filled({ payoutMethod: 'MPESA', mpesaPhone: '0712000111' }), true).statutory).toMatchObject({ accountNumber: undefined, mpesaPhone: '0712000111' });
    expect(toHireBody(filled({ payoutMethod: 'CASH' }), true).statutory).toMatchObject({ bankName: undefined, accountNumber: undefined });
  });
});

describe('drafts', () => {
  it('never keep the temporary password or the account number', () => {
    const draft = toDraft(filled(), 3);
    expect(draft.kind).toBe('MONTHLY');
    expect(draft.payload).not.toHaveProperty('temporaryPassword');
    expect(draft.payload).not.toHaveProperty('accountNumber');
    expect(draft.payload.name).toBe('Wanjiru Kamau');
  });
  it('come back over an empty form, ignoring values of the wrong type', () => {
    const back = fromDraft({ name: 'Joy', amount: 5, tracksTime: false, employment: 'CASUAL' }, '2026-10-05');
    expect(back.name).toBe('Joy');
    expect(back.amount).toBe('');
    expect(back.tracksTime).toBe(false);
    expect(back.employment).toBe('CASUAL');
    expect(back.startDate).toBe('2026-10-05');
  });
  it('mark a casual draft as casual', () => {
    expect(toDraft(filled({ employment: 'CASUAL' }), 3).kind).toBe('CASUAL');
  });
});

describe('step validation', () => {
  it('asks for the basics on step one', () => {
    const errors = validateStep('who', emptyHire('2026-10-05'), null);
    expect(Object.keys(errors).sort()).toEqual(['name', 'nationalId', 'phone']);
    expect(hasErrors(validateStep('who', filled(), null))).toBe(false);
  });
  it('refuses a position that takes no casuals', () => {
    const lookups = { positions: [{ id: 'p1', casualsAllowed: false }] } as never;
    expect(validateStep('job', filled({ employment: 'CASUAL' }), lookups).positionId).toBe('This position does not take casuals.');
  });
  it('wants the daily rate and day hours for a casual, the monthly pay and week hours otherwise', () => {
    expect(validateStep('pay', filled({ employment: 'CASUAL', amount: '', dayHours: '' }), null)).toMatchObject({ amount: 'Enter the daily rate in KES.', dayHours: 'Enter hours such as 8.' });
    expect(validateStep('pay', filled({ amount: '', weekHours: 'x' }), null)).toMatchObject({ amount: 'Enter the monthly pay in KES.', weekHours: 'Enter hours such as 48.' });
  });
  it('wants the bank and account for a bank payout only', () => {
    expect(Object.keys(validateStep('statutory', filled({ bankName: '', accountNumber: '' }), null))).toEqual(['bankName', 'accountNumber']);
    expect(hasErrors(validateStep('statutory', filled({ payoutMethod: 'CASH', bankName: '' }), null))).toBe(false);
  });
  it('wants a long enough password on the last step', () => {
    expect(validateStep('login', filled({ temporaryPassword: 'short' }), null).temporaryPassword).toContain('10');
  });
});

describe('figures', () => {
  it("matches Paper's hourly equivalent: KES 28,000 over 48 h is 134.62 an hour", () => {
    expect(hourlyEquivalent(false, '28000', '48', '8')).toBe('134.62');
    expect(hourlyEquivalent(true, '1200', '48', '8')).toBe('150.00');
    expect(hourlyEquivalent(false, '28000', '0', '8')).toBeNull();
    expect(hourlyEquivalent(false, 'abc', '48', '8')).toBeNull();
  });
  it('writes the working under the figure', () => {
    expect(hourlyWorking(false, '28000', '48', '8')).toBe('KES 28,000 ÷ (48 h × 52 weeks ÷ 12)');
  });
  it('ends probation on the same day three months later, and a short month on its last day', () => {
    expect(probationEndsOn('2026-10-05', 3, false)).toBe('2027-01-05');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(probationEndsOn('2026-10-05', 3, true)).toBeNull();
  });
});
