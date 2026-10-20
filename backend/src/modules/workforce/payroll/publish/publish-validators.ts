import { z } from 'zod';

export const publishBody = z
  .object({
    pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'),
    idempotencyKey: z.string().trim().min(8).max(80),
    stateVersion: z.number().int().min(0),
  })
  .strict();
export type PublishBody = z.infer<typeof publishBody>;
