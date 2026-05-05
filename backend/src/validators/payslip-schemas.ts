import { z } from 'zod';

const uuidParam = z.string().uuid('Route param must be a valid UUID');
const cuidParam = z.string().cuid('Route param must be a valid payslip ID');

export const payslipMoneySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Amount must be a valid decimal (e.g. 1500 or 1500.00)')
  .refine((value) => Number.parseFloat(value) >= 0, 'Amount must be zero or greater')
  .refine((value) => Number.parseFloat(value) <= 99_999_999.99, 'Amount must be less than or equal to 99,999,999.99');

export const payslipLineItemSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100, 'Label is too long'),
  amount: payslipMoneySchema,
});

const optionalPayslipMoneySchema = z.union([payslipMoneySchema, z.null()]);

const payPeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'payPeriod must be in YYYY-MM format');

export const createPayslipSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  payPeriod: payPeriodSchema,
  payDate: z.string().date('payDate must be a valid date'),
  basicSalary: payslipMoneySchema,
  houseAllowance: optionalPayslipMoneySchema.optional(),
  transportAllowance: optionalPayslipMoneySchema.optional(),
  otherAllowances: z.array(payslipLineItemSchema).max(20).optional(),
  paye: payslipMoneySchema,
  nssf: payslipMoneySchema,
  housingLevy: payslipMoneySchema,
  helb: optionalPayslipMoneySchema.optional(),
  otherDeductions: z.array(payslipLineItemSchema).max(20).optional(),
});

export const updatePayslipSchema = z
  .object({
    userId: z.string().uuid('userId must be a valid UUID').optional(),
    payPeriod: payPeriodSchema.optional(),
    payDate: z.string().date('payDate must be a valid date').optional(),
    basicSalary: payslipMoneySchema.optional(),
    houseAllowance: optionalPayslipMoneySchema.optional(),
    transportAllowance: optionalPayslipMoneySchema.optional(),
    otherAllowances: z.array(payslipLineItemSchema).max(20).optional(),
    paye: payslipMoneySchema.optional(),
    nssf: payslipMoneySchema.optional(),
    housingLevy: payslipMoneySchema.optional(),
    helb: optionalPayslipMoneySchema.optional(),
    otherDeductions: z.array(payslipLineItemSchema).max(20).optional(),
  })
  .refine(
    (data) =>
      data.userId !== undefined ||
      data.payPeriod !== undefined ||
      data.payDate !== undefined ||
      data.basicSalary !== undefined ||
      data.houseAllowance !== undefined ||
      data.transportAllowance !== undefined ||
      data.otherAllowances !== undefined ||
      data.paye !== undefined ||
      data.nssf !== undefined ||
      data.housingLevy !== undefined ||
      data.helb !== undefined ||
      data.otherDeductions !== undefined,
    { message: 'At least one field must be provided' },
  );

export const payslipIdParamSchema = z.object({
  id: cuidParam,
});

export const payslipBranchIdParamSchema = z.object({
  branchId: uuidParam,
});

export const payslipListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  organizationId: z.string().uuid('organizationId must be a valid UUID').optional(),
  userId: z.string().uuid('userId must be a valid UUID').optional(),
  payPeriod: payPeriodSchema.optional(),
  status: z.enum(['DRAFT', 'LOCKED']).optional(),
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
  status: z.enum(['DRAFT', 'LOCKED']).optional(),
});

export type PayslipLineItemInput = z.infer<typeof payslipLineItemSchema>;
export type CreatePayslipInput = z.infer<typeof createPayslipSchema>;
export type UpdatePayslipInput = z.infer<typeof updatePayslipSchema>;
export type PayslipListQuery = z.infer<typeof payslipListQuerySchema>;
export type PayslipMineQuery = z.infer<typeof payslipMineQuerySchema>;
export type PayslipBranchQuery = z.infer<typeof payslipBranchQuerySchema>;
