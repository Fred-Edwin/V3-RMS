import { Prisma, type WasteReason } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { wasteLogInclude, type WasteLogRow } from '../_shared/waste-row';
import type { WasteItemRow } from '../_shared/waste-view';

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof prisma;

export type LoggableItem = { id: string; name: string; usageUnit: string; currentCost: Prisma.Decimal; deletedAt: Date | null };

export type CreateWasteLogData = {
  siteId: string;
  locationId: string;
  batchId: string;
  inventoryItemId: string;
  quantity: Prisma.Decimal;
  reason: WasteReason;
  note: string | null;
  unitCost: Prisma.Decimal;
  loggedById: string;
};

/** The picker's columns, with what the Central Store holds worked out for the rows returned only. */
const itemSelect = (siteId: string, locationId: string): Prisma.Sql => Prisma.sql`
  SELECT i.id, i.name, i.usage_unit AS "usageUnit", i.current_cost AS "currentCost",
    (SELECT COALESCE(SUM(t.quantity), 0) FROM inventory_transactions t
      WHERE t.organization_id = ${siteId} AND t.location_id = ${locationId} AND t.inventory_item_id = i.id) AS "onHand"
  FROM inventory_items i`;

export const logRepository = {
  /** The batch a caller already sent under this key, with its entries, oldest first. */
  findBatch: async (siteId: string, userId: string, idempotencyKey: string, client: Client = prisma) => {
    return client.wasteBatch.findUnique({
      where: { siteId_userId_idempotencyKey: { siteId, userId, idempotencyKey } },
      include: { logs: { include: wasteLogInclude, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
  },

  createBatch: async (tx: Tx, siteId: string, userId: string, idempotencyKey: string): Promise<{ id: string }> => {
    return tx.wasteBatch.create({ data: { siteId, userId, idempotencyKey }, select: { id: true } });
  },

  createLog: async (tx: Tx, data: CreateWasteLogData): Promise<WasteLogRow> => {
    return tx.wasteLog.create({ data, include: wasteLogInclude });
  },

  /** Catalog items by id (live or retired), so the service can tell "not found" from "retired". */
  findItems: async (siteId: string, ids: string[]): Promise<LoggableItem[]> => {
    return prisma.inventoryItem.findMany({
      where: { siteId, id: { in: ids } },
      select: { id: true, name: true, usageUnit: true, currentCost: true, deletedAt: true },
    });
  },

  /** This caller's most logged items since `since`, most logged first (ties: the most recent). */
  oftenItemIds: async (siteId: string, userId: string, since: Date, limit: number): Promise<string[]> => {
    const rows = await prisma.wasteLog.groupBy({
      by: ['inventoryItemId'],
      where: { siteId, loggedById: userId, createdAt: { gte: since } },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: [{ _count: { inventoryItemId: 'desc' } }, { _max: { createdAt: 'desc' } }],
      take: limit * 2,
    });
    return rows.map((row) => row.inventoryItemId);
  },

  /** Live items by id, in the order given. Retired items never appear. */
  liveItemsByIds: async (siteId: string, locationId: string, ids: string[]): Promise<WasteItemRow[]> => {
    if (ids.length === 0) return [];
    const rows = await prisma.$queryRaw<WasteItemRow[]>`
      ${itemSelect(siteId, locationId)}
      WHERE i.organization_id = ${siteId} AND i.deleted_at IS NULL AND i.id IN (${Prisma.join(ids)})`;
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  },

  /** Live items of the hub matching the search, by name. */
  searchLiveItems: async (siteId: string, locationId: string, search: string | undefined, limit: number): Promise<WasteItemRow[]> => {
    const match = search ? Prisma.sql` AND i.name ILIKE ${`%${search}%`}` : Prisma.empty;
    return prisma.$queryRaw<WasteItemRow[]>`
      ${itemSelect(siteId, locationId)}
      WHERE i.organization_id = ${siteId} AND i.deleted_at IS NULL${match}
      ORDER BY i.name ASC
      LIMIT ${limit}`;
  },
};
