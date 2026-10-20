import type { Request } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../../utils/errors';
import { parseNairobiDate, type NairobiDate } from '../_shared/time/nairobi-time';
import { ADJUST_MAX, ADJUST_MIN, ADJUST_REASONS, CANCEL_REASONS, DECLINE_REASONS, DEFAULT_PAGE_ROWS, MAX_PAGE_ROWS, MAX_REQUEST_DAYS, NOTE_MAX } from './leave.constants';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-26')
  .transform((value, ctx): NairobiDate => {
    try {
      return parseNairobiDate(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'That is not a real date' });
      return z.NEVER;
    }
  });
const note = z.string().trim().max(NOTE_MAX).optional();
const pin = z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits');
const typeCode = z.string().regex(/^[A-Z][A-Z_]{1,23}$/);
const page = z.coerce.number().int().min(1).max(10_000).default(1);
const rows = z.coerce.number().int().min(1).max(MAX_PAGE_ROWS).default(DEFAULT_PAGE_ROWS);
const flag = z.enum(['true', 'false', '1', '0']).transform((value) => value === 'true' || value === '1');

export const idParams = z.object({ id: z.string().uuid() }).strict();
export const employeeParams = z.object({ employeeId: z.string().uuid() }).strict();

export const previewBody = z.object({ typeCode, start: date, end: date, unpaidTailDays: z.number().int().min(0).max(MAX_REQUEST_DAYS).optional() }).strict();
export type PreviewBody = z.infer<typeof previewBody>;

export const askBody = previewBody.extend({ note }).strict();
export type AskBody = z.infer<typeof askBody>;

/** The person cancelling their own request sends nothing; a manager sends a reason and their PIN. */
export const cancelBody = z.object({ reasonCode: z.enum(CANCEL_REASONS).optional(), note, pin: pin.optional() }).strict();
export type CancelBody = z.infer<typeof cancelBody>;

export const approveBody = z.object({ pin, expectedVersion: z.number().int().min(1) }).strict();
export type ApproveBody = z.infer<typeof approveBody>;

export const declineBody = z
  .object({ reasonCode: z.enum(DECLINE_REASONS), note, expectedVersion: z.number().int().min(1) })
  .strict()
  .refine((body) => body.reasonCode !== 'OTHER' || (body.note?.length ?? 0) > 0, { message: 'Say why, in a few words', path: ['note'] });
export type DeclineBody = z.infer<typeof declineBody>;

const adjustCore = { employeeId: z.string().uuid(), typeCode, add: z.number().int().min(ADJUST_MIN).max(ADJUST_MAX).refine((n) => n !== 0, 'Nothing to change yet') };
export const adjustPreviewBody = z.object({ employeeId: adjustCore.employeeId, typeCode, add: adjustCore.add.optional() }).strict();
export const adjustBody = z
  .object({ ...adjustCore, reasonCode: z.enum(ADJUST_REASONS), note, pin, expectedNow: z.number().int().min(0).optional() })
  .strict()
  .refine((body) => body.reasonCode !== 'OTHER' || (body.note?.length ?? 0) > 0, { message: 'Say why, in a few words', path: ['note'] });
export type AdjustBody = z.infer<typeof adjustBody>;

const statusList = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean))
  .pipe(z.array(z.enum(['WAITING', 'APPROVED', 'DECLINED', 'CANCELLED'])).max(4));

export const mineQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional(), status: statusList.optional(), type: typeCode.optional(), q: z.string().trim().max(60).optional(), page, rows }).strict();
export const requestsQuery = z
  .object({ site: z.string().uuid().optional(), dept: z.string().uuid().optional(), status: statusList.optional(), tab: z.enum(['recent', 'needs-you']).optional(), q: z.string().trim().max(60).optional(), page, rows })
  .strict();
export const balancesQuery = z
  .object({ site: z.string().uuid().optional(), dept: z.string().uuid().optional(), filter: z.enum(['all', 'low', 'adjusted', 'booked']).default('all'), q: z.string().trim().max(60).optional(), year: z.coerce.number().int().min(2000).max(2100).optional(), leavers: flag.optional(), page, rows })
  .strict();
export const calendarQuery = z.object({ site: z.string().uuid().optional(), dept: z.string().uuid().optional(), from: date.optional() }).strict();
export const awayQuery = z.object({ from: date, to: date, site: z.string().uuid().optional() }).strict().refine((q) => q.to >= q.from, { message: 'The end is before the start', path: ['to'] });
export const needsYouQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(5) }).strict();
export const overviewQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }).strict();

/** The `Idempotency-Key` header (spec section 4). A missing key is a 400, never a silent double write. */
export function idempotencyKeyOf(req: Request): string {
  const value = (req.header('Idempotency-Key') ?? '').trim();
  if (value.length < 8 || value.length > 80) throw new ValidationError('Send an Idempotency-Key of 8 to 80 characters', 'IDEMPOTENCY_KEY_REQUIRED');
  return value;
}
