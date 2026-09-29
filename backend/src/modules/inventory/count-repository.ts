import {
  Prisma,
  type CountLineDecision,
  type CountReason,
  type StockCount,
  type StockCountKind,
  type StockCountLine,
  type StockCountStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Central Store counting (Milestone Six, Session 2). Owns StockCount /
// StockCountLine rows and the on-hand snapshot read. The ADJUSTMENT ledger
// rows are written by the service inside the same $transaction as the status
// change (prep-service.ts / waste-service.ts precedent). Every query is scoped
// by the hub organizationId (Non-Negotiable #3).
// ---------------------------------------------------------------------------

export type CountLineWithItem = StockCountLine & {
  inventoryItem: { id: string; name: string; usageUnit: string; categoryId: string | null; currentCost: Prisma.Decimal };
  transactions: { id: string; reference: string | null }[];
};

export type CountWithRelations = StockCount & {
  counter: { id: string; name: string };
  verifier: { id: string; name: string } | null;
  returnedBy: { id: string; name: string } | null;
  lines: CountLineWithItem[];
};

const lineInclude = {
  inventoryItem: { select: { id: true, name: true, usageUnit: true, categoryId: true, currentCost: true } },
  transactions: { select: { id: true, reference: true }, where: { type: 'ADJUSTMENT' as const } },
} satisfies Prisma.StockCountLineInclude;

const countInclude = {
  counter: { select: { id: true, name: true } },
  verifier: { select: { id: true, name: true } },
  returnedBy: { select: { id: true, name: true } },
  lines: { include: lineInclude, orderBy: { inventoryItem: { name: 'asc' as const } } },
} satisfies Prisma.StockCountInclude;

export type CountSummaryRow = StockCount & {
  counter: { id: string; name: string };
  verifier: { id: string; name: string } | null;
  lines: {
    countedQty: Prisma.Decimal | null;
    expectedQty: Prisma.Decimal | null;
    unitCost: Prisma.Decimal | null;
    decision: CountLineDecision;
    transactions: { id: string }[];
  }[];
};

export type LiveCatalogItem = { id: string; name: string; usageUnit: string; categoryId: string | null; currentCost: Prisma.Decimal };

export const countRepository = {
  /** Live hub catalog items — every one is a line on the daily sheet. */
  listLiveCatalogItems: async (itemOrgId: string, client: Client = prisma): Promise<LiveCatalogItem[]> => {
    return client.inventoryItem.findMany({
      where: { organizationId: itemOrgId, deletedAt: null },
      select: { id: true, name: true, usageUnit: true, categoryId: true, currentCost: true },
      orderBy: { name: 'asc' },
    });
  },

  /** id → {name, parentId}: the tabs are top-level categories (plan §7 Q-C). */
  listCategories: async (
    organizationId: string,
  ): Promise<{ id: string; name: string; parentCategoryId: string | null }[]> => {
    return prisma.category.findMany({
      where: { organizationId },
      select: { id: true, name: true, parentCategoryId: true },
    });
  },

  findDaily: async (
    organizationId: string,
    locationId: string,
    countDate: Date,
    client: Client = prisma,
  ): Promise<CountWithRelations | null> => {
    return client.stockCount.findFirst({
      where: { organizationId, locationId, kind: 'DAILY', countDate },
      include: countInclude,
    });
  },

  findById: async (id: string, organizationId: string, client: Client = prisma): Promise<CountWithRelations | null> => {
    return client.stockCount.findFirst({ where: { id, organizationId }, include: countInclude });
  },

  createDraft: async (
    input: {
      organizationId: string;
      locationId: string;
      countDate: Date;
      reference: string;
      counterId: string;
      itemIds: string[];
    },
    tx: TxClient,
  ): Promise<string> => {
    const created = await tx.stockCount.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        kind: 'DAILY',
        countDate: input.countDate,
        status: 'DRAFT',
        reference: input.reference,
        counterId: input.counterId,
        lines: { create: input.itemIds.map((inventoryItemId) => ({ inventoryItemId })) },
      },
      select: { id: true },
    });
    return created.id;
  },

  /** Items added to the catalog after the draft was opened. */
  addMissingLines: async (stockCountId: string, itemIds: string[], client: Client = prisma): Promise<void> => {
    if (itemIds.length === 0) return;
    await client.stockCountLine.createMany({
      data: itemIds.map((inventoryItemId) => ({ stockCountId, inventoryItemId })),
      skipDuplicates: true,
    });
  },

  setLineCount: async (
    stockCountId: string,
    inventoryItemId: string,
    countedQty: Prisma.Decimal | null,
    client: Client = prisma,
  ): Promise<number> => {
    const result = await client.stockCountLine.updateMany({
      where: { stockCountId, inventoryItemId },
      data: { countedQty },
    });
    return result.count;
  },

  /** Bumps `updatedAt` — the "Saved 07:08" indicator. */
  touch: async (id: string, client: Client = prisma): Promise<Date> => {
    const row = await client.stockCount.update({ where: { id }, data: { updatedAt: new Date() }, select: { updatedAt: true } });
    return row.updatedAt;
  },

  /** Σ ledger per item at the location — the expectedQty snapshot. */
  onHandByItem: async (
    locationOrgId: string,
    locationId: string,
    itemIds: string[],
    client: Client = prisma,
  ): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await client.$queryRaw<{ id: string; on_hand: Prisma.Decimal }[]>`
      SELECT t.inventory_item_id AS id, SUM(t.quantity) AS on_hand
      FROM inventory_transactions t
      WHERE t.organization_id = ${locationOrgId}
        AND t.location_id = ${locationId}
        AND t.inventory_item_id IN (${Prisma.join(itemIds)})
      GROUP BY t.inventory_item_id
    `;
    return new Map(rows.map((r) => [r.id, new Prisma.Decimal(r.on_hand)]));
  },

  writeSnapshot: async (
    lineId: string,
    data: {
      expectedQty: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      reasonRequired: boolean;
      decision: CountLineDecision;
    },
    tx: TxClient,
  ): Promise<void> => {
    await tx.stockCountLine.update({
      where: { id: lineId },
      data: { ...data, queryNote: null, reason: null, reasonNote: null },
    });
  },

  markSubmitted: async (
    id: string,
    organizationId: string,
    from: StockCountStatus[],
    data: { counterId: string; counterSignedAt: Date },
    tx: TxClient,
  ): Promise<number> => {
    const result = await tx.stockCount.updateMany({
      where: { id, organizationId, status: { in: from } },
      data: { ...data, status: 'SUBMITTED' },
    });
    return result.count;
  },

  updateLineDecision: async (
    lineId: string,
    stockCountId: string,
    data: {
      decision: CountLineDecision;
      reason: CountReason | null;
      reasonNote: string | null;
      queryNote: string | null;
    },
    client: Client = prisma,
  ): Promise<number> => {
    const result = await client.stockCountLine.updateMany({ where: { id: lineId, stockCountId }, data });
    return result.count;
  },

  markReturned: async (
    id: string,
    organizationId: string,
    data: { returnNote: string; returnedAt: Date; returnedById: string },
    tx: TxClient,
  ): Promise<number> => {
    const result = await tx.stockCount.updateMany({
      where: { id, organizationId, status: 'SUBMITTED' },
      data: { ...data, status: 'RETURNED' },
    });
    return result.count;
  },

  /** Send-back clears the queried lines for a blind recount, keeping the first figure. */
  reopenQueriedLine: async (lineId: string, firstCountedQty: Prisma.Decimal | null, tx: TxClient): Promise<void> => {
    await tx.stockCountLine.update({ where: { id: lineId }, data: { firstCountedQty, countedQty: null } });
  },

  markVerified: async (
    id: string,
    organizationId: string,
    from: StockCountStatus,
    data: { verifierId: string; verifiedAt: Date; directorNotified: boolean },
    tx: TxClient,
  ): Promise<number> => {
    const result = await tx.stockCount.updateMany({
      where: { id, organizationId, status: from },
      data: { ...data, status: 'VERIFIED' },
    });
    return result.count;
  },

  createVerifiedSpot: async (
    input: {
      organizationId: string;
      locationId: string;
      countDate: Date;
      reference: string;
      actorId: string;
      at: Date;
      directorNotified: boolean;
      lines: {
        inventoryItemId: string;
        countedQty: Prisma.Decimal;
        expectedQty: Prisma.Decimal;
        unitCost: Prisma.Decimal;
        reasonRequired: boolean;
        reason: CountReason | null;
        reasonNote: string | null;
      }[];
    },
    tx: TxClient,
  ): Promise<{ id: string; lines: { id: string; inventoryItemId: string }[] }> => {
    return tx.stockCount.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        kind: 'SPOT',
        countDate: input.countDate,
        status: 'VERIFIED',
        reference: input.reference,
        counterId: input.actorId,
        counterSignedAt: input.at,
        verifierId: input.actorId,
        verifiedAt: input.at,
        directorNotified: input.directorNotified,
        lines: { create: input.lines.map((l) => ({ ...l, decision: 'ACCEPTED' as const })) },
      },
      select: { id: true, lines: { select: { id: true, inventoryItemId: true } } },
    });
  },

  listSummaries: async (
    organizationId: string,
    locationId: string,
    filters: { kind?: StockCountKind; limit: number },
  ): Promise<CountSummaryRow[]> => {
    const select = {
      counter: { select: { id: true, name: true } },
      verifier: { select: { id: true, name: true } },
      lines: {
        select: {
          countedQty: true,
          expectedQty: true,
          unitCost: true,
          decision: true,
          transactions: { select: { id: true }, where: { type: 'ADJUSTMENT' as const } },
        },
      },
    };
    const base = { organizationId, locationId, status: { not: 'DRAFT' as const }, ...(filters.kind ? { kind: filters.kind } : {}) };
    // Awaiting the Store Manager first (oldest first), then history newest first.
    const [pending, done] = await Promise.all([
      prisma.stockCount.findMany({
        where: { ...base, status: { in: ['SUBMITTED', 'RETURNED'] } },
        include: select,
        orderBy: { countDate: 'asc' },
        take: filters.limit,
      }),
      prisma.stockCount.findMany({
        where: { ...base, status: 'VERIFIED' },
        include: select,
        orderBy: [{ countDate: 'desc' }, { verifiedAt: 'desc' }],
        take: filters.limit,
      }),
    ]);
    return [...pending, ...done].slice(0, filters.limit);
  },

  /** Any of the actor's own counts for today — feeds the summary's `todaysCount`. */
  todaysDaily: async (
    organizationId: string,
    locationId: string,
    countDate: Date,
  ): Promise<{
    id: string;
    status: StockCountStatus;
    counterSignedAt: Date | null;
    counter: { name: string };
    countedLines: number;
    totalLines: number;
  } | null> => {
    const row = await prisma.stockCount.findFirst({
      where: { organizationId, locationId, kind: 'DAILY', countDate },
      select: {
        id: true,
        status: true,
        counterSignedAt: true,
        counter: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    });
    if (!row) return null;
    const countedLines = await prisma.stockCountLine.count({
      where: { stockCountId: row.id, countedQty: { not: null } },
    });
    return {
      id: row.id,
      status: row.status,
      counterSignedAt: row.counterSignedAt,
      counter: row.counter,
      countedLines,
      totalLines: row._count.lines,
    };
  },
};
