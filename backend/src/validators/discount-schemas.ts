import { z } from 'zod';

export const CreateDiscountSchema = z.object({
  // null = all branches; a UUID = scoped to one branch
  organizationId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  // percentage: 0.01–100; fixed: positive amount
  value: z.number().positive().max(100000),
  requiresApproval: z.boolean().default(false),
});

export const UpdateDiscountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  value: z.number().positive().max(100000).optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
  // Allow rescoping to a different branch or all-branches (null)
  organizationId: z.string().uuid().nullable().optional(),
});

export const DiscountDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
});
