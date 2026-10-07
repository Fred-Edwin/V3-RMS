import type { OrderView, PayMethod, PaymentView } from '../_shared/purchasing.types';

export interface PaymentResult {
  payment: PaymentView;
  /** The order after the payment (CLOSED when it was the last one). */
  order: OrderView;
}

/** The printed payment advice: what was paid, to whom, against which invoice, and what is left. */
export interface PaymentAdvice {
  reference: string;
  date: string;
  supplier: { name: string; address: string; contact: string | null; kraPin: string | null };
  orderReference: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: string;
  advanceApplied: string;
  /** Everything paid against this invoice before this payment, advance included. */
  paidBefore: string;
  amountPaid: string;
  amountInWords: string;
  balanceAfter: string;
  method: PayMethod;
  /** The supplier's account detail for the method, only for a caller who may see payment details. */
  methodDetail: string | null;
  methodRef: string | null;
  chequeNo: string | null;
  earlier: Array<{ reference: string; kind: 'ADVANCE' | 'INVOICE'; amount: string; paidOn: string; method: PayMethod; methodRef: string | null }>;
  preparedBy: { name: string; role: string; signedAt: string };
  generatedAt: string;
}
