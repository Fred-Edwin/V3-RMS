import { Prisma, type MarketPurchaseOrder, type MarketPurchaseOrderStatus, type DepartmentTag } from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient;

const detailInclude = {
  createdBy: { select: { id: true, name: true, role: true } },
  approvedBy: { select: { id: true, name: true, role: true } },
  reconciledBy: { select: { id: true, name: true, role: true } },
  lines: {
    include: {
      inventoryItem: { select: { id: true, name: true, buyUnit: true, usageUnit: true } },
      requestedBy: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, name: true } },
    },
  },
} as const;

export type MarketPurchaseOrderWithDetail = MarketPurchaseOrder & {
  createdBy: { id: string; name: string; role: string };
  approvedBy: { id: string; name: string; role: string } | null;
  reconciledBy: { id: string; name: string; role: string } | null;
  lines: {
    id: string;
    marketPurchaseOrderId: string;
    departmentTag: DepartmentTag;
    requestedById: string;
    inventoryItemId: string;
    requestedQty: Prisma.Decimal;
    actualQty: Prisma.Decimal | null;
    unitPrice: Prisma.Decimal | null;
    confirmedById: string | null;
    confirmedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    inventoryItem: { id: string; name: string; buyUnit: string; usageUnit: string };
    requestedBy: { id: string; name: string };
    confirmedBy: { id: string; name: string } | null;
  }[];
};

/** `MPO-<yymmdd>-<2-digit sequence>` — mirrors PO/delivery-note number generation. */
const generateOrderNumber = async (organizationId: string): Promise<string> => {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `MPO-${y}${m}${d}-`;
  const countToday = await prisma.marketPurchaseOrder.count({
    where: { organizationId, orderNumber: { startsWith: prefix } },
  });
  const seq = String(countToday + 1).padStart(2, '0');
  return `${prefix}${seq}`;
};

export const marketPurchaseOrderRepository = {
  generateOrderNumber,

  /** Exactly one active DRAFT order per branch (D-22) — enforced here, not the DB. */
  findActiveDraft: async (
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<MarketPurchaseOrderWithDetail | null> => {
    return tx.marketPurchaseOrder.findFirst({
      where: { organizationId, status: 'DRAFT' },
      include: detailInclude,
    }) as Promise<MarketPurchaseOrderWithDetail | null>;
  },

  create: async (
    input: { organizationId: string; createdById: string; orderNumber: string },
    tx: TxClient = prisma,
  ): Promise<MarketPurchaseOrderWithDetail> => {
    return tx.marketPurchaseOrder.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        orderNumber: input.orderNumber,
        status: 'DRAFT',
      },
      include: detailInclude,
    }) as Promise<MarketPurchaseOrderWithDetail>;
  },

  findById: async (
    id: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<MarketPurchaseOrderWithDetail | null> => {
    return tx.marketPurchaseOrder.findFirst({
      where: { id, organizationId },
      include: detailInclude,
    }) as Promise<MarketPurchaseOrderWithDetail | null>;
  },

  findAllByOrganization: async (
    organizationId: string,
    filters: { status?: MarketPurchaseOrderStatus } = {},
  ): Promise<MarketPurchaseOrderWithDetail[]> => {
    return prisma.marketPurchaseOrder.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: detailInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<MarketPurchaseOrderWithDetail[]>;
  },

  /** A Dept Head's own department's slice of one order — used by the mobile Receive screen. */
  findByIdForDepartment: async (
    id: string,
    organizationId: string,
    departmentTag: DepartmentTag,
    tx: TxClient = prisma,
  ): Promise<MarketPurchaseOrderWithDetail | null> => {
    const order = (await tx.marketPurchaseOrder.findFirst({
      where: { id, organizationId },
      include: detailInclude,
    })) as MarketPurchaseOrderWithDetail | null;
    if (!order) return null;
    return { ...order, lines: order.lines.filter((l) => l.departmentTag === departmentTag) };
  },

  /** Adds one department's requested item into the currently active draft. */
  addLine: async (
    input: {
      marketPurchaseOrderId: string;
      departmentTag: DepartmentTag;
      requestedById: string;
      inventoryItemId: string;
      requestedQty: Prisma.Decimal.Value;
      notes?: string;
    },
    tx: TxClient = prisma,
  ) => {
    return tx.marketPurchaseOrderLine.create({
      data: {
        marketPurchaseOrderId: input.marketPurchaseOrderId,
        departmentTag: input.departmentTag,
        requestedById: input.requestedById,
        inventoryItemId: input.inventoryItemId,
        requestedQty: new Prisma.Decimal(input.requestedQty),
        notes: input.notes,
      },
    });
  },

  /** Branch Manager's pre-send edit of a draft line's requested quantity. */
  updateLineRequestedQty: async (
    lineId: string,
    marketPurchaseOrderId: string,
    requestedQty: Prisma.Decimal.Value,
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.marketPurchaseOrderLine.updateMany({
      where: { id: lineId, marketPurchaseOrderId },
      data: { requestedQty: new Prisma.Decimal(requestedQty) },
    });
  },

  removeLine: async (lineId: string, marketPurchaseOrderId: string, tx: TxClient = prisma): Promise<void> => {
    await tx.marketPurchaseOrderLine.deleteMany({ where: { id: lineId, marketPurchaseOrderId } });
  },

  /** Sets one line's reconciled actual quantity + price paid (Branch Manager, order-wide event). */
  updateLineReconciliation: async (
    lineId: string,
    marketPurchaseOrderId: string,
    data: { actualQty: Prisma.Decimal.Value; unitPrice: Prisma.Decimal.Value },
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.marketPurchaseOrderLine.updateMany({
      where: { id: lineId, marketPurchaseOrderId },
      data: {
        actualQty: new Prisma.Decimal(data.actualQty),
        unitPrice: new Prisma.Decimal(data.unitPrice),
      },
    });
  },

  /** A Dept Head's independent per-department confirmation of their own lines. */
  confirmLinesForDepartment: async (
    marketPurchaseOrderId: string,
    departmentTag: DepartmentTag,
    confirmedById: string,
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.marketPurchaseOrderLine.updateMany({
      where: { marketPurchaseOrderId, departmentTag, confirmedById: null },
      data: { confirmedById, confirmedAt: new Date() },
    });
  },

  transitionStatus: async (
    id: string,
    organizationId: string,
    fromStatuses: MarketPurchaseOrderStatus[],
    toStatus: MarketPurchaseOrderStatus,
    extra: {
      approvedById?: string;
      approvedAt?: Date;
      reconciledById?: string;
      reconciledAt?: Date;
      rejectionReason?: string;
    } = {},
    tx: TxClient = prisma,
  ): Promise<boolean> => {
    const result = await tx.marketPurchaseOrder.updateMany({
      where: { id, organizationId, status: { in: fromStatuses } },
      data: { status: toStatus, ...extra },
    });
    return result.count > 0;
  },
};
