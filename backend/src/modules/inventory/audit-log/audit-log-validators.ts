import { z } from 'zod';
import { AUDIT_AREAS } from './audit-log.types';

/**
 * `GET /inventory/audit-log` (API_CONTRACT.md §30.12). Dates are ISO timestamps; `to` is exclusive.
 * `branchId` (Lane 0, hub roles) narrows to one branch: only the sources that belong to a branch answer (restock levels set
 * there, and the Branches areas as each is built).
 */
export const AuditLogQuerySchema = z
  .object({
    area: z.enum(AUDIT_AREAS).optional(),
    actorId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((q) => !q.from || !q.to || q.from < q.to, { message: '`from` must be before `to`', path: ['from'] });

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
