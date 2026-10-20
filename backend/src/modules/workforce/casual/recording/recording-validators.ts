import { z } from 'zod';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';

export const idempotencyKey = z.string().trim().min(8).max(80);
const uuid = z.string().uuid();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24 hour time, like 07:00');
const workDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-19').transform((value, ctx) => {
  try {
    return parseNairobiDate(value);
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Not a real date' });
    return z.NEVER;
  }
});
const version = z.number().int().min(0);

/** A reason is read by the approver and kept in the audit log. */
export const reason = z.string().trim().min(5, 'Say why, in at least 5 characters').max(280, 'Keep the reason to 280 characters');

const nationalId = z.string().trim().regex(/^[A-Za-z0-9]{5,12}$/, 'Use the ID number: 5 to 12 letters or digits, no spaces');
const fullName = z
  .string()
  .trim()
  .min(3, "Add the worker's full name.")
  .max(80)
  .refine((v) => v.split(/\s+/).length >= 2, "Add the worker's full name.");

export const newCasualBody = z
  .object({
    fullName,
    nationalId,
    nationalIdConfirm: z.string().trim(),
    phone: z.string().trim().regex(/^\+?[0-9 ]{7,16}$/, 'Use digits, spaces and an optional +').optional(),
    idempotencyKey,
  })
  .strict()
  .refine((v) => v.nationalId.toUpperCase() === v.nationalIdConfirm.toUpperCase(), { message: 'The two ID numbers are different.', path: ['nationalIdConfirm'] });
export type NewCasualBody = z.infer<typeof newCasualBody>;

export const lineBody = z.object({ casualId: uuid, start: clock, end: clock, endsNextDay: z.boolean().optional() }).strict();

/** One call creates the day's sheet or replaces its lines. The sheet is found by site, department and day, so a phone with no signal can create it before it has an id. */
export const putLinesBody = z
  .object({ siteId: uuid, departmentId: uuid, date: workDate, version, idempotencyKey, lines: z.array(lineBody).max(60) })
  .strict();
export type PutLinesBody = z.infer<typeof putLinesBody>;

export const sheetQuery = z.object({ siteId: uuid, departmentId: uuid, date: workDate }).strict();
export const workersQuery = z.object({ siteId: uuid, departmentId: uuid, q: z.string().trim().max(60).optional() }).strict();
export const recentQuery = z.object({ siteId: uuid, departmentId: uuid.optional() }).strict();

export const sendBody = z.object({ version, idempotencyKey }).strict();
export const takeBackBody = z.object({ version, idempotencyKey }).strict();

export const correctionBody = z
  .object({
    casualId: uuid,
    originalDate: workDate,
    amount: z.string().regex(/^-?\d{1,6}$/, 'Use whole shillings, like -200 or 150').refine((v) => Number(v) !== 0, 'A correction cannot be zero'),
    reason,
    version,
    idempotencyKey,
  })
  .strict();
export type CorrectionBody = z.infer<typeof correctionBody>;
export const removeCorrectionBody = z.object({ version, idempotencyKey }).strict();

export const sheetParams = z.object({ id: uuid }).strict();
export const correctionParams = z.object({ id: uuid, correctionId: uuid }).strict();
