import { z } from 'zod';

export const createTransferSchema = z.object({
  userId: z.string().uuid(),
  toSiteId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const listTransfersQuerySchema = z.object({
  userId: z.string().uuid().optional(),
});

export const transferUserIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});
