import { z } from 'zod';
import { ORDER_STATUSES } from '../_shared/order-state';

const qty = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, 'Enter a quantity');
/** Empty means "use the supplier's usual price"; only a person who approves orders may type one that differs. */
const price = z.union([z.literal(''), z.string().regex(/^\d{1,9}(\.\d{1,4})?$/, 'Enter a price')]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date');
const note = z.string().trim().max(500).nullable();
const pin = z.string().regex(/^\d{4}$/, 'Enter your 4-digit PIN');

const OrderLineSchema = z.object({ inventoryItemId: z.string().uuid(), qty, unitPrice: price });

export const OrderInputSchema = z.object({
  supplierId: z.string().uuid(),
  expectedDate: isoDate.nullable(),
  supplierNote: note,
  attendantNote: note,
  lines: z.array(OrderLineSchema).min(1, 'Add at least one item to the order.').max(200),
});

export const UpdateOrderSchema = z.object({
  expectedDate: isoDate.nullable().optional(),
  supplierNote: note.optional(),
  attendantNote: note.optional(),
  lines: z.array(OrderLineSchema).min(1, 'Add at least one item to the order.').max(200).optional(),
});

export const OrdersQuerySchema = z.object({
  stage: z.enum(['NEEDS', 'APPROVAL', 'RECEIVE', 'INVOICE', 'PAY', 'CLOSED']).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  supplierId: z.string().uuid().optional(),
  raisedBy: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });
export const ApproveSchema = z.object({ pin });
export const ReturnSchema = z.object({ note: z.string().trim().min(1, 'Say why you are sending it back.').max(500) });
export const SendSchema = z.object({ via: z.enum(['WHATSAPP', 'PRINT', 'LINK', 'MANUAL']) });
export const CancelSchema = z.object({
  reason: z.enum(['ORDERED_BY_MISTAKE', 'SUPPLIER_CANNOT_SUPPLY', 'NO_LONGER_NEEDED', 'OTHER']),
  note: z.string().trim().max(500).nullable().default(null),
  pin,
});

export type OrderInput = z.infer<typeof OrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;
export type OrdersQuery = z.infer<typeof OrdersQuerySchema>;
export type CancelInput = z.infer<typeof CancelSchema>;
