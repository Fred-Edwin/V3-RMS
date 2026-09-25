import type { Request } from 'express';
import { Prisma, type DepartmentTag } from '@prisma/client';
import { stockRepository, type LedgerRawRow, type StockListRow } from './stock-repository';
import { resolveCentralStoreScope, resolveLedgerScope } from './stock-scope';
import { inventoryItemRepository } from './inventory-repository';
import { NotFoundError } from '../../utils/errors';
import { AttendantStockSummarySchema } from './stock-validators';
import type {
  AttendantStockSummary,
  Ledger,
  LedgerQuery,
  LedgerRow,
  ListStockQuery,
  StockList,
  StockRow,
  StockSummary,
  TodaysCount,
} from './stock.types';

type Actor = NonNullable<Request['user']>;

const toMoney = (value: Prisma.Decimal): string => value.toDecimalPlaces(2).toString();

/** "BARISTA" → "Barista" — department labels as the designs print them. */
export const departmentLabel = (tag: DepartmentTag): string => tag.charAt(0) + tag.slice(1).toLowerCase();

const WASTE_REASON_LABEL: Record<string, string> = {
  SPOILAGE: 'Spoilage',
  EXPIRY: 'Expiry',
  DAMAGE_IN_STORE: 'Damage in store',
  PREP_ERROR: 'Prep error',
};

/**
 * Session 1 has no counting: today's count is always "no count yet". Session
 * 2 replaces this with a read of today's DAILY StockCount.
 */
const noCountYet = (): TodaysCount => ({ status: 'NOT_STARTED', countId: null, submittedAt: null, submittedByName: null });

const serializeStockRow = (row: StockListRow): StockRow => {
  return {
    itemId: row.itemId,
    name: row.name,
    type: row.type,
    category: row.categoryId && row.categoryName ? { id: row.categoryId, name: row.categoryName } : null,
    onHand: row.onHand.toString(),
    usageUnit: row.usageUnit,
    restockLevel: row.restockLevel ? row.restockLevel.toString() : null,
    currentCost: row.currentCost.toString(),
    value: toMoney(row.onHand.times(row.currentCost)),
    isLow: row.restockLevel !== null && row.onHand.lessThan(row.restockLevel),
    isNegative: row.onHand.lessThan(0),
  };
};

/**
 * The ledger's "counterparty" column, derived from whichever FK the row
 * carries (plan §1.7) — no stored free text. Session 2/3 add the count
 * sources (stockCountLineId, branch day) here.
 */
export const formatCounterparty = (row: LedgerRawRow): string => {
  switch (row.type) {
    case 'RECEIVE':
      return row.supplierName ?? 'Receipt';
    case 'DISPATCH_OUT':
      if (row.dispatchToOrgName && row.dispatchDepartmentTag) {
        return `${row.dispatchToOrgName} · ${departmentLabel(row.dispatchDepartmentTag)}`;
      }
      return 'Dispatch';
    case 'DISPATCH_IN':
      return 'Central Store';
    case 'WASTE':
      return (row.wasteReason && WASTE_REASON_LABEL[row.wasteReason]) ?? 'Waste';
    case 'PREP_CONSUME':
      return row.prepOutputName ? `Prep · ${row.prepOutputName}` : 'Prep';
    case 'PREP_PRODUCE':
      return 'Prep run';
    case 'ADJUSTMENT':
      if (row.discrepancyReference) return `Transit discrepancy · ${row.discrepancyReference}`;
      return row.reason ?? 'Adjustment';
    default:
      return row.reason ?? '—';
  }
};

const serializeLedgerRow = (row: LedgerRawRow): LedgerRow => ({
  id: row.id,
  at: row.createdAt.toISOString(),
  type: row.type,
  counterparty: formatCounterparty(row),
  qty: row.quantity.toString(),
  runningOnHand: row.runningOnHand.toString(),
  reference: row.reference ?? row.goodsReceiptReference ?? row.discrepancyReference ?? null,
});

const pageCount = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / pageSize));

export const stockService = {
  listStock: async (actor: Actor, query: ListStockQuery): Promise<StockList> => {
    const scope = await resolveCentralStoreScope(actor);
    const { rows, total } = await stockRepository.listForLocation(scope, {
      search: query.search,
      type: query.type,
      categoryId: query.categoryId,
      belowRestock: query.belowRestock,
      negative: query.negative,
      attention: query.attention,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    return {
      rows: rows.map(serializeStockRow),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: pageCount(total, query.pageSize),
    };
  },

  /**
   * Store Manager: the full hub summary. Store Attendant: `{todaysCount}`
   * only, parsed through its own schema so no on-hand field can leak even if
   * this code grows (plan §7 Q-A).
   */
  getSummary: async (actor: Actor): Promise<StockSummary | AttendantStockSummary> => {
    const scope = await resolveCentralStoreScope(actor);
    const todaysCount = noCountYet();
    if (actor.role === 'STORE_ATTENDANT') {
      return AttendantStockSummarySchema.parse({ todaysCount });
    }
    const totals = await stockRepository.totalsForLocation(scope);
    return {
      onHandValue: toMoney(totals.onHandValue),
      itemCount: totals.itemCount,
      lowCount: totals.lowCount,
      negativeCount: totals.negativeCount,
      todaysCount,
    };
  },

  getLedger: async (actor: Actor, itemId: string, query: LedgerQuery): Promise<Ledger> => {
    const scope = await resolveLedgerScope(actor, query.locationId);
    const item = await inventoryItemRepository.findById(itemId, scope.itemOrgId);
    if (!item) throw new NotFoundError('Inventory item not found');

    const [onHand, restockLevel, lastMovementAt, currentCostSince, ledger] = await Promise.all([
      stockRepository.onHandForItem(scope.locationOrgId, scope.locationId, itemId),
      stockRepository.restockLevelForItem(scope.locationOrgId, scope.locationId, itemId),
      stockRepository.lastMovementAt(scope.locationOrgId, scope.locationId, itemId),
      stockRepository.currentCostSetAt(scope.itemOrgId, itemId),
      stockRepository.ledgerForItem(scope.locationOrgId, scope.locationId, itemId, {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        type: query.type,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      }),
    ]);

    return {
      summary: {
        itemId: item.id,
        itemName: item.name,
        usageUnit: item.usageUnit,
        categoryName: item.category?.name ?? null,
        onHand: onHand.toString(),
        currentCost: item.currentCost.toString(),
        currentCostSince: currentCostSince?.toISOString() ?? null,
        value: toMoney(onHand.times(item.currentCost)),
        restockLevel: restockLevel ? restockLevel.toString() : null,
        isLow: restockLevel !== null && onHand.lessThan(restockLevel),
        location: {
          id: scope.location.id,
          name: scope.location.name,
          departmentTag: scope.location.departmentTag,
          branchName: scope.branchName,
        },
        lastMovementAt: lastMovementAt?.toISOString() ?? null,
      },
      rows: ledger.rows.map(serializeLedgerRow),
      total: ledger.total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: pageCount(ledger.total, query.pageSize),
    };
  },
};
