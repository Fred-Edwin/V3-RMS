import { describe, expect, it } from 'vitest';
import {
  bulkUpsertSchema,
  payslipListQuerySchema,
} from '../src/validators/payslip-schemas';
import { computePayslipTotals } from '../src/services/payslip-service';

// Zod 4 requires valid UUID format: version digit 1-8, variant bits 8/9/a/b
const ORG_ID = 'a0000000-0000-4000-8000-000000000001';
const USER_ID = 'b0000000-0000-4000-8000-000000000002';

describe('Payslip Zod schemas', () => {
  describe('bulkUpsertSchema', () => {
    const validRow = {
      userId: USER_ID,
      payDate: '2026-05-31',
      grossPay: '50000',
      paye: '8000',
      sha: '500',
      nssfTier1: '420',
      nssfTier2: '0',
      housingLevy: '750',
    };

    it('accepts a valid bulk upsert payload', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05',
        organizationId: ORG_ID,
        rows: [validRow],
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional fields (advance, overtime, incentives, allowances)', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05',
        organizationId: ORG_ID,
        rows: [{ ...validRow, advance: '5000', overtime: '2000', incentives: '1500', allowances: '800' }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative allowances', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05',
        organizationId: ORG_ID,
        rows: [{ ...validRow, allowances: '-500' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects otherDeductions with empty label', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05',
        organizationId: ORG_ID,
        rows: [{ ...validRow, otherDeductions: [{ label: '', amount: '1000' }] }],
      });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error)).toContain('Deduction note is required');
    });

    it('rejects otherDeductions with missing label field', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05',
        organizationId: ORG_ID,
        rows: [{ ...validRow, otherDeductions: [{ amount: '1000' }] }],
      });
      expect(result.success).toBe(false);
    });

    it('accepts otherDeductions with a valid label', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05',
        organizationId: ORG_ID,
        rows: [{ ...validRow, otherDeductions: [{ label: 'Uniform recovery', amount: '500' }] }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid payPeriod format (DD-MM-YYYY)', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '05-2026',
        organizationId: ORG_ID,
        rows: [validRow],
      });
      expect(result.success).toBe(false);
    });

    it('rejects payPeriod with day component', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05-31',
        organizationId: ORG_ID,
        rows: [validRow],
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty rows array', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05',
        organizationId: ORG_ID,
        rows: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative amounts', () => {
      const result = bulkUpsertSchema.safeParse({
        payPeriod: '2026-05',
        organizationId: ORG_ID,
        rows: [{ ...validRow, grossPay: '-5000' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('payslipListQuerySchema', () => {
    it('accepts PUBLISHED as a valid status', () => {
      const result = payslipListQuerySchema.safeParse({ status: 'PUBLISHED' });
      expect(result.success).toBe(true);
    });

    it('accepts DRAFT as a valid status', () => {
      const result = payslipListQuerySchema.safeParse({ status: 'DRAFT' });
      expect(result.success).toBe(true);
    });

    it('rejects LOCKED as a status (old value, now replaced by PUBLISHED)', () => {
      const result = payslipListQuerySchema.safeParse({ status: 'LOCKED' });
      expect(result.success).toBe(false);
    });

    it('accepts no status (all statuses)', () => {
      const result = payslipListQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('computePayslipTotals', () => {
    it('deducts advances and adds incentives, overtime, and allowances to net pay', () => {
      const result = computePayslipTotals({
        userId: USER_ID,
        payDate: '2026-05-31',
        grossPay: '10000',
        paye: '0',
        sha: '0',
        nssfTier1: '0',
        nssfTier2: '0',
        housingLevy: '0',
        advance: '1000',
        incentives: '500',
        overtime: '300',
        allowances: '200',
      });

      expect(result.totalDeductions.toFixed(2)).toBe('1000.00');
      expect(result.netPay.toFixed(2)).toBe('10000.00');
    });
  });
});
