import { z } from 'zod';
import { cancelInputSchema, correctReasonSchema, decimalString, yieldReasonSchema } from '../_shared/prep-contract';

export { cancelInputSchema, correctInputSchema } from '../_shared/prep-contract';

/**
 * The request schemas the routes parse. `correctRequestSchema` matches `correctInputSchema` in the frozen contract except that an
 * amount of zero or less is let through here and refused by the service as 422 `QUANTITY_NOT_POSITIVE`, the code the contract
 * names (the frozen schema would answer 400 first). Same approach as record-validators.ts.
 */
const uuid = z.string().uuid();

export const runIdParamSchema = z.object({ id: uuid });

export const correctRequestSchema = z.object({
  idempotencyKey: uuid,
  inputs: z.array(z.object({ itemId: uuid, quantity: decimalString })).min(1).max(30),
  made: decimalString,
  reason: correctReasonSchema,
  reasonNote: z.string().trim().max(300).optional(),
  yieldReason: yieldReasonSchema.optional(),
});

export const cancelRequestSchema = cancelInputSchema;

export type CorrectRequest = z.infer<typeof correctRequestSchema>;
export type CancelRequest = z.infer<typeof cancelRequestSchema>;
