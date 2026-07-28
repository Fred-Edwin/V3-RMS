import { z } from 'zod';

export const LocationIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});
