import { Prisma, type Requisition, type RequisitionStatus } from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient;

export type RequisitionLineInput = {
  inventoryItemId: string;
  requestedQty: Prisma.Decimal.Value;
  notes?: string;
};

export type CreateRequisitionInput = {
  organizationId: string;
  locationId: string;
  requestedById: string;
  notes?: string;
  lines: RequisitionLineInput[];
};

const detailInclude = {
  location: { select: { id: true, name: true, departmentTag: true } },
  requestedBy: { select: { id: true, name: true, role: true } },
  approvedBy: { select: { id: true, name: true, role: true } },
  lines: {
    include: {
      inventoryItem: {
        select: { id: true, name: true, buyUnit: true, usageUnit: true, currentCost: true },
      },
    },
  },
} as const;

export type RequisitionWithDetail = Requisition & {
  location: { id: string; name: string; departmentTag: string | null };
  requestedBy: { id: string; name: string; role: string };
  approvedBy: { id: string; name: string; role: string } | null;
  lines: {
    id: string;
    requisitionId: string;
    inventoryItemId: string;
    requestedQty: Prisma.Decimal;
    approvedQty: Prisma.Decimal | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    inventoryItem: { id: string; name: string; buyUnit: string; usageUnit: string; currentCost: Prisma.Decimal };
  }[];
};

export const requisitionRepository = {
  create: async (input: CreateRequisitionInput, tx: TxClient = prisma): Promise<RequisitionWithDetail> => {
    return tx.requisition.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        requestedById: input.requestedById,
        notes: input.notes,
        status: 'PENDING_MANAGER_APPROVAL',
        lines: {
          create: input.lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            requestedQty: new Prisma.Decimal(line.requestedQty),
            notes: line.notes,
          })),
        },
      },
      include: detailInclude,
    }) as Promise<RequisitionWithDetail>;
  },

  findById: async (
    id: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<RequisitionWithDetail | null> => {
    return tx.requisition.findFirst({
      where: { id, organizationId },
      include: detailInclude,
    }) as Promise<RequisitionWithDetail | null>;
  },

  findAllByOrganization: async (
    organizationId: string,
    filters: { status?: RequisitionStatus; locationId?: string; requestedById?: string } = {},
  ): Promise<RequisitionWithDetail[]> => {
    return prisma.requisition.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
      },
      include: detailInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<RequisitionWithDetail[]>;
  },

  /** Scoped status transition — returns false if no row matched (wrong org, or not in `fromStatuses`). */
  transitionStatus: async (
    id: string,
    organizationId: string,
    fromStatuses: RequisitionStatus[],
    toStatus: RequisitionStatus,
    extra: {
      approvedById?: string | null;
      approvedAt?: Date | null;
      rejectionReason?: string | null;
    } = {},
    tx: TxClient = prisma,
  ): Promise<boolean> => {
    const result = await tx.requisition.updateMany({
      where: { id, organizationId, status: { in: fromStatuses } },
      data: { status: toStatus, ...extra },
    });
    return result.count > 0;
  },

  /** Sets each line's approvedQty. Manager may edit any subset of lines while approving. */
  updateLineApprovedQty: async (
    lineId: string,
    requisitionId: string,
    approvedQty: Prisma.Decimal.Value,
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.requisitionLine.updateMany({
      where: { id: lineId, requisitionId },
      data: { approvedQty: new Prisma.Decimal(approvedQty) },
    });
  },

  /** Replaces a requisition's lines wholesale — used by edit-and-resubmit (Q6) on a REJECTED requisition. */
  replaceLines: async (
    requisitionId: string,
    lines: RequisitionLineInput[],
    tx: TxClient,
  ): Promise<void> => {
    await tx.requisitionLine.deleteMany({ where: { requisitionId } });
    await tx.requisitionLine.createMany({
      data: lines.map((line) => ({
        requisitionId,
        inventoryItemId: line.inventoryItemId,
        requestedQty: new Prisma.Decimal(line.requestedQty),
        notes: line.notes,
      })),
    });
  },
};
