import { z } from 'zod';

const qty = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, 'Enter a quantity');

const LineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  qty,
  /** Optional: buy this item from a different supplier than the default. */
  supplierId: z.string().uuid().optional(),
});

export const RestockLinesSchema = z.object({ lines: z.array(LineSchema).min(1, 'Add at least one item to the list.').max(200) });

export const RestockSendSchema = RestockLinesSchema.extend({ note: z.string().trim().max(500).nullable().default(null), allowAnotherOpen: z.boolean().optional() });

export type RestockLinesInput = z.infer<typeof RestockLinesSchema>;
export type RestockSendInput = z.infer<typeof RestockSendSchema>;
