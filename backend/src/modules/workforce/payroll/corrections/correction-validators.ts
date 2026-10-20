import { z } from 'zod';
import { MAX_ADJUSTMENT_AMOUNT } from '../engine/payroll-constants';
import { reasonField } from '../approval/approval-validators';
import { ADJUSTMENT_KINDS } from '../review/review-validators';

export const payslipParams = z.object({ monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), payslipId: z.string().uuid() }).strict();

const minutes = z.number().int().min(0).max(24 * 60 * 31);
const money = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Use digits with up to 2 decimals')
  .refine((v) => Number(v) >= 1 && Number(v) <= Number(MAX_ADJUSTMENT_AMOUNT), 'Use an amount from 1 to 10,000,000');

const extraLine = z
  .object({
    type: z.enum(ADJUSTMENT_KINDS),
    label: z.string().trim().min(1, 'Give the line a name').max(60),
    amount: money,
    taxable: z.boolean().default(false),
  })
  .strict();

/** P21: what can be corrected. Each kind carries only its own fields; the engine recomputes the payslip from them. */
export const correctionChange = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('LATE_DAYS'), changes: z.object({ lateDaysCounted: z.number().int().min(0).max(31) }).strict() }).strict(),
  z.object({ kind: z.literal('UNPAID_ABSENCE'), changes: z.object({ absentDays: z.number().min(0).max(31).multipleOf(0.5) }).strict() }).strict(),
  z.object({ kind: z.literal('OVERTIME'), changes: z.object({ ordinaryDay: minutes, restDay: minutes, publicHoliday: minutes }).strict() }).strict(),
  z.object({ kind: z.literal('BASIC'), changes: z.object({ amount: money }).strict() }).strict(),
  z
    .object({
      kind: z.literal('EXTRA_LINE'),
      changes: z.object({ add: z.array(extraLine).max(5).default([]), removeIds: z.array(z.string().min(1).max(80)).max(10).default([]) }).strict(),
    })
    .strict(),
]);
export type CorrectionChange = z.infer<typeof correctionChange>;

export const previewBody = z.object({ change: correctionChange, expectedVersion: z.number().int().min(1) }).strict();
export type PreviewBody = z.infer<typeof previewBody>;

export const correctBody = z
  .object({
    change: correctionChange,
    reason: reasonField,
    pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'),
    expectedVersion: z.number().int().min(1),
    idempotencyKey: z.string().trim().min(8).max(80),
  })
  .strict();
export type CorrectBody = z.infer<typeof correctBody>;
