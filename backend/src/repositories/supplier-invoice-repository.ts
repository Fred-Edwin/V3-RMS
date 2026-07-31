import { Prisma, type SupplierInvoice, type SupplierInvoiceStatus, type SupplierPayment } from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient;

export type SupplierInvoiceWithPayments = SupplierInvoice & {
  payments: SupplierPayment[];
  supplier: { id: string; name: string };
};

export type CreateSupplierInvoiceInput = {
  supplierId: string;
  purchaseOrderId?: string;
  referenceNumber: string;
  amount: Prisma.Decimal.Value;
  invoiceDate: Date;
  createdById: string;
};

export type CreateSupplierPaymentInput = {
  amount: Prisma.Decimal.Value;
  method: string;
  paidAt: Date;
  recordedById: string;
};

const detailInclude = {
  supplier: { select: { id: true, name: true } },
  payments: { orderBy: { paidAt: 'asc' as const } },
} as const;

export const supplierInvoiceRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: { supplierId?: string; status?: SupplierInvoiceStatus } = {},
  ): Promise<SupplierInvoiceWithPayments[]> => {
    return prisma.supplierInvoice.findMany({
      where: {
        organizationId,
        ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: detailInclude,
      orderBy: { invoiceDate: 'desc' },
    });
  },

  findById: async (
    id: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<SupplierInvoiceWithPayments | null> => {
    return tx.supplierInvoice.findFirst({
      where: { id, organizationId },
      include: detailInclude,
    });
  },

  create: async (
    organizationId: string,
    data: CreateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithPayments> => {
    return prisma.supplierInvoice.create({
      data: {
        organizationId,
        supplierId: data.supplierId,
        purchaseOrderId: data.purchaseOrderId,
        referenceNumber: data.referenceNumber,
        amount: new Prisma.Decimal(data.amount),
        status: 'UNPAID',
        invoiceDate: data.invoiceDate,
        createdById: data.createdById,
      },
      include: detailInclude,
    });
  },

  /** Scoped update of amountPaid + status — used after recording a payment. */
  updateAmountPaidAndStatus: async (
    id: string,
    organizationId: string,
    data: { amountPaid: Prisma.Decimal.Value; status: SupplierInvoiceStatus },
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.supplierInvoice.updateMany({
      where: { id, organizationId },
      data: {
        amountPaid: new Prisma.Decimal(data.amountPaid),
        status: data.status,
      },
    });
  },

  createPayment: async (
    organizationId: string,
    supplierInvoiceId: string,
    data: CreateSupplierPaymentInput,
    tx: TxClient = prisma,
  ): Promise<SupplierPayment> => {
    return tx.supplierPayment.create({
      data: {
        organizationId,
        supplierInvoiceId,
        amount: new Prisma.Decimal(data.amount),
        method: data.method as SupplierPayment['method'],
        paidAt: data.paidAt,
        recordedById: data.recordedById,
      },
    });
  },
};
