import { z } from 'zod';
import { ALERT_KINDS } from './security-types';

/** The phone's own random id, kept in its local storage. Opaque: the server only hashes and compares it. */
export const deviceId = z.string().trim().regex(/^[A-Za-z0-9._-]{8,64}$/, 'Not a device id');
const idempotencyKey = z.string().trim().min(8).max(64);

export const seenBody = z.object({ deviceId }).strict();
export const answerBody = z.object({ deviceId, answer: z.enum(['REMEMBER', 'ONCE']), idempotencyKey }).strict();
export const wasntMeBody = z.object({ deviceId: deviceId.optional(), entryId: z.string().uuid().optional(), idempotencyKey }).strict();
export const idParam = z.object({ id: z.string().uuid() }).strict();

export const clearBody = z.object({ note: z.string().trim().min(3, 'Write at least a few words.').max(300), idempotencyKey }).strict();

export const alertsQuery = z
  .object({
    status: z.enum(['OPEN', 'CLEARED']).optional(),
    kind: z.enum(ALERT_KINDS).optional(),
    siteId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().refine((n) => [10, 25, 50, 100].includes(n), 'Rows per page: 10, 25, 50 or 100').default(25),
  })
  .strict();
