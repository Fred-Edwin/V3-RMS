import { z } from 'zod';

export const ResolveAuthSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
});

export type ResolveAuthInput = z.infer<typeof ResolveAuthSchema>;

const uuidParam = z.string().uuid('param must be a valid UUID');
export const authRequestIdParamSchema = z.object({ authRequestId: uuidParam });
export const orderIdParamSchema = z.object({ orderId: uuidParam });
