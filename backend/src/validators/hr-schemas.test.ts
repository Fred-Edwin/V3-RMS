import { describe, expect, it } from 'vitest';
import {
  selfServiceProfileSchema,
  createContractTypeSchema,
  updateContractTypeSchema,
  assignContractSchema,
} from './hr-schemas';

describe('selfServiceProfileSchema', () => {
  it('accepts the personal-field allowlist', () => {
    const result = selfServiceProfileSchema.safeParse({
      nationalId: '12345678',
      dateOfBirth: '1995-06-01T00:00:00.000Z',
      personalPhone: '0712345678',
      personalEmail: 'jane@example.com',
      physicalAddress: 'Nyeri',
      emergencyName: 'John',
      emergencyRelation: 'Brother',
      emergencyPhone: '0700000000',
      kraPIN: 'A012345678Z',
      bankName: 'Equity',
      accountNumber: '1234567890',
      accountName: 'Jane Waiter',
      bankBranch: 'Nyeri',
      helbNumber: 'H-123',
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['employmentType', 'FULL_TIME'],
    ['contractTypeId', '11111111-1111-4111-8111-111111111111'],
    ['startDate', '2026-01-01T00:00:00.000Z'],
    ['endDate', '2026-12-31T00:00:00.000Z'],
    ['probationEndDate', '2026-03-01T00:00:00.000Z'],
    ['jobTitle', 'Head Chef'],
    ['reportingManagerId', '11111111-1111-4111-8111-111111111111'],
    ['notes', 'sneaky self-promotion'],
  ])('rejects HR-only field %s instead of silently ignoring it', (field, value) => {
    const result = selfServiceProfileSchema.safeParse({
      personalPhone: '0712345678',
      [field]: value,
    });
    expect(result.success).toBe(false);
  });
});

describe('contract type schemas', () => {
  it('requires at least one leave policy entry on create', () => {
    expect(
      createContractTypeSchema.safeParse({ name: '6-Month Contract', leavePolicies: [] }).success,
    ).toBe(false);
  });

  it('rejects duplicate leave types in a policy set', () => {
    const result = createContractTypeSchema.safeParse({
      name: '6-Month Contract',
      leavePolicies: [
        { leaveType: 'ANNUAL', totalDays: 10 },
        { leaveType: 'ANNUAL', totalDays: 5 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid create payload', () => {
    const result = createContractTypeSchema.safeParse({
      name: '1-Year Contract',
      durationMonths: 12,
      leavePolicies: [
        { leaveType: 'ANNUAL', totalDays: 21 },
        { leaveType: 'SICK', totalDays: 10 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('allows partial updates without a policy set', () => {
    expect(updateContractTypeSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe('assignContractSchema', () => {
  it('accepts a uuid or null', () => {
    expect(
      assignContractSchema.safeParse({ contractTypeId: '11111111-1111-4111-8111-111111111111' })
        .success,
    ).toBe(true);
    expect(assignContractSchema.safeParse({ contractTypeId: null }).success).toBe(true);
  });

  it('rejects a missing contractTypeId', () => {
    expect(assignContractSchema.safeParse({}).success).toBe(false);
  });
});
