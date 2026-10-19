import { z } from 'zod';

export const ConfirmBodySchema = z
  .object({
    scope: z.string().min(1).max(60),
    note: z.string().trim().min(1).max(500).optional(),
    pin: z.string().regex(/^\d{4}$/, 'The PIN is 4 digits'),
  })
  .strict();

export type ConfirmBody = z.infer<typeof ConfirmBodySchema>;
