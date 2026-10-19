import { z } from 'zod';
import { daysBetween, parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .transform((value, ctx): NairobiDate => {
    try {
      return parseNairobiDate(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Not a real date' });
      return z.NEVER;
    }
  });

export const myTimeQuery = z.object({ periodId: z.string().uuid().optional() }).strict();
export type MyTimeQuery = z.infer<typeof myTimeQuery>;

export const myRotaQuery = z
  .object({ from: day.optional(), to: day.optional() })
  .strict()
  .refine((q) => !q.from || !q.to || (q.to >= q.from && daysBetween(q.from, q.to) <= 62), { message: 'Ask for up to 62 days, from the earlier day to the later', path: ['to'] });
export type MyRotaQuery = z.infer<typeof myRotaQuery>;
