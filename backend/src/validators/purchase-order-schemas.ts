import { z } from 'zod';
import { nonNegativeQuantitySchema, quantitySchema } from './inventory-item-schemas';

export const PurchaseOrderIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const PurchaseOrderLineIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
  lineId: z.string().uuid('lineId param must be a valid UUID'),
});

const purchaseOrderLineInputSchema = z.object({
  inventoryItemId: z.string().uuid('inventoryItemId must be a valid UUID'),
  orderedQty: quantitySchema,
  unitPrice: nonNegativeQuantitySchema,
});

export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid('supplierId must be a valid UUID'),
  locationId: z.string().uuid('locationId must be a valid UUID'),
  lines: z.array(purchaseOrderLineInputSchema).min(1, 'At least one line is required'),
});

export const ReceivePurchaseOrderLineSchema = z.object({
  receivedQty: quantitySchema,
  invoicePrice: nonNegativeQuantitySchema,
});

export const PurchaseOrderStatusQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'CLOSED', 'CANCELLED']).optional(),
});

export const SuggestOrderQuerySchema = z.object({
  locationId: z.string().uuid('locationId must be a valid UUID'),
});

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;
export type ReceivePurchaseOrderLineInput = z.infer<typeof ReceivePurchaseOrderLineSchema>;
