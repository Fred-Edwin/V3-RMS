import { z } from 'zod';

const amount = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date');
const method = z.enum(['BANK_TRANSFER', 'MPESA_PAYBILL', 'MPESA_TILL', 'MPESA_SEND_MONEY', 'CHEQUE', 'CASH']);
const text = (max: number) => z.string().trim().max(max).nullable().default(null);
const pin = z.string().regex(/^\d{4}$/, 'Enter the 4-digit PIN');
const fileId = z.string().uuid().nullable().default(null);

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const DepositSchema = z.object({ amount, paidOn: isoDate, method, methodRef: text(100), chequeNo: text(40), note: text(300) });

export const InvoiceSchema = z.object({
  number: z.string().trim().min(1, "Enter the supplier's invoice number.").max(60),
  date: isoDate,
  amount,
  photoId: fileId,
  varianceReason: text(300),
  /** Set after the "duplicate invoice number" warning when the person says it is a different invoice. */
  differentInvoice: z.boolean().default(false),
});

export const SettleSchema = z.object({ agreedAmount: amount, note: z.string().trim().min(1, 'Say what was agreed with the supplier.').max(300) });

export const VoidSchema = z.object({ reason: z.enum(['WRONG_AMOUNT', 'WRONG_SUPPLIER_OR_ORDER', 'DUPLICATE', 'OTHER']), pin });

export const PaymentSchema = z.object({
  amount,
  paidOn: isoDate,
  method,
  methodRef: text(100),
  chequeNo: text(40),
  proofPhotoId: fileId,
  /** Resend with this set after `PAYMENT_EXCEEDS_BALANCE` when the person means to pay more than is owed (the rest stays as credit). */
  confirmOverpay: z.boolean().default(false),
});

export const ReverseSchema = z.object({
  reason: z.enum(['WRONG_AMOUNT', 'WRONG_REFERENCE', 'WRONG_INVOICE', 'PAYMENT_BOUNCED', 'OTHER']),
  note: text(300),
  approverPin: pin,
});

export const DocumentSchema = z.object({ title: z.string().trim().min(1, 'Give the document a name.').max(100), fileId: z.string().uuid() });

export type DepositInput = z.infer<typeof DepositSchema>;
export type InvoiceInput = z.infer<typeof InvoiceSchema>;
export type SettleInput = z.infer<typeof SettleSchema>;
export type VoidInput = z.infer<typeof VoidSchema>;
export type PaymentInput = z.infer<typeof PaymentSchema>;
export type ReverseInput = z.infer<typeof ReverseSchema>;
export type DocumentInput = z.infer<typeof DocumentSchema>;
