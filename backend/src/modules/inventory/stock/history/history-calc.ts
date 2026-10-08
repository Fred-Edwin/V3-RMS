import { Prisma, type InventoryTransactionType } from '@prisma/client';
import type { KpiCell } from '../../_shared/wire';
import { addDays, clockText, nairobiDay, shortDayText, weekdayDayText } from '../_shared/nairobi-time';
import { movementReference } from '../_shared/movement-reference';
import { kesText, qty, signedKesText } from '../_shared/stock-text';
import type { LedgerSummaryRow, LedgerTotals, CardEntryRow } from './history-repository';

const MINUS = '−';
const D = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

/** The five columns of the ledger summary. Every movement type falls in exactly one, so each row adds up by construction. */
export type LedgerColumn = 'in' | 'sentOut' | 'prepUse' | 'waste' | 'adjusted';

export const columnOf = (type: InventoryTransactionType): LedgerColumn => {
  switch (type) {
    case 'RECEIVE':
    case 'PREP_PRODUCE':
    case 'DISPATCH_IN':
    case 'MARKET_RECEIVE':
      return 'in';
    case 'DISPATCH_OUT':
    case 'SALE':
      return 'sentOut';
    case 'PREP_CONSUME':
      return 'prepUse';
    case 'WASTE':
      return 'waste';
    default:
      return 'adjusted';
  }
};

export const COLUMN_TEXT: Record<LedgerColumn, string> = { in: 'In', sentOut: 'Sent out', prepUse: 'Prep use', waste: 'Waste', adjusted: 'Adjusted' };

// --- the period -----------------------------------------------------------------

export const DEFAULT_PERIOD_DAYS = 30;

/** "Last 30 days, as of 13 Oct, 16:30" (the card joins it with " · "), "Tue 13 Oct" (one day), or "14 Sep to 5 Oct". */
export const ledgerPeriodText = (from: string, to: string, now: Date, joiner = ','): string => {
  const today = nairobiDay(now);
  if (to === today && from === addDays(today, -(DEFAULT_PERIOD_DAYS - 1))) return `Last ${DEFAULT_PERIOD_DAYS} days${joiner} as of ${shortDayText(today)}, ${clockText(now)}`;
  if (from === to) return weekdayDayText(from);
  return `${shortDayText(from)} to ${shortDayText(to)}`;
};

// --- S3: the four KPI cells ------------------------------------------------------

const termText = (value: number): string => `${value < 0 ? MINUS : '+'} ${Math.abs(value).toLocaleString('en-US')}`;

/**
 * Opening value, In, Out, Closing, with the adjusted amount in the closing caption so "510,200 + 214,600 − 239,000 − 3,400
 * = 482,400" holds on screen. Each cell is rounded to whole shillings and the adjusted amount absorbs the rounding, so the
 * line a reader checks always adds up.
 */
export const ledgerKpis = (totals: LedgerTotals, from: string): KpiCell[] => {
  const opening = Math.round(totals.openingValue.toNumber());
  const inValue = Math.round(totals.inValue.toNumber());
  const out = Math.round(totals.outValue.toNumber());
  const closing = Math.round(totals.closingValue.toNumber());
  const adjusted = closing - opening - inValue - out;
  const sign = (n: number) => (n < 0 ? MINUS : '');
  return [
    { key: 'opening', label: `OPENING · ${shortDayText(from).toUpperCase()}`, value: kesText(D(opening)), caption: `${totals.openingItems} ${totals.openingItems === 1 ? 'item' : 'items'}`, tone: 'NEUTRAL' },
    { key: 'in', label: 'IN', value: signedKesText(D(inValue)), caption: 'received and made in Prep', tone: 'NEUTRAL' },
    { key: 'out', label: 'OUT', value: signedKesText(D(out)), caption: 'dispatch, Prep use, waste', tone: 'NEUTRAL' },
    {
      key: 'closing',
      label: adjusted === 0 ? 'CLOSING' : `CLOSING · ADJUSTED ${sign(adjusted) || '+'}${Math.abs(adjusted).toLocaleString('en-US')}`,
      value: kesText(D(closing)),
      caption: `${opening.toLocaleString('en-US')} ${termText(inValue)} ${termText(out)} ${termText(adjusted)}`,
      tone: adjusted === 0 ? 'NEUTRAL' : 'WARN',
    },
  ];
};

// --- S4: the CSV -----------------------------------------------------------------

const csvCell = (value: string): string => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Words (an item name) are written so a spreadsheet cannot run them: one that starts like a formula gets a leading apostrophe. */
const csvText = (value: string): string => csvCell(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

export const LEDGER_CSV_HEADER = ['Item', 'Unit', 'Opening', 'In', 'Sent out', 'Prep use', 'Waste', 'Adjusted', 'Closing', 'Closing value (KES)'] as const;

export const ledgerCsv = (rows: LedgerSummaryRow[]): string => {
  const lines = [LEDGER_CSV_HEADER.join(',')];
  for (const row of rows) {
    const numbers = [row.opening, row.in, row.sentOut, row.prepUse, row.waste, row.adjusted, row.closing].map(qty);
    lines.push([csvText(row.name), csvText(row.unit), ...numbers, row.closingValue.toDecimalPlaces(2).toFixed(2)].join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
};

// --- S5: the stock card ---------------------------------------------------------

export type DayBlock = {
  day: string;
  opening: Prisma.Decimal;
  in: Prisma.Decimal;
  sentOut: Prisma.Decimal;
  prepUse: Prisma.Decimal;
  waste: Prisma.Decimal;
  adjusted: Prisma.Decimal;
  closing: Prisma.Decimal;
  closingValue: Prisma.Decimal;
  moves: number;
  hasAdjustment: boolean;
  columns: LedgerColumn[];
  references: string[];
  entries: CardEntryRow[];
};

const zeroColumns = () => ({ in: D(0), sentOut: D(0), prepUse: D(0), waste: D(0), adjusted: D(0) });

/** Groups a period's entries (oldest first) into Nairobi days with a running opening and closing, quantity and money. */
export const buildDayBlocks = (entries: CardEntryRow[], opening: { quantity: Prisma.Decimal; value: Prisma.Decimal }): DayBlock[] => {
  const blocks: DayBlock[] = [];
  let quantity = opening.quantity;
  let value = opening.value;
  for (const entry of entries) {
    const day = nairobiDay(entry.createdAt);
    let block = blocks[blocks.length - 1];
    if (!block || block.day !== day) {
      block = { day, opening: quantity, ...zeroColumns(), closing: quantity, closingValue: value, moves: 0, hasAdjustment: false, columns: [], references: [], entries: [] };
      blocks.push(block);
    }
    const column = columnOf(entry.type);
    block[column] = block[column].plus(entry.quantity);
    quantity = quantity.plus(entry.quantity);
    value = value.plus(entry.quantity.times(entry.unitCost));
    block.closing = quantity;
    block.closingValue = value;
    block.moves += 1;
    block.hasAdjustment ||= entry.type === 'ADJUSTMENT';
    if (!block.columns.includes(column)) block.columns.push(column);
    const reference = movementReference(entry).reference;
    if (reference && !block.references.includes(reference)) block.references.push(reference);
    block.entries.push(entry);
  }
  return blocks;
};

/** One row standing for several quiet days: the opening of the first, the closing of the last, everything between summed. */
export const collapseBlocks = (blocks: DayBlock[]): DayBlock => {
  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  const sum = (pick: (b: DayBlock) => Prisma.Decimal) => blocks.reduce((total, b) => total.plus(pick(b)), D(0));
  return {
    day: first.day,
    opening: first.opening,
    in: sum((b) => b.in),
    sentOut: sum((b) => b.sentOut),
    prepUse: sum((b) => b.prepUse),
    waste: sum((b) => b.waste),
    adjusted: sum((b) => b.adjusted),
    closing: last.closing,
    closingValue: last.closingValue,
    moves: blocks.reduce((total, b) => total + b.moves, 0),
    hasAdjustment: blocks.some((b) => b.hasAdjustment),
    columns: (['in', 'sentOut', 'prepUse', 'waste', 'adjusted'] as const).filter((c) => blocks.some((b) => b.columns.includes(c))),
    references: [],
    entries: blocks.flatMap((b) => b.entries),
  };
};

/** "ADJ-3402", "GRN-0412 +2 more", or, with none, "13 movements, Prep use". */
export const dayReferenceText = (block: DayBlock): string => {
  if (block.references.length === 1) return block.references[0]!;
  if (block.references.length > 1) return `${block.references[0]} +${block.references.length - 1} more`;
  return `${block.moves} ${block.moves === 1 ? 'movement' : 'movements'}, ${block.columns.map((c) => COLUMN_TEXT[c]).join(', ')}`;
};

/** "14 Sep – 5 Oct" for a collapsed span, or the single day's date. */
export const collapsedDayText = (blocks: DayBlock[]): string => {
  const first = blocks[0]!.day;
  const last = blocks[blocks.length - 1]!.day;
  return first === last ? shortDayText(first) : `${shortDayText(first)} – ${shortDayText(last)}`;
};

/** What an entry says beside its reference: the count behind an adjustment, or what a reversal undid. */
export const entryNote = (entry: CardEntryRow): string | null => {
  if (entry.isReversal) {
    const what = entry.originalReference ?? (entry.type === 'WASTE' ? 'a waste entry' : entry.type.startsWith('PREP') ? 'a prep entry' : 'an earlier entry');
    return `Reversal of ${what}`;
  }
  const { source } = movementReference(entry);
  return source ? `From ${source}` : null;
};
