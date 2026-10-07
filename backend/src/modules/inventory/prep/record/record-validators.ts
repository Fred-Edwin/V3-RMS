import { z } from 'zod';
import { decimalString, yieldReasonSchema } from '../_shared/prep-contract';

export { checkInputSchema, recordInputSchema } from '../_shared/prep-contract';

/**
 * The request schemas the routes parse. They match `checkInputSchema` / `recordInputSchema` in the frozen contract except that
 * an amount of zero or less is let through here and refused by the service as 422 `QUANTITY_NOT_POSITIVE`, the code the
 * contract names (the frozen schemas would answer 400 first).
 */
const uuid = z.string().uuid();
const requestLine = z.object({ itemId: uuid, quantity: decimalString });

export const checkRequestSchema = z.object({
  outputItemId: uuid,
  inputs: z.array(requestLine).min(1).max(30),
  made: decimalString.optional(),
});

export const recordRequestSchema = z.object({
  idempotencyKey: uuid,
  outputItemId: uuid,
  inputs: z.array(requestLine).min(1).max(30),
  made: decimalString,
  yieldReason: yieldReasonSchema.optional(),
  reasonNote: z.string().trim().max(300).optional(),
});

export type CheckRequest = z.infer<typeof checkRequestSchema>;
export type RecordRequest = z.infer<typeof recordRequestSchema>;
