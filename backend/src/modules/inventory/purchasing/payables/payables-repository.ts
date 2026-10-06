/**
 * Invoices, payments and documents on a purchase file: database access only. Every query carries `siteId`; writes take the
 * service's `tx`. Nothing is deleted here: a void or a reversal adds a linked row or marks one.
 */
import type { Prisma, PurchasePaymentKind, PurchaseReverseReason, PurchaseVoidReason, SupplierPayMethodType } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ORDER_INCLUDE, type OrderRecord } from '../_shared/order-record';

type Tx = Prisma.TransactionClient;

export interface NewInvoice {
  siteId: string;
  orderId: string;
  supplierId: string;
  number: string;
  invoiceDate: Date;
  dueDate: Date;
  amount: Prisma.Decimal;
  disputed: boolean;
  varianceAmount: Prisma.Decimal | null;
  varianceReason: string | null;
  fileId: string | null;
  enteredById: string;
}

export interface NewPayment {
  siteId: string;
  orderId: string;
  invoiceId: string | null;
  supplierId: string;
  reference: string;
  kind: PurchasePaymentKind;
  amount: Prisma.Decimal;
  paidOn: Date;
  method: SupplierPayMethodType;
  methodRef: string | null;
  chequeNo: string | null;
  note: string | null;
  proofFileId: string | null;
  reversesId?: string;
  reverseReason?: PurchaseReverseReason;
  approvedById?: string;
  recordedById: string;
}

export interface Settlement {
  amount: Prisma.Decimal;
  settledAmount: Prisma.Decimal;
  settledNote: string;
  settledById: string;
  settledAt: Date;
}

export interface Voiding {
  voidReason: PurchaseVoidReason;
  voidedById: string;
  voidedAt: Date;
}

export const payablesRepository = {
  findOrderByInvoice: (siteId: string, invoiceId: string): Promise<OrderRecord | null> =>
    prisma.purchaseOrder.findFirst({ where: { siteId, invoices: { some: { id: invoiceId } } }, include: ORDER_INCLUDE }),

  findOrderByPayment: (siteId: string, paymentId: string): Promise<OrderRecord | null> =>
    prisma.purchaseOrder.findFirst({ where: { siteId, payments: { some: { id: paymentId } } }, include: ORDER_INCLUDE }),

  /** Another order's live (not voided) invoice from this supplier with the same number, ignoring letter case. */
  findDuplicateInvoice: (siteId: string, supplierId: string, number: string, excludeOrderId: string): Promise<{ orderId: string; reference: string | null } | null> =>
    prisma.purchaseInvoice
      .findFirst({
        where: { siteId, supplierId, number: { equals: number, mode: 'insensitive' }, status: { not: 'VOIDED' }, orderId: { not: excludeOrderId } },
        select: { orderId: true, order: { select: { reference: true } } },
      })
      .then((row) => (row ? { orderId: row.orderId, reference: row.order.reference } : null)),

  createInvoice: async (tx: Tx, data: NewInvoice): Promise<string> => (await tx.purchaseInvoice.create({ data, select: { id: true } })).id,

  setInvoiceStatus: async (tx: Tx, siteId: string, id: string, status: 'OPEN' | 'PAID'): Promise<void> => {
    await tx.purchaseInvoice.updateMany({ where: { id, siteId, status: { not: 'VOIDED' } }, data: { status } });
  },

  settleInvoice: async (tx: Tx, siteId: string, id: string, data: Settlement): Promise<boolean> =>
    (await tx.purchaseInvoice.updateMany({ where: { id, siteId, disputed: true, status: { not: 'VOIDED' } }, data: { ...data, disputed: false } })).count === 1,

  voidInvoice: async (tx: Tx, siteId: string, id: string, data: Voiding): Promise<boolean> =>
    (await tx.purchaseInvoice.updateMany({ where: { id, siteId, status: { not: 'VOIDED' } }, data: { ...data, status: 'VOIDED' } })).count === 1,

  createPayment: async (tx: Tx, data: NewPayment): Promise<string> => (await tx.purchasePayment.create({ data, select: { id: true } })).id,

  /** Mark a payment reversed; false when it already was (two people reversing at once). */
  markPaymentReversed: async (tx: Tx, siteId: string, id: string): Promise<boolean> =>
    (await tx.purchasePayment.updateMany({ where: { id, siteId, status: 'RECORDED' }, data: { status: 'REVERSED' } })).count === 1,

  createDocument: async (tx: Tx, data: { siteId: string; orderId: string; title: string; fileId: string; addedById: string }): Promise<string> =>
    (await tx.purchaseDocument.create({ data, select: { id: true } })).id,
};
