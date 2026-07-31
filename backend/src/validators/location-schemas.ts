import { z } from 'zod';

export const LocationIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const CreateCentralStoreSchema = z.object({
  name: z.string().trim().min(1).max(100).default('Central Store'),
});
