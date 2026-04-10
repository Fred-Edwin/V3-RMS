import { z } from 'zod';

export const StaffDiscountDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
});

export const StaffDiscountAuthRequestIdParamSchema = z.object({
  authRequestId: z.string().uuid(),
});

export type StaffDiscountDecisionInput = z.infer<typeof StaffDiscountDecisionSchema>;
