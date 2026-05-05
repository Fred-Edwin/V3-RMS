import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

export const updateBranchSchema = createBranchSchema
  .pick({
    name: true,
    address: true,
    city: true,
    latitude: true,
    longitude: true,
  })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export const updateBranchProfileSchema = z.object({
  phone: z.string().min(1).max(20).optional(),
  mpesaPaybill: z.string().min(1).max(20).optional(),
  accountNumber: z.string().min(1).max(50).optional(),
  googleReviewUrl: z.string().url().max(500).optional(),
});

export const branchIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});
