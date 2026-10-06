import { z } from 'zod';

const qty = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, 'Enter a quantity');
const price = z.string().regex(/^\d{1,9}(\.\d{1,4})?$/, 'Enter a price');

/**
 * `deliveredPrice` is what the receiver reads on the supplier's delivery note when it differs from the order (owner decision,
 * Option A). Null means "as ordered". A price that differs must also be confirmed (`priceConfirmed`) before it is accepted.
 */
export const ReceiveSchema = z.object({
  lines: z
    .array(z.object({ lineId: z.string().uuid(), receivedQty: qty, deliveredPrice: price.nullable().default(null), priceConfirmed: z.boolean().default(false) }))
    .max(200),
  deliveryNoteNo: z.string().trim().max(60),
  deliveryNotePhotoId: z.string().uuid().nullable(),
  pin: z.string().regex(/^\d{4}$/, 'Enter your 4-digit PIN'),
});

export type ReceiveInput = z.infer<typeof ReceiveSchema>;
