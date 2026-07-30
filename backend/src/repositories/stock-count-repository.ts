import { Prisma, type StockCount, type StockCountLine, type StockCountStatus } from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient;

export type StockCountWithLines = StockCount & {
  lines: (StockCountLine & {
    inventoryItem: { id: string; name: string; usageUnit: string; buyUnit: string; conversionFactor: Prisma.Decimal };
  })[];
};

export type CreateStockCountLineInput = {
  inventoryItemId: string;
  sequence: number;
  expectedQty: Prisma.Decimal.Value;
};

export type CreateStockCountInput = {
  locationId: string;
  label: string;
  scheduledDate: Date;
  createdById: string;
  lines: CreateStockCountLineInput[];
};

const detailInclude = {
  lines: {
    include: { inventoryItem: { select: { id: true, name: true, usageUnit: true, buyUnit: true, conversionFactor: true } } },
    orderBy: { sequence: 'asc' as const },
  },
} as const;

export const stockCountRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: { locationId?: string; status?: StockCountStatus } = {},
  ): Promise<StockCountWithLines[]> => {
    return prisma.stockCount.findMany({
      where: {
        organizationId,
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: detailInclude,
      orderBy: { scheduledDate: 'desc' },
    });
  },

  findById: async (
    id: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<StockCountWithLines | null> => {
    return tx.stockCount.findFirst({
      where: { id, organizationId },
      include: detailInclude,
    });
  },

  create: async (organizationId: string, data: CreateStockCountInput): Promise<StockCountWithLines> => {
    return prisma.stockCount.create({
      data: {
        organizationId,
        locationId: data.locationId,
        label: data.label,
        scheduledDate: data.scheduledDate,
        createdById: data.createdById,
        status: 'IN_PROGRESS',
        lines: {
          create: data.lines.map((line) => ({
            organizationId,
            inventoryItemId: line.inventoryItemId,
            sequence: line.sequence,
            expectedQty: new Prisma.Decimal(line.expectedQty),
          })),
        },
      },
      include: detailInclude,
    });
  },

  /** Scoped status transition — returns false if no row matched (wrong org, or not in `fromStatus`). */
  transitionStatus: async (
    id: string,
    organizationId: string,
    fromStatuses: StockCountStatus[],
    toStatus: StockCountStatus,
    extra: {
      submittedById?: string;
      submittedAt?: Date;
      approvedById?: string;
      approvedAt?: Date;
    } = {},
    tx: TxClient = prisma,
  ): Promise<boolean> => {
    const result = await tx.stockCount.updateMany({
      where: { id, organizationId, status: { in: fromStatuses } },
      data: { status: toStatus, ...extra },
    });
    return result.count > 0;
  },

  updateLineCount: async (
    lineId: string,
    organizationId: string,
    data: { countedQty: Prisma.Decimal.Value; gapQty: Prisma.Decimal.Value },
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.stockCountLine.updateMany({
      where: { id: lineId, organizationId },
      data: {
        countedQty: new Prisma.Decimal(data.countedQty),
        gapQty: new Prisma.Decimal(data.gapQty),
      },
    });
  },

  findLineById: async (
    lineId: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<StockCountLine | null> => {
    return tx.stockCountLine.findFirst({ where: { id: lineId, organizationId } });
  },
};
