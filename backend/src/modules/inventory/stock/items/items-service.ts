import type { Request } from 'express';
import { DepartmentTag, InventoryItemType } from '@prisma/client';
import { locationRepository } from '../../../../repositories/location-repository';
import { NotFoundError, ValidationError } from '../../../../utils/errors';
import { blindnessOf } from '../../_shared/blind-rule';
import { requireHubReader } from '../../_shared/central-store-access';
import { itemIdsInSection, lastCountedByItem, sectionNamesByItem } from '../../counting/_shared/count-reads';
import { nairobiDay, weekdayDayText } from '../_shared/nairobi-time';
import { itemStockStatus } from '../_shared/stock-status';
import { compactKesText, money2, qty } from '../_shared/stock-text';
import { lowCell, negativeCell, trackedCell } from '../_shared/stock-kpis';
import { trackedSectionCount } from '../_shared/stock-sections';
import { stockRepository } from '../_shared/stock-repository';
import { withoutStockCosts } from '../_shared/stock-view';
import type { StockItemRow, StockItemsList } from '../_shared/stock-contract';
import { itemsRepository, type ItemsFilter } from './items-repository';
import type { StockItemsQuery } from './items.types';

type Actor = NonNullable<Request['user']>;

const oneOf = <T extends string>(allowed: Record<string, T>, value: string | undefined, label: string): T | undefined => {
  if (value === undefined) return undefined;
  const found = Object.values(allowed).find((v) => v === value);
  if (!found) throw new ValidationError(`Unknown ${label}: ${value}`);
  return found;
};

export const itemsService = {
  /**
   * S2: every live item of the hub with what the Central Store holds. Status NEGATIVE / OUT / LOW / OK from `itemStockStatus`;
   * the value is on hand × the CURRENT cost (latest-price costing), so it can differ from the ledger's closing value, which uses
   * each movement's own cost. The KPI strip is the whole store; the chips follow the filters.
   */
  list: async (actor: Actor, query: StockItemsQuery): Promise<StockItemsList> => {
    const siteId = await requireHubReader(actor);
    const location = await locationRepository.findCentralStore();
    if (!location || location.siteId !== siteId) throw new NotFoundError('No Central Store is configured');

    const filter: ItemsFilter = {
      siteId,
      locationId: location.id,
      ...(query.search ? { search: query.search } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.sectionId ? { sectionItemIds: await itemIdsInSection(siteId, query.sectionId) } : {}),
    };
    const type = oneOf(InventoryItemType, query.type, 'item type');
    const departmentTag = oneOf(DepartmentTag, query.departmentTag, 'department');
    if (type) filter.type = type;
    if (departmentTag) filter.departmentTag = departmentTag;

    const [raw, chips, totals, sections] = await Promise.all([
      itemsRepository.findPage(filter, query.status, query.page, query.pageSize),
      itemsRepository.chipCounts(filter),
      stockRepository.storeTotals(siteId, location.id),
      trackedSectionCount(siteId),
    ]);

    const ids = raw.map((row) => row.itemId);
    const [counted, sectionNames] = ids.length > 0 ? await Promise.all([lastCountedByItem(siteId, ids), sectionNamesByItem(siteId, ids)]) : [new Map(), new Map<string, string>()];

    const rows: StockItemRow[] = raw.map((row) => {
      const last = counted.get(row.itemId);
      return {
        itemId: row.itemId,
        name: row.name,
        sectionName: sectionNames.get(row.itemId) ?? null,
        unit: row.unit,
        onHand: qty(row.onHand),
        restockLevel: row.restockLevel ? qty(row.restockLevel) : null,
        valueKes: money2(row.onHand.times(row.currentCost)),
        lastCountedAt: last ? last.at.toISOString() : null,
        lastCountedText: last ? weekdayDayText(nairobiDay(last.at)) : 'Never counted',
        status: itemStockStatus(row.onHand, row.restockLevel),
      };
    });

    const blind = blindnessOf(actor);
    const kpis = [
      trackedCell(totals.tracked, sections),
      lowCell(totals.lowOrOut),
      negativeCell(totals.negative),
      ...(blind.itemCosts ? [] : [{ key: 'value', label: 'ON-HAND VALUE', value: compactKesText(totals.value), caption: 'at current cost', tone: 'NEUTRAL' as const }]),
    ];

    return withoutStockCosts(actor, { kpis, rows, chips, page: { page: query.page, pageSize: query.pageSize, total: chips[query.status] } });
  },
};
