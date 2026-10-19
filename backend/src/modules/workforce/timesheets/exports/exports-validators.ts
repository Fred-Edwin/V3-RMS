import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/**
 * `scope: 'range'` needs `from` and `to` inside the month. `employeeId` makes a one-person extract (the full-month page).
 * The idempotency key makes a repeat of the same request one audit entry (a double tap, a retry after a lost response).
 */
export const exportBody = z
  .object({
    format: z.enum(['pdf', 'xlsx']),
    scope: z.enum(['month', 'range']).default('month'),
    from: day.optional(),
    to: day.optional(),
    employeeId: z.string().uuid().optional(),
    idempotencyKey: z.string().trim().min(8).max(80),
    site: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.scope === 'range' && (body.from === undefined || body.to === undefined)) ctx.addIssue({ code: 'custom', path: ['from'], message: 'Give both from and to for a range' });
    if (body.scope === 'month' && (body.from !== undefined || body.to !== undefined)) ctx.addIssue({ code: 'custom', path: ['scope'], message: 'from and to are for a range' });
    if (body.from !== undefined && body.to !== undefined && body.from > body.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'The end cannot be before the start' });
  });
export type ExportBody = z.infer<typeof exportBody>;
