import { Prisma, type InventoryTransactionType, type PrepCancelReason, type PrepCorrectReason, type PrepExpectedSource, type PrepRunStatus, type PrepYieldReason } from '@prisma/client';
import { prisma } from '../../../../config/database';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

const userSelect = { id: true, name: true, role: true } satisfies Prisma.UserSelect;

/** Everything a run's summary and detail screens need, in one read. */
export const prepRunInclude = {
  outputItem: { select: { id: true, name: true, usageUnit: true } },
  createdBy: { select: userSelect },
  closedBy: { select: userSelect },
  reviewedBy: { select: userSelect },
  // The replaced run's figures too: a correction's side-by-side comparison is built from them.
  replacesRun: {
    select: {
      id: true,
      reference: true,
      createdAt: true,
      actualYield: true,
      outputUnitCost: true,
      inputLines: {
        orderBy: { lineOrder: 'asc' },
        select: { inputItemId: true, quantity: true, unitCostAtRunTime: true, inputItem: { select: { name: true, usageUnit: true } } },
      },
    },
  },
  replacedByRun: { select: { id: true, reference: true, createdAt: true } },
  recipeVersion: { select: { version: true } },
  inputLines: {
    orderBy: { lineOrder: 'asc' },
    include: { inputItem: { select: { id: true, name: true, usageUnit: true } } },
  },
} satisfies Prisma.PrepRunInclude;

export type PrepRunRow = Prisma.PrepRunGetPayload<{ include: typeof prepRunInclude }>;

export type PrepItemRow = {
  id: string;
  name: string;
  type: 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED';
  usageUnit: string;
  currentCost: Prisma.Decimal;
  deletedAt: Date | null;
};

export type CreatePrepRunData = {
  siteId: string;
  reference: string;
  idempotencyKey: string;
  outputItemId: string;
  actualYield: Prisma.Decimal;
  outputUnitCost: Prisma.Decimal;
  totalInputCost: Prisma.Decimal;
  yieldVarianceLabel: string | null;
  notifiedStoreManager: boolean;
  expectedYield: Prisma.Decimal | null;
  expectedSource: PrepExpectedSource;
  recipeVersionId: string | null;
  stockFlag: boolean;
  needsLook: boolean;
  yieldReason: PrepYieldReason | null;
  reasonNote: string | null;
  locationId: string;
  createdById: string;
  /** Set only on the new run of a correction. */
  replacesRunId?: string;
  correctionReason?: PrepCorrectReason;
  lines: {
    inputItemId: string;
    quantity: Prisma.Decimal;
    unitCostAtRunTime: Prisma.Decimal;
    lineCost: Prisma.Decimal;
    onHandAtRunTime: Prisma.Decimal;
  }[];
};

export type RunListFilters = {
  search?: string;
  outputItemId?: string;
  personId?: string;
  status?: PrepRunStatus;
  needsLook?: boolean;
  /** Set to the caller's id when the list is "mine". */
  mineUserId?: string;
  /** `[from, to)` instants (already read as Nairobi days by the service). */
  from?: Date;
  to?: Date;
  page: number;
  perPage: number;
};

const listWhere = (siteId: string, filters: RunListFilters): Prisma.PrepRunWhereInput => ({
  siteId,
  ...(filters.outputItemId ? { outputItemId: filters.outputItemId } : {}),
  ...(filters.personId ? { createdById: filters.personId } : {}),
  ...(filters.mineUserId ? { createdById: filters.mineUserId } : {}),
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.needsLook !== undefined ? { needsLook: filters.needsLook } : {}),
  ...(filters.search
    ? {
        OR: [
          { reference: { contains: filters.search, mode: 'insensitive' } },
          { outputItem: { name: { contains: filters.search, mode: 'insensitive' } } },
          { createdBy: { name: { contains: filters.search, mode: 'insensitive' } } },
        ],
      }
    : {}),
  ...(filters.from || filters.to
    ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } }
    : {}),
});

export const prepRunRepository = {
  findById: (siteId: string, id: string, client: Client = prisma): Promise<PrepRunRow | null> =>
    client.prepRun.findFirst({ where: { id, siteId }, include: prepRunInclude }),

  findByIdempotencyKey: (siteId: string, userId: string, key: string, client: Client = prisma): Promise<PrepRunRow | null> =>
    client.prepRun.findFirst({ where: { siteId, createdById: userId, idempotencyKey: key }, include: prepRunInclude }),

  list: async (siteId: string, filters: RunListFilters): Promise<{ items: PrepRunRow[]; total: number }> => {
    const where = listWhere(siteId, filters);
    const [items, total] = await Promise.all([
      prisma.prepRun.findMany({
        where,
        include: prepRunInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      prisma.prepRun.count({ where }),
    ]);
    return { items, total };
  },

  /** Items in this site by id, retired ones included (the service answers 409 for a retired one). */
  findItems: (siteId: string, ids: string[], client: Client = prisma): Promise<PrepItemRow[]> =>
    client.inventoryItem.findMany({
      where: { siteId, id: { in: ids } },
      select: { id: true, name: true, type: true, usageUnit: true, currentCost: true, deletedAt: true },
    }),

  /** Every live PREPPED item, A to Z: the "Something else" picker. */
  findLiveOutputs: (siteId: string): Promise<{ id: string; name: string; usageUnit: string }[]> =>
    prisma.inventoryItem.findMany({
      where: { siteId, type: 'PREPPED', deletedAt: null },
      select: { id: true, name: true, usageUnit: true },
      orderBy: { name: 'asc' },
    }),

  /** The newest RECORDED runs of one output (the past-runs figure takes the last 10 or the last 30 days, whichever is fewer). */
  recentRecordedYields: (siteId: string, outputItemId: string, take: number, client: Client = prisma): Promise<{ actualYield: Prisma.Decimal; createdAt: Date }[]> =>
    client.prepRun.findMany({
      where: { siteId, outputItemId, status: 'RECORDED' },
      select: { actualYield: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take,
    }),

  /** RECORDED yields since a moment, for several outputs at once (the outputs list's "about 3 kg, from past runs"). */
  recordedYieldsSince: (siteId: string, outputItemIds: string[], since: Date): Promise<{ outputItemId: string; actualYield: Prisma.Decimal; createdAt: Date }[]> =>
    prisma.prepRun.findMany({
      where: { siteId, outputItemId: { in: outputItemIds }, status: 'RECORDED', createdAt: { gte: since } },
      select: { outputItemId: true, actualYield: true, createdAt: true },
    }),

  /** RECORDED runs of one output inside `[start, end)`, with their input amounts: the repeat check. */
  recordedRunsBetween: (siteId: string, outputItemId: string, start: Date, end: Date, client: Client = prisma) =>
    client.prepRun.findMany({
      where: { siteId, outputItemId, status: 'RECORDED', createdAt: { gte: start, lt: end } },
      select: { id: true, reference: true, createdAt: true, inputLines: { select: { inputItemId: true, quantity: true } } },
      orderBy: { createdAt: 'desc' },
    }),

  /** The latest RECORDED run of each given output, with its lines: "as last time". */
  latestRecordedByOutput: async (siteId: string, outputItemIds: string[]) => {
    if (outputItemIds.length === 0) return [];
    return prisma.prepRun.findMany({
      where: { siteId, outputItemId: { in: outputItemIds }, status: 'RECORDED' },
      distinct: ['outputItemId'],
      orderBy: [{ outputItemId: 'asc' }, { createdAt: 'desc' }],
      select: {
        outputItemId: true,
        actualYield: true,
        inputLines: { orderBy: { lineOrder: 'asc' }, select: { inputItemId: true, quantity: true, inputItem: { select: { name: true, usageUnit: true } } } },
      },
    });
  },

  /** Output items ranked by RECORDED runs since a moment (live items only). */
  mostMadeSince: async (siteId: string, since: Date, take: number): Promise<string[]> => {
    // Counted here rather than with groupBy: a groupBy that filters through the output item joins two tables with an `id` column.
    const rows = await prisma.prepRun.findMany({
      where: { siteId, status: 'RECORDED', createdAt: { gte: since }, outputItem: { deletedAt: null, type: 'PREPPED' } },
      select: { outputItemId: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.outputItemId, (counts.get(row.outputItemId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, take).map(([id]) => id);
  },

  /** Output items by most recent RECORDED run, any time, live only, skipping some (fills the Prep-again tiles). */
  mostRecentOutputs: async (siteId: string, excludeIds: string[], take: number): Promise<string[]> => {
    const rows = await prisma.prepRun.findMany({
      where: { siteId, status: 'RECORDED', outputItemId: { notIn: excludeIds }, outputItem: { deletedAt: null, type: 'PREPPED' } },
      distinct: ['outputItemId'],
      orderBy: [{ outputItemId: 'asc' }, { createdAt: 'desc' }],
      select: { outputItemId: true, createdAt: true },
    });
    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take)
      .map((row) => row.outputItemId);
  },

  /** Creates the run and its input lines. Runs inside the record transaction, after the reference is taken. */
  create: (tx: TxClient, data: CreatePrepRunData): Promise<PrepRunRow> =>
    tx.prepRun.create({
      data: {
        siteId: data.siteId,
        reference: data.reference,
        idempotencyKey: data.idempotencyKey,
        outputItemId: data.outputItemId,
        actualYield: data.actualYield,
        outputUnitCost: data.outputUnitCost,
        totalInputCost: data.totalInputCost,
        yieldVarianceLabel: data.yieldVarianceLabel,
        notifiedStoreManager: data.notifiedStoreManager,
        expectedYield: data.expectedYield,
        expectedSource: data.expectedSource,
        recipeVersionId: data.recipeVersionId,
        stockFlag: data.stockFlag,
        needsLook: data.needsLook,
        yieldReason: data.yieldReason,
        reasonNote: data.reasonNote,
        locationId: data.locationId,
        createdById: data.createdById,
        ...(data.replacesRunId ? { replacesRunId: data.replacesRunId } : {}),
        ...(data.correctionReason ? { correctionReason: data.correctionReason } : {}),
        inputLines: {
          createMany: {
            data: data.lines.map((line, index) => ({
              inputItemId: line.inputItemId,
              quantity: line.quantity,
              unitCostAtRunTime: line.unitCostAtRunTime,
              lineCost: line.lineCost,
              onHandAtRunTime: line.onHandAtRunTime,
              lineOrder: index,
            })),
          },
        },
      },
      include: prepRunInclude,
    }),

  /** Takes the row lock on one run (a second fixer waits here), then reads it. Null when it is not in this site. */
  lockForFix: async (tx: TxClient, siteId: string, id: string): Promise<PrepRunRow | null> => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM prep_runs WHERE id = ${id} AND organization_id = ${siteId} FOR UPDATE`;
    if (locked.length === 0) return null;
    return tx.prepRun.findFirst({ where: { id, siteId }, include: prepRunInclude });
  },

  /** The run's original ledger rows that nothing has reversed yet (a reversal is never reversed again). */
  findReversibleRows: (
    siteId: string,
    runId: string,
    client: Client = prisma,
  ): Promise<{ id: string; type: InventoryTransactionType; locationId: string; inventoryItemId: string; quantity: Prisma.Decimal; unitCost: Prisma.Decimal }[]> =>
    client.inventoryTransaction.findMany({
      where: { siteId, prepRecordId: runId, reversesTransactionId: null, reversedBy: null },
      select: { id: true, type: true, locationId: true, inventoryItemId: true, quantity: true, unitCost: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),

  /** The id of the newest RECORDED run of an output: only that run's fix may move the output's cost. */
  latestRecordedRunId: async (siteId: string, outputItemId: string, client: Client = prisma): Promise<string | null> => {
    const row = await client.prepRun.findFirst({
      where: { siteId, outputItemId, status: 'RECORDED' },
      select: { id: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return row?.id ?? null;
  },

  /**
   * Marks a RECORDED run CORRECTED or CANCELLED, once. The run leaves Needs a look (it is superseded; the manager reviews the
   * replacement). False when it was no longer RECORDED.
   */
  closeRun: async (
    tx: TxClient,
    siteId: string,
    id: string,
    data: { status: 'CORRECTED' | 'CANCELLED'; closedById: string; closedAt: Date; cancelReason?: PrepCancelReason; reasonNote?: string | null },
  ): Promise<boolean> => {
    const result = await tx.prepRun.updateMany({
      where: { id, siteId, status: 'RECORDED' },
      data: {
        status: data.status,
        closedAt: data.closedAt,
        closedById: data.closedById,
        needsLook: false,
        ...(data.cancelReason ? { cancelReason: data.cancelReason, reasonNote: data.reasonNote ?? null } : {}),
      },
    });
    return result.count === 1;
  },

  /** Creates the new run of a correction (same as `create`; the data carries `replacesRunId` and `correctionReason`). */
  createReplacement: (tx: TxClient, data: CreatePrepRunData & { replacesRunId: string; correctionReason: PrepCorrectReason }): Promise<PrepRunRow> =>
    prepRunRepository.create(tx, data),

  /** The output item's cost becomes this run's cost per unit (latest-price costing, as Receiving does). */
  setItemCurrentCost: async (tx: TxClient, siteId: string, itemId: string, cost: Prisma.Decimal): Promise<void> => {
    await tx.inventoryItem.updateMany({ where: { id: itemId, siteId }, data: { currentCost: cost } });
  },
};
