import type { Request } from 'express';
import { Prisma, type SupplierInvoiceStatus } from '@prisma/client';
import { prisma } from '../config/database';
import {
  supplierInvoiceRepository,
  type SupplierInvoiceWithPayments,
} from '../repositories/supplier-invoice-repository';
import { supplierRepository } from '../repositories/supplier-repository';
import { purchaseOrderRepository } from '../repositories/purchase-order-repository';
import { NotFoundError, ValidationError } from '../utils/errors';
import type {
  CreateSupplierInvoiceInput,
  RecordSupplierPaymentInput,
} from '../validators/supplier-invoice-schemas';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

/** UNPAID -> PARTIALLY_PAID -> PAID, derived purely from amountPaid vs. amount. */
const deriveStatus = (amount: Prisma.Decimal, amountPaid: Prisma.Decimal): SupplierInvoiceStatus => {
  if (amountPaid.greaterThanOrEqualTo(amount)) return 'PAID';
  if (amountPaid.greaterThan(0)) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

export const supplierInvoiceService = {
  /** Manager-only, zero access for Attendant — enforced at the route (§4a, D-13). */
  list: async (
    actor: Actor,
    filters: { supplierId?: string; status?: SupplierInvoiceStatus } = {},
  ): Promise<SupplierInvoiceWithPayments[]> => {
    const organizationId = requireOrganization(actor);
    return supplierInvoiceRepository.findAllByOrganization(organizationId, filters);
  },

  getById: async (actor: Actor, id: string): Promise<SupplierInvoiceWithPayments> => {
    const organizationId = requireOrganization(actor);
    const invoice = await supplierInvoiceRepository.findById(id, organizationId);
    if (!invoice) {
      throw new NotFoundError('Supplier invoice not found');
    }
    return invoice;
  },

  create: async (
    actor: Actor,
    input: CreateSupplierInvoiceInput,
  ): Promise<SupplierInvoiceWithPayments> => {
    const organizationId = requireOrganization(actor);

    const supplier = await supplierRepository.findById(input.supplierId, organizationId);
    if (!supplier) {
      throw new ValidationError('supplierId does not reference a known supplier');
    }
    if (input.purchaseOrderId) {
      const po = await purchaseOrderRepository.findById(input.purchaseOrderId, organizationId);
      if (!po) {
        throw new ValidationError('purchaseOrderId does not reference a known purchase order');
      }
    }

    return supplierInvoiceRepository.create(organizationId, {
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId,
      referenceNumber: input.referenceNumber,
      amount: input.amount,
      invoiceDate: new Date(input.invoiceDate),
      createdById: actor.id,
    });
  },

  /**
   * Records a payment against an invoice and re-derives status. Partial
   * payments supported (§4a) — status only reaches PAID once amountPaid
   * covers the full invoiced amount.
   */
  recordPayment: async (
    actor: Actor,
    supplierInvoiceId: string,
    input: RecordSupplierPaymentInput,
  ): Promise<SupplierInvoiceWithPayments> => {
    const organizationId = requireOrganization(actor);
    const paymentAmount = new Prisma.Decimal(input.amount);

    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    const invoice = await supplierInvoiceRepository.findById(supplierInvoiceId, organizationId);
    if (!invoice) {
      throw new NotFoundError('Supplier invoice not found');
    }
    if (invoice.status === 'PAID') {
      throw new ValidationError('Invoice is already fully paid');
    }

    await prisma.$transaction(async (tx) => {
      await supplierInvoiceRepository.createPayment(
        organizationId,
        supplierInvoiceId,
        {
          amount: paymentAmount,
          method: input.method,
          paidAt: new Date(input.paidAt),
          recordedById: actor.id,
        },
        tx,
      );

      const newAmountPaid = invoice.amountPaid.add(paymentAmount);
      const newStatus = deriveStatus(invoice.amount, newAmountPaid);

      await supplierInvoiceRepository.updateAmountPaidAndStatus(
        supplierInvoiceId,
        organizationId,
        { amountPaid: newAmountPaid, status: newStatus },
        tx,
      );
    });

    return supplierInvoiceService.getById(actor, supplierInvoiceId);
  },
};
