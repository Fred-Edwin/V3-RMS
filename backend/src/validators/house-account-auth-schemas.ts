import { z } from 'zod';

export const ResolveAuthSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
});

export type ResolveAuthInput = z.infer<typeof ResolveAuthSchema>;
