import { z } from 'zod';
import { EVENT_CODES } from './audit-visibility';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-19.');
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const PAGE_SIZES = [25, 50, 100] as const;
export const MAX_PAGE_WITHOUT_DATES = 200;

/** The A1 query. Unknown keys are refused. `from` and `to` are inclusive Nairobi days. */
export const listQuery = z
  .object({
    area: z.enum(['WORKFORCE', 'ACCESS']).optional(),
    event: z.enum(['all', ...EVENT_CODES]).default('all'),
    siteId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
    subjectUserId: z.string().uuid().optional(),
    from: day.optional(),
    to: day.optional(),
    flagged: bool.optional(),
    q: z.string().trim().max(80).optional(),
    sort: z.enum(['newest', 'oldest']).default('newest'),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().refine((n) => (PAGE_SIZES as readonly number[]).includes(n), 'Rows per page: 25, 50 or 100.').default(50),
  })
  .strict();
export type ListQuery = z.infer<typeof listQuery>;

export const exportQuery = listQuery.omit({ page: true, pageSize: true });
export type ExportQuery = z.infer<typeof exportQuery>;

export const idParam = z.object({ id: z.string().uuid() }).strict();
export const actorsQuery = z.object({ q: z.string().trim().min(1).max(60) }).strict();

export const chainBody = z
  .object({ fromSeq: z.coerce.number().int().min(1), toSeq: z.coerce.number().int().min(1) })
  .strict()
  .refine((b) => b.toSeq >= b.fromSeq, { message: 'toSeq must not be before fromSeq.', path: ['toSeq'] });
export const MAX_CHAIN_ENTRIES = 200_000;

export const myRecordQuery = z
  .object({
    event: z.enum(['all', 'pay', 'time', 'leave', 'signins', 'file', 'conduct']).default('all'),
    from: day.optional(),
    to: day.optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type MyRecordQuery = z.infer<typeof myRecordQuery>;

export const answerBody = z.object({ answer: z.enum(['ME', 'NOT_ME']), idempotencyKey: z.string().min(8).max(80), deviceId: z.string().regex(/^[A-Za-z0-9._-]{8,64}$/).optional() }).strict();
