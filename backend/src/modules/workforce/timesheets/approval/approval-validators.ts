import { z } from 'zod';

export const approveBody = z
  .object({
    pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'),
    /** A repeat of the same key answers the first result, not an error (D25). */
    idempotencyKey: z.string().trim().min(8).max(80),
    /** The numbers the dialog showed; the server checks them against the fresh ones (CHANGED_UNDERNEATH). */
    expectedTotals: z.object({ workedMinutes: z.number().int().min(0), overtimeAuthorisedMinutes: z.number().int().min(0), headcount: z.number().int().min(0) }).strict(),
    site: z.string().uuid().optional(),
  })
  .strict();
export type ApproveBody = z.infer<typeof approveBody>;
