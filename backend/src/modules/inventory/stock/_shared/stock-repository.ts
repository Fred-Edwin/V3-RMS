import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Client = Prisma.TransactionClient | typeof prisma;

/** The whole store at a glance: what S1 and S2 both show in their KPI strips. */
export type StoreTotals = {
  /** Live items of the hub, all three types. */
  tracked: number;
  /** LOW + OUT: on hand under the restock level (zero included), a level set. */
  lowOrOut: number;
  negative: number;
  /** Σ on hand × current cost. */
  value: Prisma.Decimal;
};

/**
 * Reads of the stock position that more than one sub-module needs. On-hand is always derived from the ledger
 * (Σ `InventoryTransaction.quantity` per location and item), never stored. Every query carries the site id.
 */
export const stockRepository = {
  /** One item's on-hand at one location. */
  onHandForItem: async (siteId: string, locationId: string, inventoryItemId: string, client: Client = prisma): Promise<Prisma.Decimal> => {
    const result = await client.inventoryTransaction.aggregate({
      where: { siteId, locationId, inventoryItemId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? new Prisma.Decimal(0);
  },

  /** Ids of the live items of the hub (the items "tracked"). */
  liveItemIds: async (siteId: string): Promise<string[]> => {
    const rows = await prisma.inventoryItem.findMany({ where: { siteId, deletedAt: null }, select: { id: true } });
    return rows.map((row) => row.id);
  },

  /** Items tracked, low or out, negative and the on-hand value, over every live item of the hub. */
  storeTotals: async (siteId: string, locationId: string): Promise<StoreTotals> => {
    const [row] = await prisma.$queryRaw<{ tracked: bigint; lowOrOut: bigint; negative: bigint; value: Prisma.Decimal | null }[]>`
      WITH oh AS (
        SELECT t.inventory_item_id, SUM(t.quantity) AS q
        FROM inventory_transactions t
        WHERE t.organization_id = ${siteId} AND t.location_id = ${locationId}
        GROUP BY t.inventory_item_id
      )
      SELECT COUNT(*) AS tracked,
        COUNT(*) FILTER (WHERE rl.level IS NOT NULL AND COALESCE(oh.q, 0) >= 0 AND (COALESCE(oh.q, 0) = 0 OR COALESCE(oh.q, 0) < rl.level)) AS "lowOrOut",
        COUNT(*) FILTER (WHERE COALESCE(oh.q, 0) < 0) AS negative,
        SUM(COALESCE(oh.q, 0) * i.current_cost) AS value
      FROM inventory_items i
      LEFT JOIN oh ON oh.inventory_item_id = i.id
      LEFT JOIN restock_levels rl ON rl.inventory_item_id = i.id AND rl.location_id = ${locationId} AND rl.organization_id = ${siteId}
      WHERE i.organization_id = ${siteId} AND i.deleted_at IS NULL`;
    return {
      tracked: Number(row?.tracked ?? 0),
      lowOrOut: Number(row?.lowOrOut ?? 0),
      negative: Number(row?.negative ?? 0),
      value: row?.value ?? new Prisma.Decimal(0),
    };
  },
};
