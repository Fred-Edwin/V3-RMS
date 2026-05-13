import { z } from 'zod';

export const OrderCancellationAuthRequestIdParamSchema = z.object({
  authRequestId: z.string().uuid(),
});

export const OrderCancellationDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  resolutionNote: z.string().trim().min(1).max(500).optional(),
});

export type OrderCancellationDecisionInput = z.infer<typeof OrderCancellationDecisionSchema>;
