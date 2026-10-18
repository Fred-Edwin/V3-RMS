import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const instant = z.string().datetime({ offset: true });
const note = z.string().trim().min(3, 'Say what happened').max(300);

/**
 * Report a problem (Chapter 9, step 2): what went wrong, the correct time if the person knows it, one line. A clock
 * correction names the event that is wrong (`type`) and what it should be (`at`); "I worked but it is not recorded"
 * gives both times; "clocked out by mistake" needs no time (the clock-out is taken away) or the real clock-out time.
 */
export const createRequestBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CLOCK_TIME_WRONG'), date: day, type: z.enum(['IN', 'OUT']), at: instant, note }).strict(),
  z.object({ kind: z.literal('WORKED_NOT_RECORDED'), date: day, clockIn: instant, clockOut: instant, note }).strict(),
  z.object({ kind: z.literal('CLOCKED_OUT_BY_MISTAKE'), date: day, at: instant.optional(), note }).strict(),
  z.object({ kind: z.literal('ROTA_WRONG'), date: day, note }).strict(),
  z.object({ kind: z.literal('OVERTIME_MISSING'), date: day, minutes: z.number().int().min(5).max(720).optional(), note }).strict(),
  z.object({ kind: z.literal('PAY_OTHER'), date: day, note }).strict(),
]);
export type CreateRequestBody = z.infer<typeof createRequestBody>;

export const requestParams = z.object({ id: z.string().uuid() }).strict();

export const myRequestsQuery = z.object({ state: z.enum(['OPEN', 'ALL']).default('ALL') }).strict();

export const inboxQuery = z
  .object({
    siteId: z.string().uuid().optional(),
    state: z.enum(['WAITING', 'ANSWERED', 'ALL']).default('WAITING'),
    search: z.string().trim().max(80).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(25),
  })
  .strict();
export type InboxQuery = z.infer<typeof inboxQuery>;

/** Accept (the timesheet changes, with an audit entry) or decline with a reason. */
export const requestDecisionBody = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('APPROVE'), reason: z.string().trim().max(300).optional() }).strict(),
  z.object({ outcome: z.literal('DECLINE'), reason: z.string().trim().min(3, 'Say why').max(300) }).strict(),
]);
export type RequestDecisionBody = z.infer<typeof requestDecisionBody>;
