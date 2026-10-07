import { Prisma, type DepartmentTag, type InventoryItemType } from '@prisma/client';
import { prisma } from '../../../../config/database';

export type ItemsFilter = {
  siteId: string;
  locationId: string;
  search?: string;
  categoryId?: string;
  type?: InventoryItemType;
  departmentTag?: DepartmentTag;
  sectionId?: string;
};

export type ItemsStatusChip = 'all' | 'low' | 'negative';

export type StockItemRaw = {
  itemId: string;
  name: string;
  unit: string;
  onHand: Prisma.Decimal;
  restockLevel: Prisma.Decimal | null;
  currentCost: Prisma.Decimal;
};

const escapeLike = (search: string): string => `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Every live hub item with what the ledger holds and the level set at the Central Store, narrowed by the filters (not by status). */
const baseCte = (f: ItemsFilter): Prisma.Sql => {
  const clauses: Prisma.Sql[] = [Prisma.sql`i.organization_id = ${f.siteId}`, Prisma.sql`i.deleted_at IS NULL`];
  if (f.search) clauses.push(Prisma.sql`i.name ILIKE ${escapeLike(f.search)}`);
  if (f.type) clauses.push(Prisma.sql`i.type = ${f.type}::"InventoryItemType"`);
  if (f.categoryId) clauses.push(Prisma.sql`(i.category_id = ${f.categoryId} OR c.parent_category_id = ${f.categoryId})`);
  if (f.departmentTag) clauses.push(Prisma.sql`${f.departmentTag}::"DepartmentTag" = ANY(i.department_tags)`);
  // The section tables are Counting's; this is a read of "which items sit in this section" (see the README, Coupling).
  if (f.sectionId) {
    clauses.push(Prisma.sql`EXISTS (SELECT 1 FROM count_section_items csi WHERE csi.organization_id = ${f.siteId} AND csi.inventory_item_id = i.id AND csi.section_id = ${f.sectionId})`);
  }
  return Prisma.sql`
    WITH oh AS (
      SELECT t.inventory_item_id, SUM(t.quantity) AS q
      FROM inventory_transactions t
      WHERE t.organization_id = ${f.siteId} AND t.location_id = ${f.locationId}
      GROUP BY t.inventory_item_id
    ),
    base AS (
      SELECT i.id, i.name, i.usage_unit, i.current_cost, COALESCE(oh.q, 0) AS on_hand, rl.level AS restock_level
      FROM inventory_items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN oh ON oh.inventory_item_id = i.id
      LEFT JOIN restock_levels rl ON rl.inventory_item_id = i.id AND rl.location_id = ${f.locationId} AND rl.organization_id = ${f.siteId}
      WHERE ${Prisma.join(clauses, ' AND ')}
    )`;
};

/** The same thresholds as `itemStockStatus`, as SQL: LOW or OUT is a level set and on hand from zero up to (not including) it, or exactly zero. */
const statusWhere = (chip: ItemsStatusChip): Prisma.Sql => {
  if (chip === 'low') return Prisma.sql`b.restock_level IS NOT NULL AND b.on_hand >= 0 AND (b.on_hand = 0 OR b.on_hand < b.restock_level)`;
  if (chip === 'negative') return Prisma.sql`b.on_hand < 0`;
  return Prisma.sql`TRUE`;
};

export const itemsRepository = {
  findPage: async (f: ItemsFilter, chip: ItemsStatusChip, page: number, pageSize: number): Promise<StockItemRaw[]> => {
    return prisma.$queryRaw<StockItemRaw[]>`
      ${baseCte(f)}
      SELECT b.id AS "itemId", b.name, b.usage_unit AS unit, b.on_hand AS "onHand", b.restock_level AS "restockLevel", b.current_cost AS "currentCost"
      FROM base b
      WHERE ${statusWhere(chip)}
      ORDER BY b.name ASC, b.id ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  },

  /** The three chip counts over the same filters, whatever chip is chosen. */
  chipCounts: async (f: ItemsFilter): Promise<{ all: number; low: number; negative: number }> => {
    const [row] = await prisma.$queryRaw<{ all: bigint; low: bigint; negative: bigint }[]>`
      ${baseCte(f)}
      SELECT COUNT(*) AS "all",
        COUNT(*) FILTER (WHERE ${statusWhere('low')}) AS low,
        COUNT(*) FILTER (WHERE ${statusWhere('negative')}) AS negative
      FROM base b`;
    return { all: Number(row?.all ?? 0), low: Number(row?.low ?? 0), negative: Number(row?.negative ?? 0) };
  },
};
