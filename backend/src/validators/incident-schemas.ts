import { IncidentType } from '@prisma/client';
import { z } from 'zod';

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const IncidentQuerySchema = z.object({
  type: z.nativeEnum(IncidentType).optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  orderId: z.string().uuid().optional(),
  /** Director-only: filter by a specific branch */
  branchId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type IncidentQueryInput = z.infer<typeof IncidentQuerySchema>;
