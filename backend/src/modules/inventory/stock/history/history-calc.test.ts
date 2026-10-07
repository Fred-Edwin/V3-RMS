import { Prisma, type InventoryTransactionType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildDayBlocks, collapsedDayText, collapseBlocks, columnOf, dayReferenceText, entryNote, ledgerCsv, ledgerKpis, ledgerPeriodText, type LedgerColumn } from './history-calc';
import type { CardEntryRow, LedgerSummaryRow, LedgerTotals } from './history-repository';

const D = (v: string | number) => new Prisma.Decimal(v);

const entry = (n: number, type: InventoryTransactionType, quantity: number, at: string, over: Partial<CardEntryRow> = {}): CardEntryRow => ({
  id: `e${n}`,
  createdAt: new Date(at),
  type,
  quantity: D(quantity),
  unitCost: D(100),
  adjustmentReference: null,
  countReference: null,
  deliveryReference: null,
  prepReference: null,
  dispatchLabel: null,
  isReversal: false,
  originalReference: null,
  reversed: false,
  ...over,
});

describe('columnOf', () => {
  it('puts every movement type in exactly one of the five columns', () => {
    const all: InventoryTransactionType[] = ['RECEIVE', 'PREP_CONSUME', 'PREP_PRODUCE', 'WASTE', 'ADJUSTMENT', 'DISPATCH_OUT', 'DISPATCH_IN', 'MARKET_RECEIVE', 'SALE'];
    expect(all.map(columnOf)).toEqual(['in', 'prepUse', 'in', 'waste', 'adjusted', 'sentOut', 'in', 'in', 'sentOut']);
  });
});

describe('ledgerKpis', () => {
  const totals: LedgerTotals = { openingValue: D(510200), inValue: D(214600), outValue: D(-239000), adjustedValue: D(-3400), closingValue: D(482400), openingItems: 142 };

  it('adds up on screen: opening + in − out − adjusted = closing', () => {
    const cells = ledgerKpis(totals, '2026-09-14');
    expect(cells.map((c) => c.value)).toEqual(['KES 510,200', '+KES 214,600', '−KES 239,000', 'KES 482,400']);
    expect(cells[0]).toMatchObject({ label: 'OPENING · 14 SEP', caption: '142 items' });
    expect(cells[3]).toMatchObject({ label: 'CLOSING · ADJUSTED −3,400', caption: '510,200 + 214,600 − 239,000 − 3,400', tone: 'WARN' });
  });

  it('lets the adjusted amount absorb rounding so the caption still adds up', () => {
    const rounded: LedgerTotals = { openingValue: D('100.4'), inValue: D('50.4'), outValue: D('-20.4'), adjustedValue: D('0'), closingValue: D('130.4'), openingItems: 1 };
    const caption = ledgerKpis(rounded, '2026-09-14')[3]!.caption;
    expect(caption).toBe('100 + 50 − 20 + 0');
  });

  it('is plain CLOSING and neutral when nothing was adjusted', () => {
    const cells = ledgerKpis({ ...totals, adjustedValue: D(0), outValue: D(-243400), closingValue: D(481400) }, '2026-09-14');
    expect(cells[3]).toMatchObject({ label: 'CLOSING', tone: 'NEUTRAL' });
  });
});

describe('ledgerPeriodText', () => {
  const now = new Date('2026-10-13T13:30:00Z'); // 16:30 Nairobi
  it('words the default, one day and a range', () => {
    expect(ledgerPeriodText('2026-09-14', '2026-10-13', now)).toBe('Last 30 days, as of 13 Oct, 16:30');
    expect(ledgerPeriodText('2026-09-14', '2026-10-13', now, ' ·')).toBe('Last 30 days · as of 13 Oct, 16:30');
    expect(ledgerPeriodText('2026-10-13', '2026-10-13', now)).toBe('Tue 13 Oct');
    expect(ledgerPeriodText('2026-09-14', '2026-10-05', now)).toBe('14 Sep to 5 Oct');
  });
});

describe('ledgerCsv', () => {
  const row: LedgerSummaryRow = {
    itemId: 'i1', name: 'Sugar, "white"', unit: 'kg', type: 'RAW_INGREDIENT',
    opening: D(160), in: D(50), sentOut: D(-20), prepUse: D(-12), waste: D(0), adjusted: D(-14), closing: D(164), closingValue: D('30012'), madeInPrep: false,
  };

  it('writes a header and one quoted row per item', () => {
    expect(ledgerCsv([row])).toBe('Item,Unit,Opening,In,Sent out,Prep use,Waste,Adjusted,Closing,Closing value (KES)\r\n"Sugar, ""white""",kg,160,50,-20,-12,0,-14,164,30012.00\r\n');
  });

  it('keeps a name that looks like a formula as text', () => {
    expect(ledgerCsv([{ ...row, name: '=SUM(A1)' }]).split('\r\n')[1]).toMatch(/^'=SUM\(A1\),kg/);
  });
});

describe('the stock card days', () => {
  // 12 Oct (Nairobi): receive 50, waste -2. 13 Oct: count adjustment -16.
  const entries = [
    entry(1, 'RECEIVE', 50, '2026-10-12T06:00:00Z', { deliveryReference: 'GRN-0412' }),
    entry(2, 'WASTE', -2, '2026-10-12T09:00:00Z'),
    entry(3, 'ADJUSTMENT', -16, '2026-10-13T05:00:00Z', { adjustmentReference: 'ADJ-3402', countReference: 'CNT-2026-1013' }),
  ];
  const blocks = buildDayBlocks(entries, { quantity: D(130), value: D(13000) });

  it('chains opening and closing day to day, quantity and money', () => {
    expect(blocks.map((b) => [b.day, b.opening.toString(), b.closing.toString(), b.closingValue.toString()])).toEqual([
      ['2026-10-12', '130', '178', '17800'],
      ['2026-10-13', '178', '162', '16200'],
    ]);
  });

  it('adds up in every day: opening + in + sentOut + prepUse + waste + adjusted = closing', () => {
    for (const b of blocks) {
      const columns: LedgerColumn[] = ['in', 'sentOut', 'prepUse', 'waste', 'adjusted'];
      const sum = columns.reduce((total, c) => total.plus(b[c]), b.opening);
      expect(sum.toString()).toBe(b.closing.toString());
    }
  });

  it('reads a day by its one reference, or by its count of movements when it has none or several', () => {
    expect(dayReferenceText(blocks[1]!)).toBe('ADJ-3402');
    expect(dayReferenceText(blocks[0]!)).toBe('GRN-0412');
    expect(dayReferenceText({ ...blocks[0]!, references: ['A-1', 'A-2', 'A-3'] })).toBe('A-1 +2 more');
    expect(dayReferenceText({ ...blocks[0]!, references: [] })).toBe('2 movements, In, Waste');
  });

  it('folds quiet days into one row that still adds up', () => {
    const folded = collapseBlocks(blocks);
    expect(folded).toMatchObject({ day: '2026-10-12', moves: 3 });
    expect(folded.opening.toString()).toBe('130');
    expect(folded.closing.toString()).toBe('162');
    expect(folded.in.plus(folded.waste).plus(folded.adjusted).plus(folded.opening).toString()).toBe('162');
    expect(collapsedDayText(blocks)).toBe('12 Oct – 13 Oct');
    expect(collapsedDayText([blocks[0]!])).toBe('12 Oct');
    expect(dayReferenceText(folded)).toBe('3 movements, In, Waste, Adjusted');
  });

  it('puts a day after midnight Nairobi on the Nairobi day, not the UTC day', () => {
    const late = buildDayBlocks([entry(9, 'WASTE', -1, '2026-10-12T21:30:00Z')], { quantity: D(5), value: D(500) });
    expect(late[0]!.day).toBe('2026-10-13');
  });
});

describe('entryNote', () => {
  it('names the count behind an adjustment and what a reversal undid', () => {
    expect(entryNote(entry(1, 'ADJUSTMENT', -16, '2026-10-13T05:00:00Z', { adjustmentReference: 'ADJ-3402', countReference: 'CNT-2026-1013' }))).toBe('From CNT-2026-1013');
    expect(entryNote(entry(2, 'ADJUSTMENT', 16, '2026-10-13T06:00:00Z', { isReversal: true, originalReference: 'ADJ-3402' }))).toBe('Reversal of ADJ-3402');
    expect(entryNote(entry(3, 'WASTE', 2, '2026-10-13T06:00:00Z', { isReversal: true }))).toBe('Reversal of a waste entry');
    expect(entryNote(entry(4, 'RECEIVE', 5, '2026-10-13T06:00:00Z'))).toBeNull();
  });
});
