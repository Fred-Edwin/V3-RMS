import { z } from 'zod';

const siteId = z.string().uuid().optional();

export const periodListQuery = z.object({ siteId }).strict();
export type PeriodListQuery = z.infer<typeof periodListQuery>;

/** Search and filters first, a numbered pager with rows per page (UI_BUILD_RULES 4a). */
export const periodQuery = z
  .object({
    search: z.string().trim().max(80).optional(),
    departmentId: z.string().uuid().optional(),
    filter: z.enum(['ALL', 'NEEDS_LOOK', 'LATE']).default('ALL'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(25),
  })
  .strict();
export type PeriodQuery = z.infer<typeof periodQuery>;

export const closeBody = z.object({ confirmCarry: z.boolean().default(false) }).strict();
export type CloseBody = z.infer<typeof closeBody>;

export const reopenBody = z.object({ reason: z.string().trim().min(3, 'Say why').max(300) }).strict();
export type ReopenBody = z.infer<typeof reopenBody>;

export const signBody = z.object({ pin: z.string().regex(/^\d{4}$/, 'Your signing code is 4 digits') }).strict();
export type SignBody = z.infer<typeof signBody>;

export const idParam = z.object({ id: z.string().uuid() }).strict();
