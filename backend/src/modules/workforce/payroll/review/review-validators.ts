import { z } from 'zod';
import { MAX_ADJUSTMENT_AMOUNT } from '../engine/payroll-constants';

export const monthParams = z.object({ monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).strict();
export const lineParams = monthParams.extend({ lineId: z.string().uuid() }).strict();
export const adjustmentParams = monthParams.extend({ id: z.string().uuid() }).strict();

const version = z.number().int().min(0);
const reason = z.string().trim().min(5, 'Say why, in at least 5 characters').max(280, 'Keep the reason to 280 characters');
const idempotencyKey = z.string().trim().min(8).max(80);

export const reviewQuery = z
  .object({
    kind: z.string().trim().max(40).optional(),
    state: z.enum(['OPEN', 'CHECKED']).optional(),
    severity: z.enum(['BLOCK', 'TICK']).optional(),
    q: z.string().trim().max(80).optional(),
    siteId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    rows: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n), 'Rows per page is 25, 50 or 100').default(50),
  })
  .strict();
export type ReviewQuery = z.infer<typeof reviewQuery>;

export const checkBody = z.object({ checked: z.boolean(), stateVersion: version }).strict();
export const checkKindBody = z.object({ kind: z.string().trim().min(1).max(40), stateVersion: version }).strict();
export const leaveOutBody = z.object({ reason, stateVersion: version, idempotencyKey }).strict();
export const recalculateBody = z.object({ idempotencyKey, stateVersion: version }).strict();

export const ADJUSTMENT_KINDS = ['ALLOWANCE', 'INCENTIVE', 'ARREARS', 'OTHER_EARNING', 'ADVANCE_REPAID', 'HELB', 'OTHER_DEDUCTION'] as const;
const amount = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Use digits with up to 2 decimals')
  .refine((v) => Number(v) >= 1 && Number(v) <= Number(MAX_ADJUSTMENT_AMOUNT), 'Use an amount from 1 to 10,000,000');
export const adjustmentBody = z
  .object({
    employeeId: z.string().uuid(),
    type: z.enum(ADJUSTMENT_KINDS),
    label: z.string().trim().min(1, 'Give the line a name').max(60),
    amount,
    taxable: z.boolean(),
    reason,
    pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'),
    idempotencyKey,
    stateVersion: version,
  })
  .strict();
export type AdjustmentBody = z.infer<typeof adjustmentBody>;
export const removeAdjustmentBody = z.object({ stateVersion: version, idempotencyKey }).strict();
