import { z } from 'zod';

export const TIME_TAB_FILTERS = ['all', 'late', 'overtime', 'absent'] as const;
export type TimeTabFilter = (typeof TIME_TAB_FILTERS)[number];

/** The page sizes the table kit offers. */
export const TIME_TAB_PAGE_SIZES = [10, 25, 50] as const;

const MonthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

const intFrom = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, 'Use a whole number')
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

/** A person's month on the Time tab: `month` is "2026-10"; the filter, page and page size come from the chips and the pager. */
export const timeMonthQuerySchema = z
  .object({
    employeeId: z.string().uuid(),
    month: MonthKey,
    filter: z.enum(TIME_TAB_FILTERS).default('all'),
    page: intFrom(1, 100).default(1),
    pageSize: intFrom(1, 50)
      .refine((n) => (TIME_TAB_PAGE_SIZES as readonly number[]).includes(n), 'Use 10, 25 or 50')
      .default(10),
  })
  .strict();
export type TimeMonthQuery = z.infer<typeof timeMonthQuerySchema>;

/** The Overview tiles for one person. */
export const timeTilesQuerySchema = z.object({ employeeId: z.string().uuid() }).strict();
export type TimeTilesQuery = z.infer<typeof timeTilesQuerySchema>;
