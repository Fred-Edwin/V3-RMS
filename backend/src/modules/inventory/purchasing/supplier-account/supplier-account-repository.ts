/** A supplier's purchasing account: database access only. Every query carries `siteId` (the hub; column `organization_id`). */
import { prisma } from '../../../../config/database';
import { ORDER_INCLUDE, type OrderRecord } from '../_shared/order-record';

export interface AccountSupplier {
  id: string;
  name: string;
  code: string;
  address: string;
  defaultPaymentTerms: string;
  paymentDays: number;
  contacts: Array<{ name: string }>;
}

/** A supplier has a few hundred orders at most; this is a safety cap, not a page size. */
const ORDER_CAP = 2000;

export const supplierAccountRepository = {
  findSupplier: (siteId: string, supplierId: string): Promise<AccountSupplier | null> =>
    prisma.supplier.findFirst({
      where: { id: supplierId, siteId },
      select: { id: true, name: true, code: true, address: true, defaultPaymentTerms: true, paymentDays: true, contacts: { where: { isPrimary: true }, select: { name: true }, take: 1 } },
    }),

  findOrders: (siteId: string, supplierId: string): Promise<OrderRecord[]> =>
    prisma.purchaseOrder.findMany({ where: { siteId, supplierId }, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, take: ORDER_CAP }),
};
