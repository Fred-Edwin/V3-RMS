import { z } from 'zod';

export const TEAM_STATUSES = ['all', 'on_shift', 'not_on_shift'] as const;

export const TeamQuerySchema = z.object({
  siteId: z.uuid().optional(),
  status: z.enum(TEAM_STATUSES).default('all'),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
