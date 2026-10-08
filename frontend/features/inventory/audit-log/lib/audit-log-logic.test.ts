import { describe, expect, it } from 'vitest';

import { AREA_MENU, areaButtonLabel, parseArea, rangeSentence, rangeToApi, recordHref, whenLabel } from './audit-log-logic';

describe('the Area menu (Paper step 58)', () => {
  it('lists the Central Store areas, then the Branches areas, in the order drawn', () => {
    expect(AREA_MENU.map((g) => g.heading)).toEqual(['Central Store', 'Branches']);
    expect(AREA_MENU[0]?.items.map((i) => i.label)).toEqual(['Catalog', 'Suppliers', 'Restock levels', 'Purchasing and payments', 'Prep', 'Stock counts', 'Waste', 'Stock adjustments']);
    expect(AREA_MENU[1]?.items.map((i) => i.label)).toEqual(['Requisitions', 'Dispatch', 'Discrepancies', 'Branch day', 'Branch waste']);
  });
  it('reads an area from the address, and ignores one it does not list', () => {
    expect(parseArea('STOCK_COUNTS')).toBe('STOCK_COUNTS');
    expect(parseArea('PURCHASING')).toBe('PURCHASING');
    expect(parseArea('PAYMENTS')).toBeNull();
    expect(parseArea('soon')).toBeNull();
    expect(parseArea(undefined)).toBeNull();
  });
  it('names the button', () => {
    expect(areaButtonLabel(null)).toBe('All areas');
    expect(areaButtonLabel('STOCK_ADJUSTMENTS')).toBe('Stock adjustments');
    expect(areaButtonLabel('PURCHASING')).toBe('Purchasing and payments');
  });
});

describe('rangeToApi', () => {
  it('makes both Nairobi days whole: the start of the first and the start of the day after the last (exclusive)', () => {
    expect(rangeToApi({ from: '2026-10-03', to: '2026-10-03' })).toEqual({ from: '2026-10-02T21:00:00.000Z', to: '2026-10-03T21:00:00.000Z' });
    expect(rangeToApi({ from: '2026-09-29', to: '2026-10-05' })).toEqual({ from: '2026-09-28T21:00:00.000Z', to: '2026-10-05T21:00:00.000Z' });
  });
  it('rolls over a month end', () => {
    expect(rangeToApi({ from: '2026-09-30', to: '2026-09-30' }).to).toBe('2026-09-30T21:00:00.000Z');
    expect(rangeToApi({ from: '2026-10-31', to: '2026-10-31' }).to).toBe('2026-10-31T21:00:00.000Z');
  });
});

describe('rangeSentence', () => {
  it('says what is shown', () => {
    expect(rangeSentence({ from: '2026-10-03', to: '2026-10-03' }, '2026-10-03')).toBe('Showing today, Sat 3 Oct 2026.');
    expect(rangeSentence({ from: '2026-10-02', to: '2026-10-02' }, '2026-10-03')).toBe('Showing Fri 2 Oct 2026.');
    expect(rangeSentence({ from: '2026-09-29', to: '2026-10-05' }, '2026-10-08')).toBe('Showing 29 Sep to Mon 5 Oct 2026.');
  });
});

describe('recordHref', () => {
  it('opens a count, an item’s stock card on the day, and the ledger searched for an ADJ number', () => {
    expect(recordHref({ kind: 'COUNT', id: 'c1', label: 'CNT-2026-1013' })).toBe('/app/inventory/stock/counts/c1');
    expect(recordHref({ kind: 'STOCK_CARD', id: 'i1', label: 'Stock ledger entry', day: '2026-10-08' })).toBe('/app/inventory/stock/ledger/i1?from=2026-10-08&to=2026-10-08');
    expect(recordHref({ kind: 'LEDGER_SEARCH', id: 'ADJ-0042', label: 'ADJ-0042', day: '2026-10-08' })).toBe('/app/inventory/stock/ledger?search=ADJ-0042&from=2026-10-08&to=2026-10-08');
  });
});

describe('whenLabel', () => {
  const now = new Date(2026, 9, 3, 13, 30);
  it('drops the date for today only', () => {
    expect(whenLabel(new Date(2026, 9, 3, 11, 5).toISOString(), now)).toBe('11:05');
    expect(whenLabel(new Date(2026, 9, 2, 16, 20).toISOString(), now)).toBe('2 Oct 16:20');
  });
});
