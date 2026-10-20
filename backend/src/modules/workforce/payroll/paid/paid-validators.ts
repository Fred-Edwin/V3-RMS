import { z } from 'zod';

export const markPaidBody = z
  .object({
    pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'),
    idempotencyKey: z.string().trim().min(8).max(80),
    stateVersion: z.number().int().min(0),
    /** The hash of the file the dialog showed (the X-Bank-File-Hash of the download); empty only when nobody is paid by bank. */
    bankFileHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  })
  .strict();
export type MarkPaidBody = z.infer<typeof markPaidBody>;
