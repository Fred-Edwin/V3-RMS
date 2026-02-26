import { OrderStatus, OrderType, PaymentMethod, PrepTicketStatus } from '@prisma/client';
import { z } from 'zod';

export const routeIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const OrderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1),
  notes: z.string().max(500).nullable().optional(),
});

const commonCreateFieldsSchema = z.object({
  items: z.array(OrderItemInputSchema).min(1),
  notes: z.string().max(1000).optional(),
});

const createDineInSchema = commonCreateFieldsSchema.extend({
  type: z.literal(OrderType.DINE_IN),
  tableNumber: z.string().min(1),
});

const createTakeAwaySchema = commonCreateFieldsSchema.extend({
  type: z.literal(OrderType.TAKE_AWAY),
});

const createDeliverySchema = commonCreateFieldsSchema.extend({
  type: z.literal(OrderType.DELIVERY),
  deliveryZoneId: z.string().uuid(),
});

export const CreateOrderSchema = z.discriminatedUnion('type', [
  createDineInSchema,
  createTakeAwaySchema,
  createDeliverySchema,
]);

export const UpdateOrderItemsSchema = z.object({
  items: z.array(OrderItemInputSchema).min(1),
});

export const RecordPaymentSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
});

export const CancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const ClaimPrepTicketSchema = z.object({
  claimedById: z.string().uuid(),
});

export const orderListViewSchema = z.enum(['full', 'summary']);

export const OrderQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  type: z.nativeEnum(OrderType).optional(),
  date: isoDateSchema.optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  view: orderListViewSchema.default('full'),
  branchId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const ActiveOrderQuerySchema = z.object({
  view: orderListViewSchema.default('full'),
});

export const PrepTicketQuerySchema = z.object({
  status: z.nativeEnum(PrepTicketStatus).optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderItemsInput = z.infer<typeof UpdateOrderItemsSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;
export type ClaimPrepTicketInput = z.infer<typeof ClaimPrepTicketSchema>;
export type OrderQueryInput = z.infer<typeof OrderQuerySchema>;
export type ActiveOrderQueryInput = z.infer<typeof ActiveOrderQuerySchema>;
export type PrepTicketQueryInput = z.infer<typeof PrepTicketQuerySchema>;
