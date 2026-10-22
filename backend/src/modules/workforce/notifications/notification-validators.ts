import { z } from 'zod';
import { NOTIFICATION_AREAS } from './notification-types';

export const listQuery = z
  .object({
    unread: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    area: z.enum(NOTIFICATION_AREAS).optional(),
    q: z.string().trim().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().refine((n) => [10, 25, 50, 100].includes(n), 'Rows per page: 10, 25, 50 or 100').default(25),
  })
  .strict();

export const readBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).strict();
