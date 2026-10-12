/**
 * Purchase orders: database access only. Every query carries `siteId` (the hub; column `organization_id`). Writes take the
 * `tx` of the service's `$transaction` so the change, its number and its audit row commit together.
 */
import { Prisma, type PurchaseCancelReason, type PurchaseCollectedByKind, type PurchaseOrderStatus, type PurchaseSendVia, type SupplierStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ORDER_INCLUDE, type OrderRecord } from '../_shared/order-record';

type Tx = Prisma.TransactionClient;

export interface OrderSupplier {
  id: string;
  name: string;
  address: string;
  status: SupplierStatus;
  deletedAt: Date | null;
  defaultPaymentTerms: string;
  paymentDays: number;
  contacts: Array<{ name: string; phone: string | null; whatsapp: string | null }>;
}

export interface SupplierLineRow {
  inventoryItemId: string;
  supplierItemName: string | null;
  supplierItemCode: string | null;
  buyUnit: string | null;
  packSize: Prisma.Decimal | null;
  lastPrice: Prisma.Decimal | null;
  lastPriceAt: Date | null;
  isPreferred: boolean;
}

export interface ItemRow {
  id: string;
  name: string;
  usageUnit: string;
  buyUnit: string;
  packSize: Prisma.Decimal | null;
}

export interface NewLine {
  lineOrder: number;
  inventoryItemId: string;
  supplierItemName: string | null;
  supplierItemCode: string | null;
  buyUnit: string;
  packSize: Prisma.Decimal | null;
  orderedQty: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  previousPrice: Prisma.Decimal | null;
}

export interface OrderListFilter {
  statuses?: readonly PurchaseOrderStatus[];
  supplierId?: string;
  raisedById?: string;
  q?: string;
}

/** What a status change may set. `from` is the guard: the update touches nothing if the order has moved on. */
export interface Transition {
  from: readonly PurchaseOrderStatus[];
  status: PurchaseOrderStatus;
  reference?: string;
  submittedAt?: Date;
  returnedNote?: string | null;
  returnedById?: string | null;
  returnedAt?: Date | null;
  approvedById?: string;
  approvedAt?: Date;
  sentAt?: Date;
  sentVia?: PurchaseSendVia;
  sentById?: string;
  cancelReason?: PurchaseCancelReason;
  cancelNote?: string | null;
  cancelledById?: string;
  cancelledAt?: Date;
  closedAt?: Date | null;
  /** "Who is getting it?": all six move together (set, or all null to clear). */
  collectedByKind?: PurchaseCollectedByKind | null;
  collectedByCarrierId?: string | null;
  collectedByUserId?: string | null;
  collectedByName?: string | null;
  collectedBySetById?: string | null;
  collectedBySetAt?: Date | null;
}

/** What `resolveCollectedBy` hands the repository: the six columns, plus the name for the audit sentence. */
export interface CollectedByData {
  collectedByKind: PurchaseCollectedByKind;
  collectedByCarrierId: string | null;
  collectedByUserId: string | null;
  collectedByName: string | null;
  collectedBySetById: string;
  collectedBySetAt: Date;
}

const supplierSelect = {
  id: true,
  name: true,
  address: true,
  status: true,
  deletedAt: true,
  defaultPaymentTerms: true,
  paymentDays: true,
  contacts: { where: { isPrimary: true }, select: { name: true, phone: true, whatsapp: true }, take: 1 },
} as const;

export const ordersRepository = {
  findOrder: (siteId: string, id: string): Promise<OrderRecord | null> => prisma.purchaseOrder.findFirst({ where: { id, siteId }, include: ORDER_INCLUDE }),

  findOrderInTx: (tx: Tx, siteId: string, id: string): Promise<OrderRecord | null> => tx.purchaseOrder.findFirst({ where: { id, siteId }, include: ORDER_INCLUDE }),

  list: (siteId: string, filter: OrderListFilter, take: number): Promise<OrderRecord[]> =>
    prisma.purchaseOrder.findMany({
      where: {
        siteId,
        ...(filter.statuses ? { status: { in: [...filter.statuses] } } : {}),
        ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
        ...(filter.raisedById ? { raisedById: filter.raisedById } : {}),
        ...(filter.q
          ? {
              // "Search supplier, item or LPO" (Paper 28F): the order number, the supplier, or the name of an item on it.
              OR: [
                { reference: { contains: filter.q, mode: 'insensitive' as const } },
                { supplier: { name: { contains: filter.q, mode: 'insensitive' as const } } },
                { lines: { some: { inventoryItem: { name: { contains: filter.q, mode: 'insensitive' as const } } } } },
              ],
            }
          : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take,
    }),

  countByStatus: async (siteId: string): Promise<Array<{ status: PurchaseOrderStatus; count: number }>> => {
    const rows = await prisma.purchaseOrder.groupBy({ by: ['status'], where: { siteId }, _count: { _all: true } });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  },

  /** The lines of orders waiting for approval, to add up their value. */
  findAwaitingApprovalLines: (siteId: string): Promise<Array<{ orderedQty: Prisma.Decimal; unitPrice: Prisma.Decimal }>> =>
    prisma.purchaseOrderLine.findMany({ where: { order: { siteId, status: 'AWAITING_APPROVAL' } }, select: { orderedQty: true, unitPrice: true } }),

  countDueToReceive: (siteId: string, today: Date): Promise<number> =>
    prisma.purchaseOrder.count({ where: { siteId, status: { in: ['APPROVED', 'SENT'] }, expectedDate: { lte: today } } }),

  findSupplier: (siteId: string, supplierId: string): Promise<OrderSupplier | null> =>
    prisma.supplier.findFirst({ where: { id: supplierId, siteId }, select: supplierSelect }),

  /** The order that holds this supplier's one open slot (Q-07), if any. */
  findOpenOrder: (siteId: string, supplierId: string, excludeOrderId?: string): Promise<{ id: string; reference: string | null } | null> =>
    prisma.purchaseOrder.findFirst({
      where: { siteId, supplierId, status: { in: ['DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'] }, ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}) },
      select: { id: true, reference: true },
    }),

  findItems: (siteId: string, ids: readonly string[]): Promise<ItemRow[]> =>
    prisma.inventoryItem.findMany({ where: { siteId, deletedAt: null, id: { in: [...ids] } }, select: { id: true, name: true, usageUnit: true, buyUnit: true, packSize: true } }),

  findSupplierLines: (siteId: string, supplierId: string, itemIds: readonly string[]): Promise<SupplierLineRow[]> =>
    prisma.supplierItem.findMany({
      where: { siteId, supplierId, inventoryItemId: { in: [...itemIds] } },
      select: { inventoryItemId: true, supplierItemName: true, supplierItemCode: true, buyUnit: true, packSize: true, lastPrice: true, lastPriceAt: true, isPreferred: true },
    }),

  /** The price on this supplier's most recent order that left draft and was not cancelled, per item. */
  findPreviousPrices: async (siteId: string, supplierId: string, itemIds: readonly string[]): Promise<Map<string, Prisma.Decimal>> => {
    const rows = await prisma.purchaseOrderLine.findMany({
      where: { inventoryItemId: { in: [...itemIds] }, order: { siteId, supplierId, status: { notIn: ['DRAFT', 'CANCELLED'] } } },
      select: { inventoryItemId: true, unitPrice: true },
      orderBy: { order: { createdAt: 'desc' } },
    });
    const latest = new Map<string, Prisma.Decimal>();
    for (const r of rows) if (!latest.has(r.inventoryItemId)) latest.set(r.inventoryItemId, r.unitPrice);
    return latest;
  },

  create: async (
    tx: Tx,
    data: { siteId: string; supplierId: string; termsDays: number | null; expectedDate: Date | null; supplierNote: string | null; attendantNote: string | null; raisedById: string; lines: NewLine[] },
  ): Promise<string> => {
    const { lines, ...order } = data;
    const created = await tx.purchaseOrder.create({ data: { ...order, lines: { create: lines } }, select: { id: true } });
    return created.id;
  },

  replaceLines: async (tx: Tx, orderId: string, lines: NewLine[]): Promise<void> => {
    await tx.purchaseOrderLine.deleteMany({ where: { orderId } });
    await tx.purchaseOrderLine.createMany({ data: lines.map((l) => ({ ...l, orderId })) });
  },

  updateDetails: async (tx: Tx, siteId: string, id: string, data: { expectedDate?: Date | null; supplierNote?: string | null; attendantNote?: string | null }): Promise<void> => {
    await tx.purchaseOrder.updateMany({ where: { id, siteId, status: { in: ['DRAFT', 'RETURNED'] } }, data });
  },

  /** Move an order between statuses. Returns false when it was no longer in a `from` status (someone else got there first). */
  transition: async (tx: Tx, siteId: string, id: string, { from, ...data }: Transition): Promise<boolean> => {
    const result = await tx.purchaseOrder.updateMany({ where: { id, siteId, status: { in: [...from] } }, data });
    return result.count === 1;
  },

  /** A carrier of the hub's Carriers list that is still in use (retired ones cannot be chosen). */
  findActiveCarrier: (siteId: string, carrierId: string): Promise<{ id: string; name: string } | null> =>
    prisma.carrier.findFirst({ where: { id: carrierId, siteId, active: true }, select: { id: true, name: true } }),

  /** A staff member of the hub who can still sign in. */
  findActiveStaff: (siteId: string, userId: string): Promise<{ id: string; name: string; role: string } | null> =>
    prisma.user.findFirst({ where: { id: userId, siteId, isActive: true, deletedAt: null }, select: { id: true, name: true, role: true } }),

  /** The picker behind "Who is getting it?": active carriers and the hub's staff, each filtered by the typed text. */
  listCollectors: async (
    siteId: string,
    q: string | undefined,
  ): Promise<{ carriers: Array<{ id: string; name: string; kind: 'PERSON' | 'VEHICLE' | 'COMPANY' }>; staff: Array<{ id: string; name: string; role: string }> }> => {
    const like = q ? { contains: q, mode: 'insensitive' as const } : undefined;
    const [carriers, staff] = await Promise.all([
      prisma.carrier.findMany({ where: { siteId, active: true, ...(like ? { name: like } : {}) }, orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true } }),
      prisma.user.findMany({ where: { siteId, isActive: true, deletedAt: null, ...(like ? { name: like } : {}) }, orderBy: { name: 'asc' }, take: 50, select: { id: true, name: true, role: true } }),
    ]);
    return { carriers, staff };
  },

  /** Set or clear who is getting an approved or sent order. False when the order had moved on. */
  setCollectedBy: async (tx: Tx, siteId: string, id: string, data: CollectedByData | null): Promise<boolean> => {
    const cleared = { collectedByKind: null, collectedByCarrierId: null, collectedByUserId: null, collectedByName: null, collectedBySetById: null, collectedBySetAt: null };
    const result = await tx.purchaseOrder.updateMany({ where: { id, siteId, status: { in: ['APPROVED', 'SENT'] } }, data: data ?? cleared });
    return result.count === 1;
  },

  /** When this order's audit last recorded this action (the reminder throttle). */
  findLastAuditAt: async (siteId: string, orderId: string, action: string): Promise<Date | null> => {
    const row = await prisma.purchasingAuditEntry.findFirst({ where: { siteId, orderId, action }, orderBy: { at: 'desc' }, select: { at: true } });
    return row?.at ?? null;
  },

  /** A discarded draft leaves nothing behind: it has no number and nothing was sent. */
  deleteDraft: async (tx: Tx, siteId: string, id: string): Promise<boolean> => {
    await tx.purchasingAuditEntry.deleteMany({ where: { orderId: id, siteId } });
    const result = await tx.purchaseOrder.deleteMany({ where: { id, siteId, status: 'DRAFT' } });
    return result.count === 1;
  },
};
