import { Prisma, type DepartmentTag, type WasteLog, type WasteReason } from '@prisma/client';
import { prisma } from '../../config/database';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Waste (Milestone Six, Session 1). This repository owns WasteLog rows and
// the item-picker read. The negative WASTE ledger row is written by the
// service inside the same $transaction (prep-service.ts precedent).
// ---------------------------------------------------------------------------

export type WasteLogWithRelations = WasteLog & {
  inventoryItem: { id: string; name: string; usageUnit: string };
  loggedBy: { id: string; name: string };
};

export type CreateWasteLogInput = {
  organizationId: string;
  locationId: string;
  inventoryItemId: string;
  quantity: Prisma.Decimal;
  reason: WasteReason;
  note: string | null;
  unitCost: Prisma.Decimal;
  loggedById: string;
};

export type WasteItemOptionRow = {
  itemId: string;
  name: string;
  usageUnit: string;
  currentCost: Prisma.Decimal;
  onHand: Prisma.Decimal;
  /** Latest DISPATCH_IN unit cost at this location — null at the Central Store or if never dispatched in. */
  lastDispatchInCost: Prisma.Decimal | null;
};

const wasteLogInclude = {
  inventoryItem: { select: { id: true, name: true, usageUnit: true } },
  loggedBy: { select: { id: true, name: true } },
} satisfies Prisma.WasteLogInclude;

export const wasteRepository = {
  create: async (input: CreateWasteLogInput, tx: TxClient): Promise<WasteLogWithRelations> => {
    return tx.wasteLog.create({ data: input, include: wasteLogInclude });
  },

  findRecentForLocation: async (
    organizationId: string,
    locationId: string,
    since: Date,
  ): Promise<WasteLogWithRelations[]> => {
    return prisma.wasteLog.findMany({
      where: { organizationId, locationId, createdAt: { gte: since } },
      include: wasteLogInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * The cost carried into a department: the latest DISPATCH_IN row's unit
   * cost for this item at this location (plan §1.3). Null if none.
   */
  latestDispatchInCost: async (
    locationOrgId: string,
    locationId: string,
    inventoryItemId: string,
    client: Client = prisma,
  ): Promise<Prisma.Decimal | null> => {
    const row = await client.inventoryTransaction.findFirst({
      where: { organizationId: locationOrgId, locationId, inventoryItemId, type: 'DISPATCH_IN' },
      orderBy: { createdAt: 'desc' },
      select: { unitCost: true },
    });
    return row?.unitCost ?? null;
  },

  /**
   * Picker rows: live catalog items (hub org), optionally limited to one
   * department's tagged items, with on-hand and last carried-in cost at the
   * given location. The service decides which fields each role sees.
   */
  findItemOptions: async (
    scope: { itemOrgId: string; locationOrgId: string; locationId: string },
    filters: { departmentTag?: DepartmentTag; search?: string; limit: number },
  ): Promise<WasteItemOptionRow[]> => {
    const clauses: Prisma.Sql[] = [
      Prisma.sql`i.organization_id = ${scope.itemOrgId}`,
      Prisma.sql`i.deleted_at IS NULL`,
    ];
    if (filters.departmentTag) {
      clauses.push(Prisma.sql`${filters.departmentTag}::"DepartmentTag" = ANY(i.department_tags)`);
    }
    if (filters.search) clauses.push(Prisma.sql`i.name ILIKE ${`%${filters.search}%`}`);

    return prisma.$queryRaw<WasteItemOptionRow[]>`
      WITH oh AS (
        SELECT t.inventory_item_id, SUM(t.quantity) AS on_hand
        FROM inventory_transactions t
        WHERE t.organization_id = ${scope.locationOrgId} AND t.location_id = ${scope.locationId}
        GROUP BY t.inventory_item_id
      ),
      last_in AS (
        SELECT DISTINCT ON (t.inventory_item_id) t.inventory_item_id, t.unit_cost
        FROM inventory_transactions t
        WHERE t.organization_id = ${scope.locationOrgId} AND t.location_id = ${scope.locationId}
          AND t.type = 'DISPATCH_IN'
        ORDER BY t.inventory_item_id, t.created_at DESC
      )
      SELECT
        i.id AS "itemId", i.name, i.usage_unit AS "usageUnit", i.current_cost AS "currentCost",
        COALESCE(oh.on_hand, 0) AS "onHand",
        last_in.unit_cost AS "lastDispatchInCost"
      FROM inventory_items i
      LEFT JOIN oh ON oh.inventory_item_id = i.id
      LEFT JOIN last_in ON last_in.inventory_item_id = i.id
      WHERE ${Prisma.join(clauses, ' AND ')}
      ORDER BY i.name ASC
      LIMIT ${filters.limit}
    `;
  },
};
