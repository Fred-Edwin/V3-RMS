import { z } from 'zod';

/** `GET /inventory/audit-log` (API_CONTRACT.md §30.12). Dates are ISO timestamps; `to` is exclusive. */
export const AuditLogQuerySchema = z
  .object({
    area: z.enum(['CATALOG', 'SUPPLIERS', 'RESTOCK_LEVELS', 'PURCHASING', 'PAYMENTS']).optional(),
    actorId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((q) => !q.from || !q.to || q.from < q.to, { message: '`from` must be before `to`', path: ['from'] });

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
