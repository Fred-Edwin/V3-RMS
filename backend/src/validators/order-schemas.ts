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
  notes: z.string().max(1000).optional(),
});

export const RecordPaymentSchema = z
  .object({
    paymentMethod: z.nativeEnum(PaymentMethod),
    // Optional Mpesa transaction code — required when paymentMethod is MPESA or SPLIT
    mpesaCode: z.string().min(1).max(20).optional(),
    // Split payment amounts — required when paymentMethod is SPLIT
    mpesaAmount: z.number().positive().optional(),
    cashAmount: z.number().positive().optional(),
    // Credit account IDs — one required when using a credit payment method
    houseAccountId: z.string().uuid().optional(),
    corporateAccountId: z.string().uuid().optional(),
    corporateEmployeeRef: z.string().max(200).optional(),
    customerCreditAccountId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === PaymentMethod.SPLIT) {
      if (data.mpesaAmount === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mpesaAmount is required for split payment', path: ['mpesaAmount'] });
      }
      if (data.cashAmount === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'cashAmount is required for split payment', path: ['cashAmount'] });
      }
    }
    if (data.paymentMethod === PaymentMethod.HOUSE_ACCOUNT && !data.houseAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'houseAccountId is required for house account payment', path: ['houseAccountId'] });
    }
    if (data.paymentMethod === PaymentMethod.CORPORATE_ACCOUNT && !data.corporateAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'corporateAccountId is required for corporate account payment', path: ['corporateAccountId'] });
    }
    if (data.paymentMethod === PaymentMethod.CUSTOMER_CREDIT && !data.customerCreditAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'customerCreditAccountId is required for customer credit payment', path: ['customerCreditAccountId'] });
    }
  });

export const CANCEL_REASONS = [
  'Customer changed their mind',
  'Customer left',
  'Duplicate order',
  'Wrong items ordered',
  'Item unavailable',
  'Other',
] as const;

export const CancelOrderSchema = z
  .object({
    reason: z.enum(CANCEL_REASONS),
    reasonDetail: z.string().min(1).max(500).optional(),
  })
  .refine(
    (data) => data.reason !== 'Other' || (data.reasonDetail && data.reasonDetail.trim().length > 0),
    { message: 'Please provide details for "Other" reason', path: ['reasonDetail'] },
  );

export const ClaimPrepTicketSchema = z.object({
  claimedById: z.string().uuid(),
});

export const RejectPrepTicketSchema = z.object({
  reason: z.string().min(1).max(500),
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
  /** Filter by the staff member who placed the order (MANAGER/DIRECTOR only) */
  createdById: z.string().uuid().optional(),
  /** Filter by the prep staff who claimed a ticket (MANAGER/DIRECTOR only) */
  prepTicketClaimedById: z.string().uuid().optional(),
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
  activeOnly: z.coerce.boolean().optional(),
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
