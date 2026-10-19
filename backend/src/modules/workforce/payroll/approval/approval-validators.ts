import { z } from 'zod';

const version = z.number().int().min(0);
const idempotencyKey = z.string().trim().min(8).max(80);
const money = z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/, 'Use digits with up to 2 decimals');

/** A reason is read by HR and shown in the audit log: say what is wrong, not how much (no pay figure travels in free text). */
const reason = z
  .string()
  .trim()
  .min(5, 'Say why, in at least 5 characters')
  .max(280, 'Keep the reason to 280 characters')
  .refine((v) => !/\d{4,}/.test(v.replace(/[\s,.]/g, '')), 'Leave amounts out of the reason');

export const sendBody = z.object({ idempotencyKey, stateVersion: version }).strict();
export const sendBackBody = z.object({ reason, idempotencyKey, stateVersion: version }).strict();

export const approveBody = z
  .object({
    pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'),
    idempotencyKey,
    stateVersion: version,
    /** The figures the dialog showed; the server checks them against the fresh ones (CHANGED_UNDERNEATH). */
    expectedTotals: z.object({ gross: money, net: money, taxStatutory: money, other: money, headcount: z.number().int().min(0) }).strict(),
    handChecked: z.boolean().optional(),
  })
  .strict();
export type ApproveBody = z.infer<typeof approveBody>;

export const remindBody = z.object({ idempotencyKey }).strict();
export const lateApproveBody = z
  .object({
    pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'),
    idempotencyKey,
    expectedTotals: z.object({ workedMinutes: z.number().int().min(0), overtimeAuthorisedMinutes: z.number().int().min(0), headcount: z.number().int().min(0) }).strict(),
  })
  .strict();
export type LateApproveBody = z.infer<typeof lateApproveBody>;
