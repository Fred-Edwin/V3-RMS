import { describe, expect, it } from 'vitest';
import {
  ContractSchema,
  DuplicateQuerySchema,
  ExitSchema,
  HireBodySchema,
  LoanSchema,
  PayChangeDecisionSchema,
  PayChangeSchema,
  ProbationDecisionSchema,
  ProbationNoteSchema,
  StatutorySchema,
  UpdateEmployeeSchema,
} from './people-validators';

const uuid = '3f0c2c0e-5b1a-4a39-9d55-0d7f6a1e2b11';
const baseHire = {
  who: { name: 'Joy Wanjiru', phone: '0712 345 678', nationalId: '12345678' },
  job: { siteId: uuid, departmentId: uuid, positionId: uuid, employment: 'MONTHLY_WITH_CONTRACT', startDate: '2026-11-01' },
};

describe('the head’s probation report', () => {
  it('accepts Good, Needs work and Not good, with an optional note, and refuses anything else', () => {
    for (const verdict of ['GOOD', 'NEEDS_WORK', 'NOT_GOOD']) expect(ProbationNoteSchema.safeParse({ verdict, note: 'Late twice.' }).success).toBe(true);
    expect(ProbationNoteSchema.safeParse({ verdict: 'GOOD' }).success).toBe(true);
    expect(ProbationNoteSchema.safeParse({ verdict: 'FINE' }).success).toBe(false);
    expect(ProbationNoteSchema.safeParse({ verdict: 'GOOD', extra: 1 }).success).toBe(false);
  });
});

describe('people validators', () => {
  it('accepts a monthly hire and a casual hire without a login', () => {
    expect(HireBodySchema.safeParse(baseHire).success).toBe(true);
    expect(HireBodySchema.safeParse({ ...baseHire, job: { ...baseHire.job, employment: 'CASUAL' } }).success).toBe(true);
  });

  it('refuses a login, bank step or account for a casual', () => {
    const casual = { ...baseHire, job: { ...baseHire.job, employment: 'CASUAL' } };
    const login = { email: 'joy@example.com', loginRole: 'WAITER', temporaryPassword: 'a-long-password' };
    expect(HireBodySchema.safeParse({ ...casual, login }).success).toBe(false);
    expect(HireBodySchema.safeParse({ ...casual, statutory: { payoutMethod: 'CASH' } }).success).toBe(false);
    expect(HireBodySchema.safeParse({ ...casual, existingUserId: uuid }).success).toBe(false);
  });

  it('refuses a privileged login role at hire', () => {
    const login = { email: 'x@example.com', loginRole: 'MANAGER', temporaryPassword: 'a-long-password' };
    expect(HireBodySchema.safeParse({ ...baseHire, login }).success).toBe(false);
  });

  it('refuses a login for an account that already exists', () => {
    const login = { email: 'x@example.com', loginRole: 'WAITER', temporaryPassword: 'a-long-password' };
    expect(HireBodySchema.safeParse({ ...baseHire, existingUserId: uuid, login }).success).toBe(false);
  });

  it('checks the payout details', () => {
    expect(StatutorySchema.safeParse({ payoutMethod: 'BANK', bankName: 'Equity' }).success).toBe(false);
    expect(StatutorySchema.safeParse({ payoutMethod: 'BANK', bankName: 'Equity', accountNumber: '0123' }).success).toBe(true);
    expect(StatutorySchema.safeParse({ payoutMethod: 'MPESA' }).success).toBe(false);
    expect(StatutorySchema.safeParse({ payoutMethod: 'CASH' }).success).toBe(true);
  });

  it('wants money as a string with up to two decimals', () => {
    const ok = { amount: '28000.50', effectiveFrom: '2026-11-01', reason: 'PROMOTION', pin: '1234' };
    expect(PayChangeSchema.safeParse(ok).success).toBe(true);
    expect(PayChangeSchema.safeParse({ ...ok, amount: 28000 }).success).toBe(false);
    expect(PayChangeSchema.safeParse({ ...ok, amount: '28000.555' }).success).toBe(false);
    expect(PayChangeSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it('needs a note to decline a pay change', () => {
    expect(PayChangeDecisionSchema.safeParse({ decision: 'DECLINE', pin: '1234' }).success).toBe(false);
    expect(PayChangeDecisionSchema.safeParse({ decision: 'DECLINE', note: 'Not now', pin: '1234' }).success).toBe(true);
    expect(PayChangeDecisionSchema.safeParse({ decision: 'APPROVE', pin: '1234' }).success).toBe(true);
  });

  it('checks date order on contracts and loans', () => {
    expect(ContractSchema.safeParse({ startsOn: '2026-11-01', endsOn: '2026-10-01' }).success).toBe(false);
    expect(ContractSchema.safeParse({ startsOn: '2026-11-01' }).success).toBe(true);
    expect(LoanSchema.safeParse({ toSiteId: uuid, from: '2026-11-05', until: '2026-11-01' }).success).toBe(false);
    expect(LoanSchema.safeParse({ toSiteId: uuid, from: '2026-11-05', until: null }).success).toBe(true);
  });

  it('checks probation decisions', () => {
    expect(ProbationDecisionSchema.safeParse({ decision: 'CONFIRM' }).success).toBe(true);
    expect(ProbationDecisionSchema.safeParse({ decision: 'EXTEND', months: 2 }).success).toBe(false);
    expect(ProbationDecisionSchema.safeParse({ decision: 'EXTEND', months: 2, reason: 'Needs more time' }).success).toBe(true);
    expect(ProbationDecisionSchema.safeParse({ decision: 'EXTEND', months: 13, reason: 'x' }).success).toBe(false);
  });

  it('refuses an empty edit and unknown fields', () => {
    expect(UpdateEmployeeSchema.safeParse({}).success).toBe(false);
    expect(UpdateEmployeeSchema.safeParse({ departmentId: uuid }).success).toBe(false);
    expect(UpdateEmployeeSchema.safeParse({ personalPhone: '0712345678' }).success).toBe(true);
  });

  it('needs something to check for duplicates and a known exit reason', () => {
    expect(DuplicateQuerySchema.safeParse({}).success).toBe(false);
    expect(DuplicateQuerySchema.safeParse({ phone: '0712345678' }).success).toBe(true);
    expect(ExitSchema.safeParse({ lastDay: '2026-11-30', reason: 'FIRED' }).success).toBe(false);
    expect(ExitSchema.parse({ lastDay: '2026-11-30', reason: 'RESIGNED' }).uniformReturned).toBe(false);
  });
});
