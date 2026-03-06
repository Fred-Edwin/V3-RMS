import { ModificationRequestStatus } from '@prisma/client';
import { z } from 'zod';

export const CreateModRequestSchema = z.object({
  description: z.string().min(1).max(1000),
});

export const ReviewModRequestSchema = z.object({
  status: z.enum([ModificationRequestStatus.APPROVED, ModificationRequestStatus.REJECTED]),
  reviewNote: z.string().max(500).optional(),
});

export type CreateModRequestInput = z.infer<typeof CreateModRequestSchema>;
export type ReviewModRequestInput = z.infer<typeof ReviewModRequestSchema>;
