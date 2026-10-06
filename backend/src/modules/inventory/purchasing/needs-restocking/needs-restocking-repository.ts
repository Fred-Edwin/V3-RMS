/**
 * Needs restocking and the New-order catalog: database access only. Every query carries `siteId` (the hub; column
 * `organization_id`). On-hand is the ledger sum at the Central Store location, never a stored figure.
 */
import { Prisma, type SupplierPaymentTerms, type SupplierType } from '@prisma/client';
import { prisma } from '../../../../config/database';

export interface Scope {
  siteId: string;
  locationId: string;
}

export interface BelowLevelItem {
  id: string;
  name: string;
  category: string | null;
  usageUnit: string;
  buyUnit: string;
  packSize: Prisma.Decimal | null;
  preferredSupplierId: string | null;
  onHand: Prisma.Decimal;
  level: Prisma.Decimal;
}

export interface SupplierSummary {
  id: string;
  name: string;
  code: string;
  type: SupplierType;
  defaultPaymentTerms: SupplierPaymentTerms;
  paymentDays: number;
}

export interface SupplierLine {
  inventoryItemId: string;
  buyUnit: string | null;
  packSize: Prisma.Decimal | null;
  lastPrice: Prisma.Decimal | null;
  lastPriceAt: Date | null;
  isPreferred: boolean;
  supplier: SupplierSummary;
}

export interface CatalogLine extends SupplierLine {
  item: {
    id: string;
    name: string;
    category: string | null;
    usageUnit: string;
    buyUnit: string;
    packSize: Prisma.Decimal | null;
  };
}

export interface ItemStock {
  inventoryItemId: string;
  onHand: Prisma.Decimal;
  level: Prisma.Decimal | null;
}

const supplierSelect = { id: true, name: true, code: true, type: true, defaultPaymentTerms: true, paymentDays: true } as const;

/** A supplier we may order from: live and not on hold or archived. */
const orderableSupplier = { status: 'ACTIVE', deletedAt: null } as const;

export const needsRestockingRepository = {
  /**
   * Items below their Central Store restock level that are not already on an open order. An item with no level set is not
   * "needing" anything. An item counts as covered while it sits on a DRAFT to SENT order (Q-07).
   */
  findBelowLevel: async (scope: Scope, search?: string): Promise<BelowLevelItem[]> => {
    const like = search?.trim() ? `%${search.trim()}%` : null;
    return prisma.$queryRaw<BelowLevelItem[]>`
      SELECT i.id, i.name, c.name AS category, i.usage_unit AS "usageUnit", i.buy_unit AS "buyUnit",
             i.pack_size AS "packSize", i.preferred_supplier_id AS "preferredSupplierId",
             COALESCE(oh.on_hand, 0) AS "onHand", rl.level AS level
      FROM inventory_items i
      JOIN restock_levels rl
        ON rl.inventory_item_id = i.id AND rl.location_id = ${scope.locationId} AND rl.organization_id = ${scope.siteId}
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity) AS on_hand
        FROM inventory_transactions
        WHERE organization_id = ${scope.siteId} AND location_id = ${scope.locationId}
        GROUP BY inventory_item_id
      ) oh ON oh.inventory_item_id = i.id
      WHERE i.organization_id = ${scope.siteId}
        AND i.deleted_at IS NULL
        AND rl.level > 0
        AND COALESCE(oh.on_hand, 0) < rl.level
        AND NOT EXISTS (
          SELECT 1 FROM purchase_order_lines pl
          JOIN purchase_orders po ON po.id = pl.order_id
          WHERE pl.inventory_item_id = i.id AND po.organization_id = ${scope.siteId}
            AND po.status IN ('DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT')
        )
        AND (${like}::text IS NULL OR i.name ILIKE ${like})
    `;
  },

  /** On-hand and level for specific items (the catalog shows items that are not below level too). */
  findStockForItems: async (scope: Scope, itemIds: readonly string[]): Promise<ItemStock[]> => {
    if (itemIds.length === 0) return [];
    return prisma.$queryRaw<ItemStock[]>`
      SELECT i.id AS "inventoryItemId", COALESCE(oh.on_hand, 0) AS "onHand", rl.level AS level
      FROM inventory_items i
      LEFT JOIN restock_levels rl
        ON rl.inventory_item_id = i.id AND rl.location_id = ${scope.locationId} AND rl.organization_id = ${scope.siteId}
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity) AS on_hand
        FROM inventory_transactions
        WHERE organization_id = ${scope.siteId} AND location_id = ${scope.locationId}
        GROUP BY inventory_item_id
      ) oh ON oh.inventory_item_id = i.id
      WHERE i.organization_id = ${scope.siteId} AND i.id IN (${Prisma.join([...itemIds])})
    `;
  },

  /** Every orderable supplier's line for these items: the options in "Buy from". */
  findSupplierLines: async (siteId: string, itemIds: readonly string[]): Promise<SupplierLine[]> => {
    if (itemIds.length === 0) return [];
    const rows = await prisma.supplierItem.findMany({
      where: { siteId, inventoryItemId: { in: [...itemIds] }, supplier: orderableSupplier },
      select: {
        inventoryItemId: true,
        buyUnit: true,
        packSize: true,
        lastPrice: true,
        lastPriceAt: true,
        isPreferred: true,
        supplier: { select: supplierSelect },
      },
    });
    return rows;
  },

  /** One supplier's catalog: every live item it sells us. */
  findLinesForSupplier: async (siteId: string, supplierId: string, search?: string): Promise<CatalogLine[]> => {
    const rows = await prisma.supplierItem.findMany({
      where: {
        siteId,
        supplierId,
        supplier: orderableSupplier,
        inventoryItem: { deletedAt: null, ...(search?.trim() ? { name: { contains: search.trim(), mode: 'insensitive' } } : {}) },
      },
      select: {
        inventoryItemId: true,
        buyUnit: true,
        packSize: true,
        lastPrice: true,
        lastPriceAt: true,
        isPreferred: true,
        supplier: { select: supplierSelect },
        inventoryItem: {
          select: { id: true, name: true, usageUnit: true, buyUnit: true, packSize: true, category: { select: { name: true } } },
        },
      },
      orderBy: { inventoryItem: { name: 'asc' } },
    });
    return rows.map(({ inventoryItem, ...line }) => ({
      ...line,
      item: {
        id: inventoryItem.id,
        name: inventoryItem.name,
        category: inventoryItem.category?.name ?? null,
        usageUnit: inventoryItem.usageUnit,
        buyUnit: inventoryItem.buyUnit,
        packSize: inventoryItem.packSize,
      },
    }));
  },

  /** Every supplier we can order from, for the "Choose supplier" menu. */
  findOrderableSuppliers: (siteId: string): Promise<SupplierSummary[]> =>
    prisma.supplier.findMany({ where: { siteId, ...orderableSupplier }, select: supplierSelect, orderBy: { name: 'asc' } }),
};
