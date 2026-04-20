import { z } from 'zod';

export const createTransferSchema = z.object({
  userId: z.string().uuid(),
  toOrganizationId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const listTransfersQuerySchema = z.object({
  userId: z.string().uuid().optional(),
});
