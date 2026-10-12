import { Prisma, type InventoryItemType, type InventoryTransactionType } from '@prisma/client';
import { prisma } from '../../../../config/database';

export type LedgerChip = 'all' | 'adjustments' | 'waste' | 'negative';

/** What narrows a ledger read: the Central Store, the period as instants `[start, end)`, and the filters. */
export type LedgerFilter = {
  siteId: string;
  locationId: string;
  start: Date;
  end: Date;
  search?: string;
  /** The items of the chosen section, resolved by the service through Counting's reads. */
  sectionItemIds?: string[];
};

/** One item's summary over the period, quantities signed (out columns negative). */
export type LedgerSummaryRow = {
  itemId: string;
  name: string;
  unit: string;
  type: InventoryItemType;
  opening: Prisma.Decimal;
  in: Prisma.Decimal;
  sentOut: Prisma.Decimal;
  prepUse: Prisma.Decimal;
  waste: Prisma.Decimal;
  adjusted: Prisma.Decimal;
  closing: Prisma.Decimal;
  closingValue: Prisma.Decimal;
  madeInPrep: boolean;
};

/** Money over every item matching the filters (the four KPI cells), each valued at the ledger row's own unit cost. */
export type LedgerTotals = {
  openingValue: Prisma.Decimal;
  inValue: Prisma.Decimal;
  outValue: Prisma.Decimal;
  adjustedValue: Prisma.Decimal;
  closingValue: Prisma.Decimal;
  openingItems: number;
};

export type LedgerChipCounts = { all: number; adjustments: number; waste: number; negative: number };

/** One ledger row of one item, with every document number it can be traced to. */
export type CardEntryRow = {
  id: string;
  createdAt: Date;
  type: InventoryTransactionType;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  adjustmentReference: string | null;
  countReference: string | null;
  deliveryReference: string | null;
  prepReference: string | null;
  dispatchLabel: string | null;
  /** `DSC-…`, through the dispatch line a finding's entries are linked to (one discrepancy per line). */
  discrepancyReference?: string | null;
  isReversal: boolean;
  originalReference: string | null;
  reversed: boolean;
};

export type CardItem = { id: string; name: string; usageUnit: string; currentCost: Prisma.Decimal; type: InventoryItemType };

/** The ledger's movement types, grouped into the five columns. Every type is in exactly one, so each row adds up. */
const IN_TYPES = Prisma.sql`('RECEIVE', 'PREP_PRODUCE', 'DISPATCH_IN', 'MARKET_RECEIVE')`;
const SENT_OUT_TYPES = Prisma.sql`('DISPATCH_OUT', 'SALE')`;

/** Escapes % and _ so a search is a plain "contains". */
const likePattern = (search: string): string => `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Per-item sums for the period, joined to the catalog, narrowed by search and section. Shared by the list, chips, totals and export. */
const baseCte = (f: LedgerFilter): Prisma.Sql => {
  const inPeriod = Prisma.sql`t.created_at >= ${f.start} AND t.created_at < ${f.end}`;
  const pattern = f.search ? likePattern(f.search) : null;
  const search = pattern
    ? Prisma.sql`AND (i.name ILIKE ${pattern} OR EXISTS (
        SELECT 1 FROM inventory_transactions x
        LEFT JOIN count_lines cl ON cl.id = x.count_line_id
        LEFT JOIN counts c ON c.id = cl.count_id
        LEFT JOIN purchase_delivery_lines pdl ON pdl.id = x.purchase_delivery_line_id
        LEFT JOIN purchase_deliveries pd ON pd.id = pdl.delivery_id
        LEFT JOIN prep_runs pr ON pr.id = x.prep_record_id
        LEFT JOIN dispatch_lines dl ON dl.id = x.dispatch_line_id
        LEFT JOIN dispatches d ON d.id = dl.dispatch_id
        LEFT JOIN discrepancies disc ON disc.dispatch_line_id = dl.id
        WHERE x.organization_id = ${f.siteId} AND x.location_id = ${f.locationId} AND x.inventory_item_id = i.id
          AND x.created_at >= ${f.start} AND x.created_at < ${f.end}
          AND (x.reference ILIKE ${pattern} OR c.reference ILIKE ${pattern} OR pd.reference ILIKE ${pattern}
            OR pr.reference ILIKE ${pattern} OR d.reference ILIKE ${pattern} OR disc.reference ILIKE ${pattern})))`
    : Prisma.empty;
  const section = f.sectionItemIds ? (f.sectionItemIds.length > 0 ? Prisma.sql`AND i.id IN (${Prisma.join(f.sectionItemIds)})` : Prisma.sql`AND FALSE`) : Prisma.empty;

  return Prisma.sql`
    WITH agg AS (
      SELECT t.inventory_item_id AS item_id,
        COALESCE(SUM(t.quantity) FILTER (WHERE t.created_at < ${f.start}), 0) AS opening,
        COALESCE(SUM(t.quantity * t.unit_cost) FILTER (WHERE t.created_at < ${f.start}), 0) AS opening_value,
        COALESCE(SUM(t.quantity) FILTER (WHERE ${inPeriod} AND t.type IN ${IN_TYPES}), 0) AS in_qty,
        COALESCE(SUM(t.quantity * t.unit_cost) FILTER (WHERE ${inPeriod} AND t.type IN ${IN_TYPES}), 0) AS in_value,
        COALESCE(SUM(t.quantity) FILTER (WHERE ${inPeriod} AND t.type IN ${SENT_OUT_TYPES}), 0) AS sent_out,
        COALESCE(SUM(t.quantity) FILTER (WHERE ${inPeriod} AND t.type = 'PREP_CONSUME'), 0) AS prep_use,
        COALESCE(SUM(t.quantity) FILTER (WHERE ${inPeriod} AND t.type = 'WASTE'), 0) AS waste,
        COALESCE(SUM(t.quantity * t.unit_cost) FILTER (WHERE ${inPeriod} AND t.type IN ('DISPATCH_OUT', 'SALE', 'PREP_CONSUME', 'WASTE')), 0) AS out_value,
        COALESCE(SUM(t.quantity) FILTER (WHERE ${inPeriod} AND t.type = 'ADJUSTMENT'), 0) AS adjusted,
        COALESCE(SUM(t.quantity * t.unit_cost) FILTER (WHERE ${inPeriod} AND t.type = 'ADJUSTMENT'), 0) AS adjusted_value,
        COALESCE(SUM(t.quantity), 0) AS closing,
        COALESCE(SUM(t.quantity * t.unit_cost), 0) AS closing_value,
        COUNT(*) FILTER (WHERE ${inPeriod}) AS moves,
        COUNT(*) FILTER (WHERE ${inPeriod} AND t.type = 'ADJUSTMENT') AS adjustment_moves,
        COUNT(*) FILTER (WHERE ${inPeriod} AND t.type = 'WASTE') AS waste_moves,
        COUNT(*) FILTER (WHERE ${inPeriod} AND t.type = 'PREP_PRODUCE') AS produced
      FROM inventory_transactions t
      WHERE t.organization_id = ${f.siteId} AND t.location_id = ${f.locationId} AND t.created_at < ${f.end}
      GROUP BY t.inventory_item_id
    ),
    base AS (
      SELECT i.id, i.name, i.usage_unit, i.type, agg.*
      FROM agg
      JOIN inventory_items i ON i.id = agg.item_id
      WHERE i.organization_id = ${f.siteId} AND (agg.moves > 0 OR agg.opening <> 0) ${search} ${section}
    )`;
};

const chipWhere = (chip: LedgerChip): Prisma.Sql => {
  if (chip === 'adjustments') return Prisma.sql`b.adjustment_moves > 0`;
  if (chip === 'waste') return Prisma.sql`b.waste_moves > 0`;
  if (chip === 'negative') return Prisma.sql`b.closing < 0`;
  return Prisma.sql`TRUE`;
};

type RawSummary = {
  itemId: string;
  name: string;
  unit: string;
  type: InventoryItemType;
  opening: Prisma.Decimal;
  inQty: Prisma.Decimal;
  sentOut: Prisma.Decimal;
  prepUse: Prisma.Decimal;
  waste: Prisma.Decimal;
  adjusted: Prisma.Decimal;
  closing: Prisma.Decimal;
  closingValue: Prisma.Decimal;
  produced: bigint;
};

const toSummary = (row: RawSummary): LedgerSummaryRow => ({
  itemId: row.itemId,
  name: row.name,
  unit: row.unit,
  type: row.type,
  opening: row.opening,
  in: row.inQty,
  sentOut: row.sentOut,
  prepUse: row.prepUse,
  waste: row.waste,
  adjusted: row.adjusted,
  closing: row.closing,
  closingValue: row.closingValue,
  madeInPrep: row.type === 'PREPPED' && Number(row.produced) > 0,
});

const summaryColumns = Prisma.sql`
  b.id AS "itemId", b.name, b.usage_unit AS unit, b.type, b.opening, b.in_qty AS "inQty", b.sent_out AS "sentOut",
  b.prep_use AS "prepUse", b.waste, b.adjusted, b.closing, b.closing_value AS "closingValue", b.produced`;

export const historyRepository = {
  /** One page of the summary, by item name. */
  findSummaryPage: async (f: LedgerFilter, chip: LedgerChip, page: number, pageSize: number): Promise<LedgerSummaryRow[]> => {
    const rows = await prisma.$queryRaw<RawSummary[]>`
      ${baseCte(f)}
      SELECT ${summaryColumns} FROM base b WHERE ${chipWhere(chip)}
      ORDER BY b.name ASC, b.id ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    return rows.map(toSummary);
  },

  /** The whole summary for the CSV, capped at `limit` rows (the caller passes one more than it will accept). */
  findSummaryAll: async (f: LedgerFilter, chip: LedgerChip, limit: number): Promise<LedgerSummaryRow[]> => {
    const rows = await prisma.$queryRaw<RawSummary[]>`
      ${baseCte(f)}
      SELECT ${summaryColumns} FROM base b WHERE ${chipWhere(chip)}
      ORDER BY b.name ASC, b.id ASC
      LIMIT ${limit}`;
    return rows.map(toSummary);
  },

  chipCounts: async (f: LedgerFilter): Promise<LedgerChipCounts> => {
    const [row] = await prisma.$queryRaw<{ all: bigint; adjustments: bigint; waste: bigint; negative: bigint }[]>`
      ${baseCte(f)}
      SELECT COUNT(*) AS "all",
        COUNT(*) FILTER (WHERE b.adjustment_moves > 0) AS adjustments,
        COUNT(*) FILTER (WHERE b.waste_moves > 0) AS waste,
        COUNT(*) FILTER (WHERE b.closing < 0) AS negative
      FROM base b`;
    return { all: Number(row?.all ?? 0), adjustments: Number(row?.adjustments ?? 0), waste: Number(row?.waste ?? 0), negative: Number(row?.negative ?? 0) };
  },

  totals: async (f: LedgerFilter): Promise<LedgerTotals> => {
    const zero = new Prisma.Decimal(0);
    const [row] = await prisma.$queryRaw<
      { openingValue: Prisma.Decimal | null; inValue: Prisma.Decimal | null; outValue: Prisma.Decimal | null; adjustedValue: Prisma.Decimal | null; closingValue: Prisma.Decimal | null; openingItems: bigint }[]
    >`
      ${baseCte(f)}
      SELECT SUM(b.opening_value) AS "openingValue", SUM(b.in_value) AS "inValue", SUM(b.out_value) AS "outValue",
        SUM(b.adjusted_value) AS "adjustedValue", SUM(b.closing_value) AS "closingValue",
        COUNT(*) FILTER (WHERE b.opening <> 0) AS "openingItems"
      FROM base b`;
    return {
      openingValue: row?.openingValue ?? zero,
      inValue: row?.inValue ?? zero,
      outValue: row?.outValue ?? zero,
      adjustedValue: row?.adjustedValue ?? zero,
      closingValue: row?.closingValue ?? zero,
      openingItems: Number(row?.openingItems ?? 0),
    };
  },

  // --- the stock card (one item) ---------------------------------------------

  findItem: async (siteId: string, itemId: string): Promise<CardItem | null> => {
    return prisma.inventoryItem.findFirst({ where: { id: itemId, siteId }, select: { id: true, name: true, usageUnit: true, currentCost: true, type: true } });
  },

  /** The item's quantity and money before an instant (`null` = everything to date). */
  positionBefore: async (siteId: string, locationId: string, itemId: string, instant: Date | null): Promise<{ quantity: Prisma.Decimal; value: Prisma.Decimal }> => {
    const upTo = instant ? Prisma.sql`AND created_at < ${instant}` : Prisma.empty;
    const [row] = await prisma.$queryRaw<{ quantity: Prisma.Decimal; value: Prisma.Decimal }[]>`
      SELECT COALESCE(SUM(quantity), 0) AS quantity, COALESCE(SUM(quantity * unit_cost), 0) AS value
      FROM inventory_transactions
      WHERE organization_id = ${siteId} AND location_id = ${locationId} AND inventory_item_id = ${itemId} ${upTo}`;
    return { quantity: row?.quantity ?? new Prisma.Decimal(0), value: row?.value ?? new Prisma.Decimal(0) };
  },

  restockLevel: async (siteId: string, locationId: string, itemId: string): Promise<Prisma.Decimal | null> => {
    const row = await prisma.restockLevel.findFirst({ where: { siteId, locationId, inventoryItemId: itemId }, select: { level: true } });
    return row?.level ?? null;
  },

  /** Every ledger row of the item inside `[start, end)`, oldest first, with the document numbers it can be traced to. */
  findCardEntries: async (siteId: string, locationId: string, itemId: string, start: Date, end: Date): Promise<CardEntryRow[]> => {
    return prisma.$queryRaw<CardEntryRow[]>`
      SELECT t.id, t.created_at AS "createdAt", t.type, t.quantity, t.unit_cost AS "unitCost",
        t.reference AS "adjustmentReference", c.reference AS "countReference", pd.reference AS "deliveryReference",
        pr.reference AS "prepReference", d.reference AS "dispatchLabel", disc.reference AS "discrepancyReference",
        (t.reverses_transaction_id IS NOT NULL) AS "isReversal", orig.reference AS "originalReference",
        EXISTS (SELECT 1 FROM inventory_transactions r WHERE r.reverses_transaction_id = t.id) AS reversed
      FROM inventory_transactions t
      LEFT JOIN count_lines cl ON cl.id = t.count_line_id
      LEFT JOIN counts c ON c.id = cl.count_id
      LEFT JOIN purchase_delivery_lines pdl ON pdl.id = t.purchase_delivery_line_id
      LEFT JOIN purchase_deliveries pd ON pd.id = pdl.delivery_id
      LEFT JOIN prep_runs pr ON pr.id = t.prep_record_id
      LEFT JOIN dispatch_lines dl ON dl.id = t.dispatch_line_id
      LEFT JOIN dispatches d ON d.id = dl.dispatch_id
      LEFT JOIN discrepancies disc ON disc.dispatch_line_id = dl.id
      LEFT JOIN inventory_transactions orig ON orig.id = t.reverses_transaction_id
      WHERE t.organization_id = ${siteId} AND t.location_id = ${locationId} AND t.inventory_item_id = ${itemId}
        AND t.created_at >= ${start} AND t.created_at < ${end}
      ORDER BY t.created_at ASC, t.id ASC`;
  },
};
