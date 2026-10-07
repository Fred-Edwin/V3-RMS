import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { startKeyWhere } from './count-idempotency';

type Client = typeof prisma | Prisma.TransactionClient;

const PERSON = { select: { id: true, name: true, role: true } } as const;

const countInclude = {
  counter: PERSON,
  approver: PERSON,
  scopeSections: { orderBy: { sectionName: 'asc' } },
  recountOfLine: { select: { id: true, inventoryItem: { select: { name: true } }, count: { select: { id: true, reference: true } } } },
  lines: {
    orderBy: { position: 'asc' },
    include: {
      inventoryItem: { select: { id: true, name: true, usageUnit: true, currentCost: true } },
      decidedBy: PERSON,
      directorSeenBy: PERSON,
      // The adjustment a line posted: one ADJUSTMENT row per posting line (a later reversal row is not the line's number).
      transactions: { where: { type: 'ADJUSTMENT', reversesTransactionId: null }, select: { reference: true } },
    },
  },
} satisfies Prisma.CountInclude;

/** One count with the counter, approver, scope, recount link and every line (the view builder's whole input). */
export type CountRecord = Prisma.CountGetPayload<{ include: typeof countInclude }>;
export type CountLineRecord = CountRecord['lines'][number];

/** The reads and writes on a count that more than one sub-module needs. Every query carries `siteId`. */
export const countRecordRepository = {
  findById: (siteId: string, id: string, client: Client = prisma): Promise<CountRecord | null> =>
    client.count.findFirst({ where: { id, siteId }, include: countInclude }),

  /** The count a retried C9 already made: the same counter and the key it was STARTED with (signed or not since). */
  findByStartKey: (siteId: string, counterId: string, key: string, client: Client = prisma): Promise<CountRecord | null> =>
    client.count.findFirst({ where: { siteId, counterId, ...startKeyWhere(key) }, include: countInclude }),

  /** The person's one OPEN count, if they have one. */
  findOpenOf: (siteId: string, counterId: string, client: Client = prisma): Promise<CountRecord | null> =>
    client.count.findFirst({ where: { siteId, counterId, status: 'OPEN' }, include: countInclude }),

  /** One line with its count's status and counter (to check who may decide or count it again). */
  findLine: (siteId: string, lineId: string, client: Client = prisma) =>
    client.countLine.findFirst({
      where: { id: lineId, siteId },
      include: {
        inventoryItem: { select: { id: true, name: true, usageUnit: true } },
        count: { select: { id: true, reference: true, status: true, counterId: true } },
      },
    }),

  /** Locks the count row until the transaction ends, so a double tap or two devices cannot both change it (sign, decide, approve). */
  lockCount: async (tx: Prisma.TransactionClient, siteId: string, id: string): Promise<void> => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM counts WHERE organization_id = ${siteId} AND id = ${id} FOR UPDATE`);
  },

  /** The Central Store location of the hub. */
  findCentralStore: (siteId: string, client: Client = prisma): Promise<{ id: string; siteId: string } | null> =>
    client.location.findFirst({ where: { siteId, type: 'CENTRAL_STORE' }, select: { id: true, siteId: true } }),

  /**
   * When each item was last counted BEFORE a count: the latest signed time of a SUBMITTED or APPROVED count (other than this one)
   * that gave the item a number. Items never counted are absent from the map.
   */
  lastCountedBefore: async (siteId: string, itemIds: string[], before: Date, excludeCountId: string, client: Client = prisma): Promise<Map<string, Date>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await client.$queryRaw<{ item_id: string; at: Date }[]>(Prisma.sql`
      SELECT cl.inventory_item_id AS item_id, MAX(c.signed_at) AS at
      FROM count_lines cl
      JOIN counts c ON c.id = cl.count_id
      WHERE cl.organization_id = ${siteId}
        AND cl.inventory_item_id IN (${Prisma.join(itemIds)})
        AND cl.counted_qty IS NOT NULL
        AND c.status IN ('SUBMITTED', 'APPROVED')
        AND c.id <> ${excludeCountId}
        AND c.signed_at < ${before}
      GROUP BY cl.inventory_item_id`);
    return new Map(rows.map((r) => [r.item_id, r.at]));
  },

  /** The ledger on-hand of each item at the Central Store as of an instant (the sum of every row up to and including it). */
  onHandAsOf: async (siteId: string, locationId: string, itemIds: string[], asOf: Date | null, client: Client = prisma): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await client.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { siteId, locationId, inventoryItemId: { in: itemIds }, ...(asOf ? { createdAt: { lte: asOf } } : {}) },
      _sum: { quantity: true },
    });
    const byItem = new Map(rows.map((r) => [r.inventoryItemId, r._sum.quantity ?? new Prisma.Decimal(0)]));
    return new Map(itemIds.map((id) => [id, byItem.get(id) ?? new Prisma.Decimal(0)]));
  },

  /**
   * Differences of an item in the signed counts that counted it, newest first (the signed time orders them), for the repeat-shortfall
   * streak. Differences are computed from the frozen figures, so a line with no frozen expected figure is left out.
   */
  recentDifferences: async (siteId: string, itemId: string, beforeOrAt: Date, limit: number, excludeCountId: string, client: Client = prisma): Promise<Prisma.Decimal[]> => {
    const rows = await client.countLine.findMany({
      where: {
        siteId,
        inventoryItemId: itemId,
        countedQty: { not: null },
        expectedQty: { not: null },
        count: { status: { in: ['SUBMITTED', 'APPROVED'] }, signedAt: { lte: beforeOrAt }, id: { not: excludeCountId } },
      },
      orderBy: { count: { signedAt: 'desc' } },
      take: limit,
      select: { countedQty: true, expectedQty: true },
    });
    return rows.map((r) => r.countedQty!.minus(r.expectedQty!));
  },
};
