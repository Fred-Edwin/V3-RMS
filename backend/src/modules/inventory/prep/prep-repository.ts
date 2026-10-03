import { Prisma, type PrepRun, type PrepRunInputLine } from '@prisma/client';
import { prisma } from '../../../config/database';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Prep runs (Stage 3 — Milestone Three). The ledger write itself
// (InventoryTransaction PREP_CONSUME/PREP_PRODUCE rows + InventoryItem.
// currentCost) happens in the service's create transaction, not here — this
// repository only owns the PrepRun/PrepRunInputLine rows and the read
// queries the service derives its response shapes from.
// ---------------------------------------------------------------------------

export type PrepRunWithRelations = PrepRun & {
  outputItem: { id: string; name: string; usageUnit: string };
  location: { id: string };
  createdBy: { id: string; name: string };
  inputLines: (PrepRunInputLine & {
    inputItem: { id: string; name: string; usageUnit: string };
  })[];
};

/** Lighter projection for the rolling-average query — no line detail needed. */
export type PrepRunForRollingAverage = {
  id: string;
  actualYield: Prisma.Decimal;
  createdAt: Date;
};

export type CreatePrepRunInputLine = {
  inputItemId: string;
  quantity: Prisma.Decimal.Value;
  unitCostAtRunTime: Prisma.Decimal.Value;
  lineCost: Prisma.Decimal.Value;
};

export type CreatePrepRunInput = {
  outputItemId: string;
  actualYield: Prisma.Decimal.Value;
  outputUnitCost: Prisma.Decimal.Value;
  totalInputCost: Prisma.Decimal.Value;
  typicalYieldAtRunTime: Prisma.Decimal.Value | null;
  yieldVarianceLabel: string | null;
  notifiedStoreManager: boolean;
  locationId: string;
  createdById: string;
  inputLines: CreatePrepRunInputLine[];
};

export type ListPrepRunsFilters = {
  search?: string;
  outputItemId?: string;
  /** Equality filter against the stored `yieldVarianceLabel` column — the service maps the query's single-word enum ('low'/'high'/'normal') to the stored two-word label before calling this. */
  yieldVarianceLabel?: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: string;
};

const prepRunInclude = {
  outputItem: { select: { id: true, name: true, usageUnit: true } },
  location: { select: { id: true } },
  createdBy: { select: { id: true, name: true } },
  inputLines: {
    include: {
      inputItem: { select: { id: true, name: true, usageUnit: true } },
    },
    orderBy: { lineOrder: 'asc' },
  },
} satisfies Prisma.PrepRunInclude;

export const prepRunRepository = {
  findAllBySite: async (
    siteId: string,
    filters: ListPrepRunsFilters,
  ): Promise<PrepRunWithRelations[]> => {
    const where: Prisma.PrepRunWhereInput = {
      siteId,
      ...(filters.outputItemId ? { outputItemId: filters.outputItemId } : {}),
      ...(filters.yieldVarianceLabel ? { yieldVarianceLabel: filters.yieldVarianceLabel } : {}),
      ...(filters.search
        ? {
            OR: [
              { outputItem: { name: { contains: filters.search, mode: 'insensitive' } } },
              { createdBy: { name: { contains: filters.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };

    return prisma.prepRun.findMany({
      where,
      include: prepRunInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
  },

  findById: async (id: string, siteId: string, client: Client = prisma): Promise<PrepRunWithRelations | null> => {
    return client.prepRun.findFirst({ where: { id, siteId }, include: prepRunInclude });
  },

  create: async (siteId: string, input: CreatePrepRunInput, tx: TxClient): Promise<PrepRunWithRelations> => {
    return tx.prepRun.create({
      data: {
        siteId,
        outputItemId: input.outputItemId,
        actualYield: new Prisma.Decimal(input.actualYield),
        outputUnitCost: new Prisma.Decimal(input.outputUnitCost),
        totalInputCost: new Prisma.Decimal(input.totalInputCost),
        typicalYieldAtRunTime:
          input.typicalYieldAtRunTime !== null ? new Prisma.Decimal(input.typicalYieldAtRunTime) : null,
        yieldVarianceLabel: input.yieldVarianceLabel,
        notifiedStoreManager: input.notifiedStoreManager,
        locationId: input.locationId,
        createdById: input.createdById,
        inputLines: {
          createMany: {
            data: input.inputLines.map((line, index) => ({
              inputItemId: line.inputItemId,
              quantity: new Prisma.Decimal(line.quantity),
              unitCostAtRunTime: new Prisma.Decimal(line.unitCostAtRunTime),
              lineCost: new Prisma.Decimal(line.lineCost),
              lineOrder: index,
            })),
          },
        },
      },
      include: prepRunInclude,
    });
  },

  /**
   * Rolling-average source query (plan §1.3, §6 Q3): up to
   * ROLLING_AVERAGE_MAX_RUNS most recent runs for this output item. The
   * service applies the "last N runs OR last 30 days, whichever gives fewer
   * data points" rule in memory against this result — two competing
   * "fewer" windows can't both be expressed as one Prisma query, and this
   * row count is cheap. Flagged/outlier runs are never filtered out here —
   * no yieldVarianceLabel condition in this query, ever (plan §6 Q3b).
   */
  findRecentForRollingAverage: async (
    siteId: string,
    outputItemId: string,
    maxRuns: number,
  ): Promise<PrepRunForRollingAverage[]> => {
    return prisma.prepRun.findMany({
      where: { siteId, outputItemId },
      select: { id: true, actualYield: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: maxRuns,
    });
  },

  /**
   * Backs `GET /inventory/prep/summary` — runsInRange count, totalInputCost
   * sum, yieldFlagCount. One narrow-select query; the service sums
   * totalInputCost in JS with Prisma.Decimal (same pattern as
   * receiving-service.ts's getApSummary manual reduce loop) rather than a
   * second aggregate query.
   */
  findSummaryRows: async (
    siteId: string,
    range: { from?: Date; to?: Date },
  ): Promise<{ totalInputCost: Prisma.Decimal; yieldVarianceLabel: string | null }[]> => {
    return prisma.prepRun.findMany({
      where: {
        siteId,
        ...(range.from || range.to
          ? { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
          : {}),
      },
      select: { totalInputCost: true, yieldVarianceLabel: true },
    });
  },
};
