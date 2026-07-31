import { z } from 'zod';
import { quantitySchema } from './inventory-item-schemas';

export const SupplierInvoiceIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

const paymentMethodEnum = z.enum([
  'MPESA',
  'CASH',
  'CARD',
  'SPLIT',
  'GUEST_SPLIT',
  'HOUSE_ACCOUNT',
  'CORPORATE_ACCOUNT',
  'CUSTOMER_CREDIT',
]);

export const CreateSupplierInvoiceSchema = z.object({
  supplierId: z.string().uuid('supplierId must be a valid UUID'),
  purchaseOrderId: z.string().uuid().optional(),
  referenceNumber: z.string().trim().min(1, 'Reference number is required').max(100),
  amount: quantitySchema,
  invoiceDate: z.string().datetime({ message: 'invoiceDate must be an ISO datetime string' }),
});

export const RecordSupplierPaymentSchema = z.object({
  amount: quantitySchema,
  method: paymentMethodEnum,
  paidAt: z.string().datetime({ message: 'paidAt must be an ISO datetime string' }),
});

export const SupplierInvoiceListQuerySchema = z.object({
  supplierId: z.string().uuid().optional(),
  status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
});

export type CreateSupplierInvoiceInput = z.infer<typeof CreateSupplierInvoiceSchema>;
export type RecordSupplierPaymentInput = z.infer<typeof RecordSupplierPaymentSchema>;
