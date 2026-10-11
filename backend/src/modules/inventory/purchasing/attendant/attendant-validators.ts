import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date');
const q = z.string().trim().max(100);
const page = z.coerce.number().int().min(1).max(10_000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const MyOrdersQuerySchema = z.object({
  filter: z.enum(['all', 'needs', 'waiting', 'overdue']).default('all'),
  q: q.optional(),
});

/** Both dates are optional: no dates means the last 30 days. A missing `to` is today. */
export const HistoryQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(['all', 'paid', 'cancelled']).default('all'),
  q: q.optional(),
  raisedBy: z.string().uuid().optional(),
  page,
  pageSize,
});

export const SearchQuerySchema = z.object({ q: z.string().trim().min(1, 'Type something to search for.').max(60) });

export const RestockLevelsQuerySchema = z.object({
  status: z.enum(['OUT', 'LOW', 'OK']).optional(),
  supplierId: z.string().uuid().optional(),
  q: q.optional(),
  page,
  pageSize,
});

export const NoticesQuerySchema = z.object({ filter: z.enum(['all', 'unread', 'needs']).default('all') });

export const MarkReadSchema = z.object({ keys: z.array(z.string().min(1).max(120)).min(1).max(200) });

export type MyOrdersQuery = z.infer<typeof MyOrdersQuerySchema>;
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
export type RestockLevelsQuery = z.infer<typeof RestockLevelsQuerySchema>;
export type NoticesQuery = z.infer<typeof NoticesQuerySchema>;
