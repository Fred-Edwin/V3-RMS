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
