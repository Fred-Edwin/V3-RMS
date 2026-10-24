import { describe, expect, it } from 'vitest';
import { ABOVE_STORE_MANAGER, hiddenFromUnitManager, inScope, type AccessSubject } from '../../_shared/workforce-access';
import { mayHireInto } from '../people-access';
import { LENIENT_NUMBER_PATTERN, KRA_PIN_PATTERN, payoutAllowed } from '../rules/statutory-formats';
import { HireBodySchema, PatchMeSchema, PayChangeDecisionSchema, PayChangeSchema, PayProfileSchema, StatutorySchema } from '../people-validators';

const storeManager: AccessSubject = { id: 'u1', role: 'STORE_MANAGER', siteId: 'hub' };
const branchManager: AccessSubject = { id: 'u2', role: 'MANAGER', siteId: 'town' };

describe('statutory number formats (findings 21 and 65)', () => {
  it('KRA PIN is a letter, nine digits and a letter', () => {
    expect(StatutorySchema.safeParse({ payoutMethod: 'MPESA', mpesaPhone: '0712345678', kraPin: '123' }).success).toBe(false);
    const ok = StatutorySchema.parse({ payoutMethod: 'MPESA', mpesaPhone: '0712345678', kraPin: ' a123456789b ' });
    expect(ok.kraPin).toBe('A123456789B');
    expect(KRA_PIN_PATTERN.test('A12345678B')).toBe(false);
  });

  it('NSSF and SHA refuse junk but accept the numbers already on file', () => {
    expect(PatchMeSchema.safeParse({ nssfNumber: 'ab' }).success).toBe(false);
    expect(PatchMeSchema.safeParse({ shaNumber: 'x' }).success).toBe(false);
    expect(PatchMeSchema.safeParse({ nssfNumber: '900037' }).success).toBe(true);
    expect(PatchMeSchema.safeParse({ shaNumber: '5000091' }).success).toBe(true);
    expect(LENIENT_NUMBER_PATTERN.test('abcdefgh')).toBe(false); // letters only: no five digits
  });

  it('a person may now send their own ID, bank and account number', () => {
    expect(PatchMeSchema.safeParse({ nationalId: '12345678', bankName: 'KCB', accountNumber: '1100223344' }).success).toBe(true);
  });
});

describe('payout method set (findings 1 and 22)', () => {
  it('Cash is for casual staff only; the hire and the pay profile apply the same rule', () => {
    expect(payoutAllowed(false, 'CASH')).toBe(false);
    expect(payoutAllowed(false, 'BANK')).toBe(true);
    expect(payoutAllowed(false, 'MPESA')).toBe(true);
    expect(payoutAllowed(true, 'CASH')).toBe(true);
    expect(PayProfileSchema.safeParse({ payoutMethod: 'CASH' }).success).toBe(true); // the service decides by pay type
  });

  it('a monthly hire with cash is refused with the plain message', () => {
    const body = {
      who: { name: 'Test Person', phone: '0712345678', nationalId: '12345678' },
      job: { siteId: crypto.randomUUID(), departmentId: crypto.randomUUID(), positionId: crypto.randomUUID(), employment: 'MONTHLY_NO_CONTRACT_YET', startDate: '2026-11-01' },
      statutory: { payoutMethod: 'CASH' },
    };
    const parsed = HireBodySchema.safeParse(body);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain('Cash is only for casual staff');
  });
});

describe('a PIN on a pay change (Q1)', () => {
  it('both the request and the decision need a 4-digit PIN', () => {
    expect(PayChangeSchema.safeParse({ amount: '50000', effectiveFrom: '2026-11-01', reason: 'PROMOTION' }).success).toBe(false);
    expect(PayChangeSchema.safeParse({ amount: '50000', effectiveFrom: '2026-11-01', reason: 'PROMOTION', pin: '1234' }).success).toBe(true);
    expect(PayChangeDecisionSchema.safeParse({ decision: 'APPROVE' }).success).toBe(false);
    expect(PayChangeDecisionSchema.safeParse({ decision: 'APPROVE', pin: '12' }).success).toBe(false);
    expect(PayChangeDecisionSchema.safeParse({ decision: 'APPROVE', pin: '1234' }).success).toBe(true);
  });
});

describe('a Store Manager does not reach people above the manager (finding 55)', () => {
  it('head-office and company-level logins are out of the unit scope; floor staff are in', () => {
    for (const role of ABOVE_STORE_MANAGER) {
      expect(hiddenFromUnitManager(storeManager, role)).toBe(true);
      expect(inScope(storeManager, 'employee.read_basic', { userId: 'x', siteId: 'hub', userRole: role })).toBe(false);
    }
    expect(inScope(storeManager, 'employee.read_basic', { userId: 'x', siteId: 'hub', userRole: 'STORE_ATTENDANT' })).toBe(true);
    expect(inScope(storeManager, 'employee.read_basic', { userId: null, siteId: 'hub', userRole: null })).toBe(true);
  });

  it('conduct cannot be issued to or read about someone above the manager', () => {
    expect(inScope(storeManager, 'discipline.issue', { userId: 'x', siteId: 'hub', userRole: 'DIRECTOR' })).toBe(false);
    expect(inScope(storeManager, 'discipline.read', { userId: 'x', siteId: 'hub', userRole: 'HR_MANAGER' })).toBe(false);
  });

  it('a Branch Manager is not narrowed by this rule', () => {
    expect(inScope(branchManager, 'employee.read_basic', { userId: 'x', siteId: 'town', userRole: 'WAITER' })).toBe(true);
  });
});

describe('a Store Manager is offered only positions they may create (finding 56)', () => {
  it('floor positions yes, Branch Manager, Store Manager and head-office positions no', () => {
    expect(mayHireInto(storeManager, { loginRole: 'STORE_ATTENDANT' })).toBe(true);
    expect(mayHireInto(storeManager, { loginRole: null })).toBe(true);
    for (const role of ['MANAGER', 'STORE_MANAGER', 'DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT'] as const) {
      expect(mayHireInto(storeManager, { loginRole: role })).toBe(false);
    }
    expect(mayHireInto(branchManager, { loginRole: 'WAITER' })).toBe(true);
  });
});
