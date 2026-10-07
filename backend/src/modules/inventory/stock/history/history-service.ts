import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { locationRepository } from '../../../../repositories/location-repository';
import { AppError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { requireHubReader } from '../../_shared/central-store-access';
import { lastCountedByItem, sectionNamesByItem } from '../../counting/_shared/count-reads';
import { addDays, clockText, dayEndInstant, dayStartInstant, daysAgoText, fullDayText, nairobiDay } from '../_shared/nairobi-time';
import { movementReference } from '../_shared/movement-reference';
import { itemStockStatus, stockStatusText } from '../_shared/stock-status';
import { money2, qty, unitCostText } from '../_shared/stock-text';
import { withoutStockCosts } from '../_shared/stock-view';
import type { LedgerList, LedgerQuery, LedgerRow, StockCard } from '../_shared/stock-contract';
import {
  buildDayBlocks,
  collapsedDayText,
  collapseBlocks,
  dayReferenceText,
  DEFAULT_PERIOD_DAYS,
  entryNote,
  ledgerCsv,
  ledgerKpis,
  ledgerPeriodText,
  type DayBlock,
  type LedgerColumn,
} from './history-calc';
import { historyRepository, type CardEntryRow, type LedgerFilter, type LedgerSummaryRow } from './history-repository';
import type { LedgerExport, StockCardQuery } from './history.types';

type Actor = NonNullable<Request['user']>;

/** The CSV carries every row or none: past this many rows the export is refused (413). */
export const EXPORT_MAX_ROWS = 10_000;

/** The days a card shows before the older ones fold into one "earlier period" row (N12). */
const CARD_RECENT_DAYS = 5;

const centralStoreOf = async (siteId: string): Promise<{ id: string; name: string }> => {
  const location = await locationRepository.findCentralStore();
  if (!location || location.siteId !== siteId) throw new NotFoundError('No Central Store is configured');
  return location;
};

/**
 * `[from, to]` in Nairobi days. Both default to the last 30 days ending today; one given alone fixes the other (`to` today, or
 * `from` 29 days before `to`). A date after today is `DATE_IN_FUTURE`; `to` before `from` is `RANGE_INVALID`.
 */
export const resolveRange = (query: { from?: string; to?: string }, now: Date): { from: string; to: string } => {
  const today = nairobiDay(now);
  const to = query.to ?? today;
  const from = query.from ?? addDays(to, -(DEFAULT_PERIOD_DAYS - 1));
  if (from > today || to > today) throw new ValidationError('That date is in the future', 'DATE_IN_FUTURE');
  if (to < from) throw new ValidationError('The end date is before the start date', 'RANGE_INVALID');
  return { from, to };
};

const filterOf = (siteId: string, locationId: string, range: { from: string; to: string }, query: Pick<LedgerQuery, 'search' | 'sectionId'>): LedgerFilter => ({
  siteId,
  locationId,
  start: dayStartInstant(range.from),
  end: dayEndInstant(range.to),
  ...(query.search ? { search: query.search } : {}),
  ...(query.sectionId ? { sectionId: query.sectionId } : {}),
});

const rowView = (row: LedgerSummaryRow): LedgerRow => ({
  itemId: row.itemId,
  name: row.name,
  unit: row.unit,
  note: row.madeInPrep ? 'made in Prep' : null,
  opening: qty(row.opening),
  in: qty(row.in),
  sentOut: qty(row.sentOut),
  prepUse: qty(row.prepUse),
  waste: qty(row.waste),
  adjusted: qty(row.adjusted),
  closing: qty(row.closing),
  closingValueKes: money2(row.closingValue),
});

const entryType = (entry: CardEntryRow) => {
  // MARKET_RECEIVE and SALE exist in the enum but no flow posts them; show them under the column they count in.
  if (entry.type === 'MARKET_RECEIVE') return 'RECEIVE' as const;
  if (entry.type === 'SALE') return 'DISPATCH_OUT' as const;
  return entry.type;
};

const dayView = (block: DayBlock, options: { collapsed: boolean; entries: boolean; dayText: string }): StockCard['days'][number] => ({
  day: block.day,
  dayText: options.dayText,
  referenceText: dayReferenceText(block),
  references: block.references,
  collapsed: options.collapsed,
  opening: qty(block.opening),
  in: qty(block.in),
  sentOut: qty(block.sentOut),
  prepUse: qty(block.prepUse),
  waste: qty(block.waste),
  adjusted: qty(block.adjusted),
  closing: qty(block.closing),
  closingValueKes: money2(block.closingValue),
  ...(options.entries
    ? {
        entries: [...block.entries].reverse().map((entry) => ({
          id: entry.id,
          at: entry.createdAt.toISOString(),
          type: entryType(entry),
          reference: movementReference(entry).reference,
          quantity: qty(entry.quantity),
          reversed: entry.reversed,
          note: entryNote(entry),
        })),
      }
    : {}),
});

export const historyService = {
  /** S3: the ledger summary, per item, for `[from, to]`. Each row adds up: opening + in + sentOut + prepUse + waste + adjusted = closing. */
  list: async (actor: Actor, query: LedgerQuery, now: Date = new Date()): Promise<LedgerList> => {
    const siteId = await requireHubReader(actor);
    const location = await centralStoreOf(siteId);
    const range = resolveRange(query, now);
    const filter = filterOf(siteId, location.id, range, query);

    const [rows, chips, totals] = await Promise.all([
      historyRepository.findSummaryPage(filter, query.chip, query.page, query.pageSize),
      historyRepository.chipCounts(filter),
      historyRepository.totals(filter),
    ]);

    return withoutStockCosts(actor, {
      from: range.from,
      to: range.to,
      periodText: ledgerPeriodText(range.from, range.to, now),
      kpis: ledgerKpis(totals, range.from),
      rows: rows.map(rowView),
      chips,
      page: { page: query.page, pageSize: query.pageSize, total: chips[query.chip] },
    });
  },

  /** S4: the same query as S3 as CSV, every row; refused past 10,000 rows (413 EXPORT_TOO_LARGE). */
  exportCsv: async (actor: Actor, query: LedgerQuery, now: Date = new Date()): Promise<LedgerExport> => {
    const siteId = await requireHubReader(actor);
    const location = await centralStoreOf(siteId);
    const range = resolveRange(query, now);
    const rows = await historyRepository.findSummaryAll(filterOf(siteId, location.id, range, query), query.chip, EXPORT_MAX_ROWS + 1);
    if (rows.length > EXPORT_MAX_ROWS) {
      throw new AppError(413, 'EXPORT_TOO_LARGE', `That is more than ${EXPORT_MAX_ROWS.toLocaleString('en-US')} rows. Narrow the dates or search and export again`);
    }
    return { filename: `stock-ledger-${range.from}-to-${range.to}.csv`, csv: ledgerCsv(rows) };
  },

  /** S5: one item's card: where it stands now, the period's strip, and its days (or every entry). */
  card: async (actor: Actor, itemId: string, query: StockCardQuery, now: Date = new Date()): Promise<StockCard> => {
    const siteId = await requireHubReader(actor);
    const location = await centralStoreOf(siteId);
    const item = await historyRepository.findItem(siteId, itemId);
    if (!item) throw new NotFoundError('Item not found', 'ITEM_NOT_FOUND');
    const range = resolveRange(query, now);
    const start = dayStartInstant(range.from);
    const end = dayEndInstant(range.to);

    const [entries, opening, current, level, counted, sections] = await Promise.all([
      historyRepository.findCardEntries(siteId, location.id, item.id, start, end),
      historyRepository.positionBefore(siteId, location.id, item.id, start),
      historyRepository.positionBefore(siteId, location.id, item.id, null),
      historyRepository.restockLevel(siteId, location.id, item.id),
      lastCountedByItem(siteId, [item.id]),
      sectionNamesByItem(siteId, [item.id]),
    ]);

    const blocks = buildDayBlocks(entries, opening);
    const status = itemStockStatus(current.quantity, level);
    const last = counted.get(item.id);
    const total = (column: LedgerColumn): Prisma.Decimal => blocks.reduce((sum, b) => sum.plus(b[column]), new Prisma.Decimal(0));
    const strip = {
      opening: opening.quantity,
      in: total('in'),
      sentOut: total('sentOut'),
      prepUse: total('prepUse'),
      waste: total('waste'),
      adjusted: total('adjusted'),
      closing: blocks.length > 0 ? blocks[blocks.length - 1]!.closing : opening.quantity,
    };

    const filtered = query.chip === 'adjustmentsOnly' ? blocks.filter((b) => b.hasAdjustment) : blocks;
    let days: StockCard['days'];
    let footerText: string;
    const rule = 'each row adds up: opening + in − out + adjusted = closing';
    const movements = `${entries.length} ${entries.length === 1 ? 'movement' : 'movements'}`;
    if (query.show === 'entries') {
      days = [...filtered].reverse().map((b) => dayView(b, { collapsed: false, entries: true, dayText: fullDayText(b.day) }));
      footerText = `${filtered.length} ${filtered.length === 1 ? 'day' : 'days'} · ${movements} · ${rule}`;
    } else {
      const shown = filtered.slice(-CARD_RECENT_DAYS);
      const older = filtered.length > CARD_RECENT_DAYS ? blocks.filter((b) => b.day < shown[0]!.day) : [];
      days = [...shown].reverse().map((b) => dayView(b, { collapsed: false, entries: false, dayText: fullDayText(b.day) }));
      if (older.length > 0) days.push(dayView(collapseBlocks(older), { collapsed: true, entries: false, dayText: collapsedDayText(older) }));
      footerText = `${shown.length} ${shown.length === 1 ? 'day' : 'days'}${older.length > 0 ? ' and 1 earlier period' : ''} · ${movements} · open a day for its entries · ${rule}`;
    }

    return withoutStockCosts(actor, {
      item: { id: item.id, name: item.name, unit: item.usageUnit, sectionName: sections.get(item.id) ?? null, locationName: location.name },
      onHand: qty(current.quantity),
      status,
      statusText: stockStatusText(status, level, item.usageUnit),
      valueKes: money2(current.quantity.times(item.currentCost)),
      unitCostText: `at KES ${unitCostText(item.currentCost)} per ${item.usageUnit}`,
      lastCounted: last ? { at: last.at.toISOString(), reference: last.reference, text: `${daysAgoText(last.at, now)} · ${last.reference} · ${clockText(last.at)}` } : null,
      from: range.from,
      to: range.to,
      periodText: ledgerPeriodText(range.from, range.to, now, ' ·'),
      strip: {
        opening: qty(strip.opening),
        in: qty(strip.in),
        sentOut: qty(strip.sentOut),
        prepUse: qty(strip.prepUse),
        waste: qty(strip.waste),
        adjusted: qty(strip.adjusted),
        closing: qty(strip.closing),
      },
      days,
      footerText,
    });
  },
};
