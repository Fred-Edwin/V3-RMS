import { describe, expect, it } from 'vitest';
import fixtures from './stock-contract.fixtures.json';
import type { LedgerList, StockCard, StockItemsList, StockOverview } from './stock-contract';

/** Drift guard for the hand-written mirror: the shared samples are typed with the mirror types and their key sets are pinned. */
const keysOf = (o: object): string[] => Object.keys(o).sort();

describe('stock contract mirror', () => {
  it('overview keys', () => {
    const overview = fixtures.stockOverview as StockOverview;
    expect(keysOf(overview)).toEqual(['can', 'kpis', 'longestWithoutCount', 'todaysCounts']);
    expect(keysOf(overview.todaysCounts[0] as object)).toEqual(['byText', 'id', 'reference', 'status', 'statusText', 'what']);
  });

  it('all items keys', () => {
    const list = fixtures.stockItemsList as StockItemsList;
    expect(keysOf(list)).toEqual(['chips', 'kpis', 'page', 'rows']);
    expect(keysOf(list.rows[0] as object)).toEqual(['itemId', 'lastCountedAt', 'lastCountedText', 'name', 'onHand', 'restockLevel', 'sectionName', 'status', 'unit', 'valueKes']);
  });

  it('ledger keys: every row adds up', () => {
    const ledger = fixtures.ledgerList as LedgerList;
    expect(keysOf(ledger)).toEqual(['chips', 'from', 'kpis', 'page', 'periodText', 'rows', 'to']);
    const row = ledger.rows[0]!;
    expect(keysOf(row)).toEqual(['adjusted', 'closing', 'closingValueKes', 'in', 'itemId', 'name', 'note', 'opening', 'prepUse', 'sentOut', 'unit', 'waste']);
    const sum = [row.opening, row.in, row.sentOut, row.prepUse, row.waste, row.adjusted].reduce((s, v) => s + Number(v), 0);
    expect(sum).toBe(Number(row.closing));
  });

  it('stock card keys', () => {
    const card = fixtures.stockCard as StockCard;
    expect(keysOf(card)).toEqual(['days', 'footerText', 'from', 'item', 'lastCounted', 'onHand', 'periodText', 'status', 'statusText', 'strip', 'to', 'unitCostText', 'valueKes']);
    expect(keysOf(card.days[0] as object)).toEqual(['adjusted', 'closing', 'closingValueKes', 'collapsed', 'day', 'dayText', 'in', 'opening', 'prepUse', 'referenceText', 'references', 'sentOut', 'waste']);
  });
});
