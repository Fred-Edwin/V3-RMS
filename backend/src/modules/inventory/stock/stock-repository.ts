import { Prisma, type DepartmentTag, type InventoryItemType, type InventoryTransactionType } from '@prisma/client';
import { prisma } from '../../../config/database';

// ---------------------------------------------------------------------------
// Stock position & ledger (Milestone Six, Session 1). Read-only. On-hand is
// always derived from the ledger (Σ InventoryTransaction.quantity per
// location + item), never stored. The list/summary aggregate in SQL so the
// "below restock" / "negative" filters and the page count work over the
// whole catalog, not just the page in memory; the ledger's running balance
// is a window function over the item's whole ledger at that location
// (plan §2.1), then filtered and paginated.
//
// Two org ids appear because the catalog lives on the hub org while a branch
// department's ledger rows live on the branch org (D-15): `itemOrgId` scopes
// inventory_items, `locationOrgId` scopes inventory_transactions/restock_levels.
// ---------------------------------------------------------------------------

export type StockListFilters = {
  search?: string;
  type?: InventoryItemType;
  categoryId?: string;
  belowRestock?: boolean;
  negative?: boolean;
  attention?: boolean;
  limit: number;
  offset: number;
};

export type StockListRow = {
  itemId: string;
  name: string;
  type: InventoryItemType;
  categoryId: string | null;
  categoryName: string | null;
  usageUnit: string;
  currentCost: Prisma.Decimal;
  onHand: Prisma.Decimal;
  restockLevel: Prisma.Decimal | null;
};

export type StockTotals = {
  onHandValue: Prisma.Decimal;
  itemCount: number;
  lowCount: number;
  negativeCount: number;
};

export type LedgerFilters = {
  from?: Date;
  to?: Date;
  type?: InventoryTransactionType;
  limit: number;
  offset: number;
};

/** Raw ledger row + whatever the row's FK points at — the service formats the counterparty text. */
export type LedgerRawRow = {
  id: string;
  createdAt: Date;
  type: InventoryTransactionType;
  quantity: Prisma.Decimal;
  runningOnHand: Prisma.Decimal;
  reference: string | null;
  reason: string | null;
  supplierName: string | null;
  goodsReceiptReference: string | null;
  wasteReason: string | null;
  prepOutputName: string | null;
  dispatchToOrgName: string | null;
  dispatchDepartmentTag: DepartmentTag | null;
  discrepancyReference: string | null;
  /** DAILY | SPOT for an ADJUSTMENT written by a count; null otherwise. */
  countKind: string | null;
  countVerifierName: string | null;
  /** True for an ADJUSTMENT written by a branch day close (or its reversal). */
  endOfDay: boolean;
  /** True for an ADJUSTMENT written by a next-morning opening (or its reversal). */
  overnight: boolean;
  /** True when this row reverses an earlier adjustment. */
  isReversal: boolean;
};

type Scope = { locationOrgId: string; locationId: string; itemOrgId: string };

/** Per-item on-hand at one location, joined onto live catalog items. Shared by the list and the summary. */
const stockBaseCte = (scope: Scope) => Prisma.sql`
  WITH oh AS (
    SELECT t.inventory_item_id, SUM(t.quantity) AS on_hand
    FROM inventory_transactions t
    WHERE t.organization_id = ${scope.locationOrgId} AND t.location_id = ${scope.locationId}
    GROUP BY t.inventory_item_id
  ),
  base AS (
    SELECT
      i.id, i.name, i.type, i.category_id, c.name AS category_name, c.parent_category_id,
      i.usage_unit, i.current_cost,
      COALESCE(oh.on_hand, 0) AS on_hand,
      rl.level AS restock_level
    FROM inventory_items i
    LEFT JOIN oh ON oh.inventory_item_id = i.id
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN restock_levels rl
      ON rl.location_id = ${scope.locationId}
     AND rl.inventory_item_id = i.id
     AND rl.organization_id = ${scope.locationOrgId}
    WHERE i.organization_id = ${scope.itemOrgId} AND i.deleted_at IS NULL
  )
`;

const stockWhere = (filters: StockListFilters): Prisma.Sql => {
  const clauses: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.search) clauses.push(Prisma.sql`b.name ILIKE ${`%${filters.search}%`}`);
  if (filters.type) clauses.push(Prisma.sql`b.type = ${filters.type}::"InventoryItemType"`);
  if (filters.categoryId) {
    clauses.push(Prisma.sql`(b.category_id = ${filters.categoryId} OR b.parent_category_id = ${filters.categoryId})`);
  }
  if (filters.belowRestock) clauses.push(Prisma.sql`(b.restock_level IS NOT NULL AND b.on_hand < b.restock_level)`);
  if (filters.negative) clauses.push(Prisma.sql`b.on_hand < 0`);
  if (filters.attention) clauses.push(Prisma.sql`(b.on_hand < 0 OR b.restock_level IS NOT NULL)`);
  return Prisma.join(clauses, ' AND ');
};

const stockOrderBy = (filters: StockListFilters): Prisma.Sql =>
  filters.attention
    ? // negative first, then nearest to / furthest below restock level (on-hand ÷ level), then name
      Prisma.sql`(b.on_hand < 0) DESC, (b.on_hand / NULLIF(b.restock_level, 0)) ASC NULLS LAST, b.name ASC`
    : Prisma.sql`b.name ASC`;

export const stockRepository = {
  listForLocation: async (
    scope: Scope,
    filters: StockListFilters,
  ): Promise<{ rows: StockListRow[]; total: number }> => {
    const rows = await prisma.$queryRaw<(StockListRow & { total: bigint })[]>`
      ${stockBaseCte(scope)}
      SELECT
        b.id AS "itemId", b.name, b.type, b.category_id AS "categoryId", b.category_name AS "categoryName",
        b.usage_unit AS "usageUnit", b.current_cost AS "currentCost", b.on_hand AS "onHand",
        b.restock_level AS "restockLevel",
        COUNT(*) OVER () AS total
      FROM base b
      WHERE ${stockWhere(filters)}
      ORDER BY ${stockOrderBy(filters)}
      LIMIT ${filters.limit} OFFSET ${filters.offset}
    `;
    let total = rows.length > 0 ? Number(rows[0]!.total) : 0;
    if (rows.length === 0 && filters.offset > 0) {
      // Past the last page: COUNT(*) OVER() has no row to ride on — count separately.
      const [counted] = await prisma.$queryRaw<{ total: bigint }[]>`
        ${stockBaseCte(scope)}
        SELECT COUNT(*) AS total FROM base b WHERE ${stockWhere(filters)}
      `;
      total = Number(counted?.total ?? 0);
    }
    return { rows: rows.map(({ total: _total, ...row }) => row), total };
  },

  /** Hub KPIs. `lowCount` excludes negatives — those are counted under `negativeCount`. */
  totalsForLocation: async (scope: Scope): Promise<StockTotals> => {
    const [row] = await prisma.$queryRaw<
      { onHandValue: Prisma.Decimal | null; itemCount: bigint; lowCount: bigint; negativeCount: bigint }[]
    >`
      ${stockBaseCte(scope)}
      SELECT
        SUM(b.on_hand * b.current_cost) AS "onHandValue",
        COUNT(*) AS "itemCount",
        COUNT(*) FILTER (WHERE b.restock_level IS NOT NULL AND b.on_hand < b.restock_level AND b.on_hand >= 0) AS "lowCount",
        COUNT(*) FILTER (WHERE b.on_hand < 0) AS "negativeCount"
      FROM base b
    `;
    return {
      onHandValue: row?.onHandValue ?? new Prisma.Decimal(0),
      itemCount: Number(row?.itemCount ?? 0),
      lowCount: Number(row?.lowCount ?? 0),
      negativeCount: Number(row?.negativeCount ?? 0),
    };
  },

  /** One item's on-hand at one location. */
  onHandForItem: async (
    locationOrgId: string,
    locationId: string,
    inventoryItemId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<Prisma.Decimal> => {
    const result = await client.inventoryTransaction.aggregate({
      where: { siteId: locationOrgId, locationId, inventoryItemId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? new Prisma.Decimal(0);
  },

  restockLevelForItem: async (
    locationOrgId: string,
    locationId: string,
    inventoryItemId: string,
  ): Promise<Prisma.Decimal | null> => {
    const row = await prisma.restockLevel.findFirst({
      where: { siteId: locationOrgId, locationId, inventoryItemId },
      select: { level: true },
    });
    return row?.level ?? null;
  },

  lastMovementAt: async (locationOrgId: string, locationId: string, inventoryItemId: string): Promise<Date | null> => {
    const row = await prisma.inventoryTransaction.findFirst({
      where: { siteId: locationOrgId, locationId, inventoryItemId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  },

  /** When `currentCost` was last set: the latest receipt or prep-output row for the item on the hub org. */
  currentCostSetAt: async (hubOrgId: string, inventoryItemId: string): Promise<Date | null> => {
    const row = await prisma.inventoryTransaction.findFirst({
      where: { siteId: hubOrgId, inventoryItemId, type: { in: ['RECEIVE', 'PREP_PRODUCE'] } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  },

  /**
   * One item's ledger at one location. The running balance is a window over
   * the item's **whole** ledger there, computed before the range/type filter,
   * so a filtered page still shows true balances.
   */
  ledgerForItem: async (
    locationOrgId: string,
    locationId: string,
    inventoryItemId: string,
    filters: LedgerFilters,
  ): Promise<{ rows: LedgerRawRow[]; total: number }> => {
    const clauses: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (filters.from) clauses.push(Prisma.sql`l.created_at >= ${filters.from}`);
    if (filters.to) clauses.push(Prisma.sql`l.created_at <= ${filters.to}`);
    if (filters.type) clauses.push(Prisma.sql`l.type = ${filters.type}::"InventoryTransactionType"`);

    const rows = await prisma.$queryRaw<(LedgerRawRow & { total: bigint })[]>`
      WITH l AS (
        SELECT
          t.id, t.created_at, t.type, t.quantity, t.reference, t.reason,
          t.purchase_delivery_line_id, t.prep_record_id, t.waste_log_id, t.dispatch_line_id, t.stock_count_line_id,
          t.branch_day_line_id, t.opening_line_id, t.reverses_transaction_id,
          SUM(t.quantity) OVER (ORDER BY t.created_at, t.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
        FROM inventory_transactions t
        WHERE t.organization_id = ${locationOrgId}
          AND t.location_id = ${locationId}
          AND t.inventory_item_id = ${inventoryItemId}
      )
      SELECT
        l.id, l.created_at AS "createdAt", l.type, l.quantity, l.running AS "runningOnHand",
        l.reference, l.reason,
        s.name AS "supplierName", gr.reference AS "goodsReceiptReference",
        wl.reason::text AS "wasteReason",
        po.name AS "prepOutputName",
        torg.name AS "dispatchToOrgName", d.department_tag AS "dispatchDepartmentTag",
        disc.reference_number AS "discrepancyReference",
        sc.kind::text AS "countKind", cvu.name AS "countVerifierName",
        (l.branch_day_line_id IS NOT NULL) AS "endOfDay", (l.opening_line_id IS NOT NULL) AS "overnight", (l.reverses_transaction_id IS NOT NULL) AS "isReversal",
        COUNT(*) OVER () AS total
      FROM l
      LEFT JOIN purchase_delivery_lines pdl ON pdl.id = l.purchase_delivery_line_id
      LEFT JOIN purchase_deliveries gr ON gr.id = pdl.delivery_id
      LEFT JOIN purchase_orders pord ON pord.id = gr.order_id
      LEFT JOIN suppliers s ON s.id = pord.supplier_id
      LEFT JOIN waste_logs wl ON wl.id = l.waste_log_id
      LEFT JOIN prep_runs pr ON pr.id = l.prep_record_id
      LEFT JOIN inventory_items po ON po.id = pr.output_item_id
      LEFT JOIN dispatch_lines dl ON dl.id = l.dispatch_line_id
      LEFT JOIN dispatches d ON d.id = dl.dispatch_id
      LEFT JOIN organizations torg ON torg.id = d.to_organization_id
      LEFT JOIN stock_count_lines scl ON scl.id = l.stock_count_line_id
      LEFT JOIN stock_counts sc ON sc.id = scl.stock_count_id
      LEFT JOIN users cvu ON cvu.id = sc.verifier_id
      LEFT JOIN LATERAL (
        SELECT x.reference_number FROM discrepancies x
        WHERE l.type = 'ADJUSTMENT' AND x.dispatch_line_id = l.dispatch_line_id
        ORDER BY x.created_at DESC LIMIT 1
      ) disc ON TRUE
      WHERE ${Prisma.join(clauses, ' AND ')}
      ORDER BY l.created_at ASC, l.id ASC
      LIMIT ${filters.limit} OFFSET ${filters.offset}
    `;
    let total = rows.length > 0 ? Number(rows[0]!.total) : 0;
    if (rows.length === 0 && filters.offset > 0) {
      const [counted] = await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total FROM inventory_transactions l
        WHERE l.organization_id = ${locationOrgId} AND l.location_id = ${locationId}
          AND l.inventory_item_id = ${inventoryItemId} AND ${Prisma.join(clauses, ' AND ')}
      `;
      total = Number(counted?.total ?? 0);
    }
    return { rows: rows.map(({ total: _total, ...row }) => row), total };
  },
};
