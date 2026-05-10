import { z } from 'zod';

const uuidParam = z.string().uuid('Route param must be a valid UUID');

export const payslipMoneySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Amount must be a valid decimal (e.g. 1500 or 1500.00)')
  .refine((value) => Number.parseFloat(value) >= 0, 'Amount must be zero or greater')
  .refine((value) => Number.parseFloat(value) <= 99_999_999.99, 'Amount must be less than or equal to 99,999,999.99');

const optionalPayslipMoneySchema = z.union([payslipMoneySchema, z.null()]);

export const payslipLineItemSchema = z.object({
  label: z.string().trim().min(1, 'Deduction note is required'),
  amount: payslipMoneySchema,
});

const payPeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'payPeriod must be in YYYY-MM format');

export const bulkUpsertRowSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  payDate: z.string().date('payDate must be a valid date'),
  grossPay: payslipMoneySchema,
  paye: payslipMoneySchema,
  sha: payslipMoneySchema,
  nssfTier1: payslipMoneySchema,
  nssfTier2: payslipMoneySchema,
  housingLevy: payslipMoneySchema,
  helb: optionalPayslipMoneySchema.optional(),
  advance: optionalPayslipMoneySchema.optional(),
  incentives: optionalPayslipMoneySchema.optional(),
  overtime: optionalPayslipMoneySchema.optional(),
  otherDeductions: z.array(payslipLineItemSchema).max(20).optional(),
});

export const bulkUpsertSchema = z.object({
  payPeriod: payPeriodSchema,
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  rows: z.array(bulkUpsertRowSchema).min(1).max(500),
});

export const publishSchema = z.object({
  payPeriod: payPeriodSchema,
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
});

export const revertSchema = z.object({
  payPeriod: payPeriodSchema,
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
});

export const payslipIdParamSchema = z.object({
  id: uuidParam,
});

export const payslipBranchIdParamSchema = z.object({
  branchId: uuidParam,
});

export const payslipListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(20),
  organizationId: z.string().uuid('organizationId must be a valid UUID').optional(),
  userId: z.string().uuid('userId must be a valid UUID').optional(),
  payPeriod: payPeriodSchema.optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export const payslipMineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const payslipBranchQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  payPeriod: payPeriodSchema.optional(),
  userId: z.string().uuid('userId must be a valid UUID').optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export type PayslipLineItemInput = z.infer<typeof payslipLineItemSchema>;
export type BulkUpsertRowInput = z.infer<typeof bulkUpsertRowSchema>;
export type BulkUpsertInput = z.infer<typeof bulkUpsertSchema>;
export type PublishInput = z.infer<typeof publishSchema>;
export type RevertInput = z.infer<typeof revertSchema>;
export type PayslipListQuery = z.infer<typeof payslipListQuerySchema>;
export type PayslipMineQuery = z.infer<typeof payslipMineQuerySchema>;
export type PayslipBranchQuery = z.infer<typeof payslipBranchQuerySchema>;
