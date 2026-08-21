import { z } from 'zod';

const departmentTagEnum = z.enum(['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING']);

export const branchOrgParamSchema = z.object({
  orgId: z.string().uuid('orgId param must be a valid UUID'),
});

export const departmentParamSchema = z.object({
  orgId: z.string().uuid('orgId param must be a valid UUID'),
  tag: departmentTagEnum,
});

export const assignHeadSchema = z.object({
  userId: z.string().uuid(),
});
