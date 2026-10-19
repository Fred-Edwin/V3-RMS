import { z } from 'zod';
import { RULE_SCHEMAS } from '../rules-schemas';

const groups = Object.keys(RULE_SCHEMAS) as [keyof typeof RULE_SCHEMAS, ...(keyof typeof RULE_SCHEMAS)[]];

export const EffectiveQuerySchema = z.object({
  siteId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const GroupParamsSchema = z.object({ group: z.enum(groups) });

/** A tab: the site to look at (absent = the company rule; a holder limited to one site always gets their own). */
export const PageQuerySchema = z.object({ siteId: z.string().uuid().optional() });

/** History: the numbered pager of the table convention (25 a page by default). */
export const HistoryQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 25, 50, 100].includes(n), 'Use 10, 25, 50 or 100')
    .default(25),
});
