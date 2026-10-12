/**
 * The Store Attendant's Purchasing phone: database access only. Every query carries `siteId` (the hub; column `organization_id`).
 * On-hand is the ledger sum at the Central Store location, never a stored figure.
 */
import { Prisma, type PurchaseOrderStatus, type SupplierStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { Scope } from '../needs-restocking/needs-restocking-repository';
import type { ItemFacts, LevelItem } from './attendant-logic';

export interface Approver {
  id: string;
  name: string;
  role: string;
}

export interface ItemWithStock extends ItemFacts {
  onHand: Prisma.Decimal;
  level: Prisma.Decimal | null;
}

export interface HistoryFilter {
  from: Date;
  /** Exclusive: the start of the day after the last day wanted. */
  toExclusive: Date;
  status: 'all' | 'paid' | 'cancelled';
  q?: string;
  raisedById?: string;
}

const likeOf = (q: string | undefined): string | null => (q?.trim() ? `%${q.trim()}%` : null);

/** What the closed-orders list needs of an order: no invoice, no payments (the Attendant never sees them). */
const HISTORY_SELECT = {
  id: true,
  reference: true,
  status: true,
  closedAt: true,
  cancelledAt: true,
  cancelReason: true,
  supplier: { select: { id: true, name: true } },
  lines: { select: { result: true, orderedQty: true, unitPrice: true } },
  delivery: { select: { deliveredTotal: true } },
} satisfies Prisma.PurchaseOrderSelect;
export type HistoryRecord = Prisma.PurchaseOrderGetPayload<{ select: typeof HISTORY_SELECT }>;

const NOTICE_SELECT = {
  id: true,
  reference: true,
  status: true,
  expectedDate: true,
  raisedById: true,
  approvedAt: true,
  approvedBy: { select: { id: true, name: true, role: true } },
  returnedAt: true,
  returnedNote: true,
  returnedBy: { select: { name: true, role: true } },
  closedAt: true,
  supplier: { select: { name: true } },
  lines: { select: { orderedQty: true, unitPrice: true } },
} satisfies Prisma.PurchaseOrderSelect;
export type NoticeRecord = Prisma.PurchaseOrderGetPayload<{ select: typeof NOTICE_SELECT }>;

const OPEN_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'];

export interface SupplierPageRow {
  id: string;
  name: string;
  code: string;
  status: SupplierStatus;
  category: string | null;
  contact: { name: string; phone: string | null; whatsapp: string | null } | null;
}

export interface SupplierLineWithItem {
  inventoryItemId: string;
  buyUnit: string | null;
  packSize: Prisma.Decimal | null;
  lastPrice: Prisma.Decimal | null;
  item: ItemFacts;
}

export const attendantRepository = {
  /** The Store Manager the orders wait on: the first active one of the hub. */
  findApprover: (siteId: string): Promise<Approver | null> =>
    prisma.user.findFirst({ where: { siteId, role: 'STORE_MANAGER', isActive: true, deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, role: true } }),

  // ------------------------------------------------------------ restock levels

  /** Every item with a Central Store restock level above zero, with what is on hand (Paper 28P). */
  findLevelItems: (scope: Scope): Promise<LevelItem[]> =>
    prisma.$queryRaw<LevelItem[]>`
      SELECT i.id, i.name, i.usage_unit AS "usageUnit", i.buy_unit AS "buyUnit", i.pack_size AS "packSize",
             i.preferred_supplier_id AS "preferredSupplierId", COALESCE(oh.on_hand, 0) AS "onHand", rl.level AS level
      FROM inventory_items i
      JOIN restock_levels rl
        ON rl.inventory_item_id = i.id AND rl.location_id = ${scope.locationId} AND rl.organization_id = ${scope.siteId}
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity) AS on_hand
        FROM inventory_transactions
        WHERE organization_id = ${scope.siteId} AND location_id = ${scope.locationId}
        GROUP BY inventory_item_id
      ) oh ON oh.inventory_item_id = i.id
      WHERE i.organization_id = ${scope.siteId} AND i.deleted_at IS NULL AND rl.level > 0
    `,

  // ------------------------------------------------------------ search

  /** Items whose name matches, with stock and level (the level is null for an item with none set). */
  searchItems: (scope: Scope, q: string, take: number): Promise<ItemWithStock[]> => {
    const like = likeOf(q);
    return prisma.$queryRaw<ItemWithStock[]>`
      SELECT i.id, i.name, i.usage_unit AS "usageUnit", i.buy_unit AS "buyUnit", i.pack_size AS "packSize",
             i.preferred_supplier_id AS "preferredSupplierId", COALESCE(oh.on_hand, 0) AS "onHand", rl.level AS level
      FROM inventory_items i
      LEFT JOIN restock_levels rl
        ON rl.inventory_item_id = i.id AND rl.location_id = ${scope.locationId} AND rl.organization_id = ${scope.siteId}
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity) AS on_hand
        FROM inventory_transactions
        WHERE organization_id = ${scope.siteId} AND location_id = ${scope.locationId}
        GROUP BY inventory_item_id
      ) oh ON oh.inventory_item_id = i.id
      WHERE i.organization_id = ${scope.siteId} AND i.deleted_at IS NULL AND i.name ILIKE ${like}
      ORDER BY i.name ASC
      LIMIT ${take}
    `;
  },

  countItems: (siteId: string, q: string): Promise<number> => prisma.inventoryItem.count({ where: { siteId, deletedAt: null, name: { contains: q, mode: 'insensitive' } } }),

  /** The open order (draft to sent) that already holds each of these items. */
  findOpenOrderLines: async (siteId: string, itemIds: readonly string[]): Promise<Map<string, { orderId: string; reference: string | null }>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await prisma.purchaseOrderLine.findMany({
      where: { inventoryItemId: { in: [...itemIds] }, order: { siteId, status: { in: OPEN_STATUSES } } },
      select: { inventoryItemId: true, order: { select: { id: true, reference: true } } },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, { orderId: r.order.id, reference: r.order.reference }]));
  },

  /** Live suppliers whose name or code matches, with how many open orders and items we buy from each. */
  searchSuppliers: async (siteId: string, q: string, take: number): Promise<{ total: number; rows: Array<{ id: string; name: string; openOrderCount: number; itemCount: number }> }> => {
    const where: Prisma.SupplierWhereInput = {
      siteId,
      deletedAt: null,
      status: { not: 'ARCHIVED' },
      OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
    };
    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        take,
        select: { id: true, name: true, _count: { select: { items: true } }, purchaseOrders: { where: { status: { in: OPEN_STATUSES } }, select: { id: true } } },
      }),
    ]);
    return { total, rows: suppliers.map((s) => ({ id: s.id, name: s.name, itemCount: s._count.items, openOrderCount: s.purchaseOrders.length })) };
  },

  /** Orders whose number, supplier or an item matches. Drafts are not shown: nobody has sent them. */
  searchOrders: async (
    siteId: string,
    q: string,
    take: number,
  ): Promise<{
    total: number;
    rows: Array<{ id: string; reference: string | null; status: PurchaseOrderStatus; expectedDate: Date | null; closedAt: Date | null; cancelledAt: Date | null; supplier: { id: string; name: string }; lineCount: number }>;
  }> => {
    const where: Prisma.PurchaseOrderWhereInput = {
      siteId,
      status: { not: 'DRAFT' },
      OR: [
        { reference: { contains: q, mode: 'insensitive' } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
        { lines: { some: { inventoryItem: { name: { contains: q, mode: 'insensitive' } } } } },
      ],
    };
    const [total, rows] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, reference: true, status: true, expectedDate: true, closedAt: true, cancelledAt: true, supplier: { select: { id: true, name: true } }, _count: { select: { lines: true } } },
      }),
    ]);
    return { total, rows: rows.map(({ _count, ...r }) => ({ ...r, lineCount: _count.lines })) };
  },

  // ------------------------------------------------------------ supplier page

  findSupplierPage: async (siteId: string, supplierId: string): Promise<SupplierPageRow | null> => {
    const s = await prisma.supplier.findFirst({
      where: { id: supplierId, siteId, deletedAt: null },
      select: { id: true, name: true, code: true, status: true, category: { select: { name: true } }, contacts: { where: { isPrimary: true }, take: 1, select: { name: true, phone: true, whatsapp: true } } },
    });
    return s ? { id: s.id, name: s.name, code: s.code, status: s.status, category: s.category?.name ?? null, contact: s.contacts[0] ?? null } : null;
  },

  /** What we buy from this supplier: one row per catalog line, with the item's units. */
  findSupplierLinesWithItems: async (siteId: string, supplierId: string): Promise<SupplierLineWithItem[]> => {
    const rows = await prisma.supplierItem.findMany({
      where: { siteId, supplierId, inventoryItem: { deletedAt: null } },
      select: {
        inventoryItemId: true,
        buyUnit: true,
        packSize: true,
        lastPrice: true,
        inventoryItem: { select: { id: true, name: true, usageUnit: true, buyUnit: true, packSize: true, preferredSupplierId: true } },
      },
      orderBy: { inventoryItem: { name: 'asc' } },
    });
    return rows.map(({ inventoryItem, ...line }) => ({ ...line, item: inventoryItem }));
  },

  // ------------------------------------------------------------ history

  /** Ids of the closed (paid) and cancelled orders for one page, newest closing first, with the total the pager needs. */
  listClosedIds: async (siteId: string, f: HistoryFilter, skip: number, take: number): Promise<{ ids: string[]; total: number }> => {
    const like = likeOf(f.q);
    const raisedBy = f.raisedById ?? null;
    const statusSql = f.status === 'paid' ? Prisma.sql`po.status = 'CLOSED'` : f.status === 'cancelled' ? Prisma.sql`po.status = 'CANCELLED'` : Prisma.sql`po.status IN ('CLOSED', 'CANCELLED')`;
    const where = Prisma.sql`
      po.organization_id = ${siteId}
      AND ${statusSql}
      AND COALESCE(po.closed_at, po.cancelled_at) >= ${f.from}
      AND COALESCE(po.closed_at, po.cancelled_at) < ${f.toExclusive}
      AND (${raisedBy}::text IS NULL OR po.raised_by_id = ${raisedBy})
      AND (${like}::text IS NULL
        OR po.reference ILIKE ${like}
        OR EXISTS (SELECT 1 FROM suppliers s WHERE s.id = po.supplier_id AND s.name ILIKE ${like})
        OR EXISTS (SELECT 1 FROM purchase_order_lines pl JOIN inventory_items ii ON ii.id = pl.inventory_item_id WHERE pl.order_id = po.id AND ii.name ILIKE ${like}))`;
    const [rows, count] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string }>>`SELECT po.id FROM purchase_orders po WHERE ${where} ORDER BY COALESCE(po.closed_at, po.cancelled_at) DESC, po.id DESC OFFSET ${skip} LIMIT ${take}`,
      prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM purchase_orders po WHERE ${where}`,
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count[0]?.n ?? 0) };
  },

  /** The header counts of History: everything closed or cancelled, and how many of those fall inside the range. */
  countClosed: async (siteId: string, from: Date, toExclusive: Date): Promise<{ allTime: number; inRange: number }> => {
    const [allTime, rows] = await Promise.all([
      prisma.purchaseOrder.count({ where: { siteId, status: { in: ['CLOSED', 'CANCELLED'] } } }),
      prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*) AS n FROM purchase_orders po
        WHERE po.organization_id = ${siteId} AND po.status IN ('CLOSED', 'CANCELLED')
          AND COALESCE(po.closed_at, po.cancelled_at) >= ${from} AND COALESCE(po.closed_at, po.cancelled_at) < ${toExclusive}`,
    ]);
    return { allTime, inRange: Number(rows[0]?.n ?? 0) };
  },

  findHistoryRecords: async (siteId: string, ids: readonly string[]): Promise<HistoryRecord[]> => {
    if (ids.length === 0) return [];
    const rows = await prisma.purchaseOrder.findMany({ where: { siteId, id: { in: [...ids] } }, select: HISTORY_SELECT });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  },

  // ------------------------------------------------------------ notifications

  /**
   * The orders the caller's notices come from: those they raised that were approved, sent back or closed lately, and (when they may
   * receive) every sent order whose delivery date is within the window and not in the future.
   */
  findNoticeOrders: (siteId: string, actorId: string, since: Date, today: Date, includeDue: boolean): Promise<NoticeRecord[]> =>
    prisma.purchaseOrder.findMany({
      where: {
        siteId,
        OR: [
          { raisedById: actorId, OR: [{ approvedAt: { gte: since } }, { returnedAt: { gte: since } }, { closedAt: { gte: since } }] },
          ...(includeDue ? [{ status: 'SENT' as const, expectedDate: { gte: since, lte: today } }] : []),
        ],
      },
      select: NOTICE_SELECT,
    }),

  findReadKeys: async (userId: string): Promise<Set<string>> => {
    const rows = await prisma.purchasingNoticeRead.findMany({ where: { userId }, select: { noticeKey: true } });
    return new Set(rows.map((r) => r.noticeKey));
  },

  markRead: async (userId: string, keys: readonly string[], at: Date): Promise<void> => {
    if (keys.length === 0) return;
    await prisma.purchasingNoticeRead.createMany({ data: keys.map((noticeKey) => ({ userId, noticeKey, readAt: at })), skipDuplicates: true });
  },

  // ------------------------------------------------------------ the 08:00 job

  /** Sent orders of the hub expected on this day (a `@db.Date` value): the 08:00 "due today" and first "overdue" pushes. */
  findSentDueOn: async (siteId: string, day: Date): Promise<Array<{ id: string; reference: string | null; supplierName: string; itemCount: number }>> => {
    const rows = await prisma.purchaseOrder.findMany({
      where: { siteId, status: 'SENT', expectedDate: day },
      select: { id: true, reference: true, supplier: { select: { name: true } }, _count: { select: { lines: true } } },
    });
    return rows.map((r) => ({ id: r.id, reference: r.reference, supplierName: r.supplier.name, itemCount: r._count.lines }));
  },
};
