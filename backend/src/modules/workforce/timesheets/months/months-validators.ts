import { z } from 'zod';

const site = z.string().uuid().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const monthParams = z.object({ monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM') }).strict();
export const personParams = monthParams.extend({ employeeId: z.string().uuid() }).strict();

/** The months list: 5 a page as drawn (D21), a numbered pager under it. */
export const monthsQuery = z.object({ site, page: z.coerce.number().int().min(1).default(1), rows: z.coerce.number().int().min(1).max(24).default(5) }).strict();
export type MonthsQuery = z.infer<typeof monthsQuery>;

/** `from` and `to` (both or neither, inclusive Nairobi dates inside the month) narrow the figures to a week or any run of days. */
const range = {
  from: day.optional(),
  to: day.optional(),
};
const rangeChecks = <T extends { from?: string | undefined; to?: string | undefined }>(schema: z.ZodType<T>) =>
  schema
    .refine((q) => (q.from === undefined) === (q.to === undefined), { message: 'Give both from and to, or neither', path: ['to'] })
    .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, { message: 'The end cannot be before the start', path: ['to'] });

export const monthQuery = rangeChecks(z.object({ site, ...range }).strict());
export type MonthQuery = z.infer<typeof monthQuery>;

export const peopleQuery = rangeChecks(
  z
    .object({
      site,
      ...range,
      q: z.string().trim().max(80).optional(),
      dept: z.string().uuid().optional(),
      view: z.enum(['needs', 'late', 'all']).default('all'),
      sort: z.enum(['department', 'person', 'worked', 'overtime', 'late']).default('department'),
      dir: z.enum(['asc', 'desc']).default('asc'),
      page: z.coerce.number().int().min(1).default(1),
      rows: z.coerce.number().int().min(5).max(100).default(50),
    })
    .strict(),
);
export type PeopleQuery = z.infer<typeof peopleQuery>;

export const personQuery = rangeChecks(z.object({ site, ...range }).strict());
export type PersonQuery = z.infer<typeof personQuery>;

export const personDaysQuery = rangeChecks(
  z
    .object({
      site,
      ...range,
      view: z.enum(['all', 'needs', 'worked']).default('all'),
      page: z.coerce.number().int().min(1).default(1),
      rows: z.coerce.number().int().min(5).max(100).default(50),
    })
    .strict(),
);
export type PersonDaysQuery = z.infer<typeof personDaysQuery>;
