import { Prisma, type Dispatch, type DispatchStatus } from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient;

export type DispatchLineInput = {
  inventoryItemId: string;
  requestedQty: Prisma.Decimal.Value;
  unitCost: Prisma.Decimal.Value;
};

export type CreateDispatchInput = {
  fromOrganizationId: string;
  toOrganizationId: string;
  requisitionId?: string | null;
  fromLocationId: string;
  toLocationId: string;
  lines: DispatchLineInput[];
};

const detailInclude = {
  fromLocation: { select: { id: true, name: true } },
  toLocation: { select: { id: true, name: true, departmentTag: true, organizationId: true } },
  requisition: { select: { id: true, requestedById: true } },
  dispatchedBy: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
  lines: {
    include: {
      inventoryItem: { select: { id: true, name: true, buyUnit: true, usageUnit: true } },
    },
  },
} as const;

export type DispatchWithDetail = Dispatch & {
  fromLocation: { id: string; name: string };
  toLocation: { id: string; name: string; departmentTag: string | null; organizationId: string };
  requisition: { id: string; requestedById: string } | null;
  dispatchedBy: { id: string; name: string } | null;
  receivedBy: { id: string; name: string } | null;
  lines: {
    id: string;
    dispatchId: string;
    inventoryItemId: string;
    requestedQty: Prisma.Decimal;
    dispatchedQty: Prisma.Decimal | null;
    receivedQty: Prisma.Decimal | null;
    unitCost: Prisma.Decimal;
    inventoryItem: { id: string; name: string; buyUnit: string; usageUnit: string };
  }[];
};

export const dispatchRepository = {
  create: async (input: CreateDispatchInput, tx: TxClient = prisma): Promise<DispatchWithDetail> => {
    return tx.dispatch.create({
      data: {
        fromOrganizationId: input.fromOrganizationId,
        toOrganizationId: input.toOrganizationId,
        requisitionId: input.requisitionId ?? undefined,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        status: 'PICKING',
        lines: {
          create: input.lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            requestedQty: new Prisma.Decimal(line.requestedQty),
            unitCost: new Prisma.Decimal(line.unitCost),
          })),
        },
      },
      include: detailInclude,
    }) as Promise<DispatchWithDetail>;
  },

  /**
   * D-16: the either-side dual-org read. Confined to this repository — no
   * service anywhere else may build an ad-hoc query against Dispatch that
   * matches only one side, and no other table gets this treatment.
   */
  findVisibleTo: async (
    id: string,
    orgId: string,
    tx: TxClient = prisma,
  ): Promise<DispatchWithDetail | null> => {
    return tx.dispatch.findFirst({
      where: { id, OR: [{ fromOrganizationId: orgId }, { toOrganizationId: orgId }] },
      include: detailInclude,
    }) as Promise<DispatchWithDetail | null>;
  },

  listVisibleTo: async (
    orgId: string,
    filters: { status?: DispatchStatus } = {},
  ): Promise<DispatchWithDetail[]> => {
    return prisma.dispatch.findMany({
      where: {
        OR: [{ fromOrganizationId: orgId }, { toOrganizationId: orgId }],
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: detailInclude,
      orderBy: { createdAt: 'asc' },
    }) as Promise<DispatchWithDetail[]>;
  },

  transitionStatus: async (
    id: string,
    orgId: string,
    fromStatuses: DispatchStatus[],
    toStatus: DispatchStatus,
    extra: {
      dispatchedById?: string;
      dispatchedAt?: Date;
      receivedById?: string;
      receivedAt?: Date;
      deliveryNoteNumber?: string;
    } = {},
    tx: TxClient = prisma,
  ): Promise<boolean> => {
    const result = await tx.dispatch.updateMany({
      where: {
        id,
        status: { in: fromStatuses },
        OR: [{ fromOrganizationId: orgId }, { toOrganizationId: orgId }],
      },
      data: { status: toStatus, ...extra },
    });
    return result.count > 0;
  },

  updateLineDispatchedQty: async (
    lineId: string,
    dispatchId: string,
    dispatchedQty: Prisma.Decimal.Value,
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.dispatchLine.updateMany({
      where: { id: lineId, dispatchId },
      data: { dispatchedQty: new Prisma.Decimal(dispatchedQty) },
    });
  },

  updateLineReceivedQty: async (
    lineId: string,
    dispatchId: string,
    receivedQty: Prisma.Decimal.Value,
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.dispatchLine.updateMany({
      where: { id: lineId, dispatchId },
      data: { receivedQty: new Prisma.Decimal(receivedQty) },
    });
  },
};
