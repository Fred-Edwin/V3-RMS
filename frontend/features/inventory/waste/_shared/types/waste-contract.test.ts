import { describe, expect, it } from 'vitest';
import fixtures from './waste-contract.fixtures.json';
import type { LogWasteResult, WasteEntry, WasteItems, WasteList } from './waste-contract';

/** Drift guard for the hand-written mirror: the shared samples are typed with the mirror types and their key sets are pinned. */
const keysOf = (o: object): string[] => Object.keys(o).sort();

describe('waste contract mirror', () => {
  it('entry keys', () => {
    const entry = (fixtures.wasteListManager as WasteList).rows[0] as WasteEntry;
    expect(keysOf(entry)).toEqual(['at', 'can', 'id', 'itemId', 'itemName', 'loggedBy', 'note', 'quantity', 'reason', 'reasonText', 'reversal', 'status', 'unit', 'valueKes']);
    expect(keysOf(entry.can)).toEqual(['reverse']);
  });

  it('a reversed entry carries who, when and why', () => {
    const reversed = (fixtures.wasteListManager as WasteList).rows[1] as WasteEntry;
    expect(reversed.status).toBe('REVERSED');
    expect(keysOf(reversed.reversal as object)).toEqual(['at', 'by', 'note', 'reason', 'reasonText']);
    expect(reversed.can.reverse).toBe(false);
  });

  it('the Attendant payloads carry no stock figure', () => {
    const items = fixtures.wasteItems as WasteItems;
    for (const o of [...items.often, ...items.items]) expect(keysOf(o)).not.toContain('onHand');
    expect(keysOf(fixtures.logWasteResultAttendant as LogWasteResult)).toEqual(['entries', 'replayed', 'totalValueKes']);
    expect(keysOf(fixtures.wasteListAttendant as WasteList)).toEqual(['bannerText', 'chips', 'page', 'rows']);
  });

  it('the Manager list has the KPI strip and the chips', () => {
    const list = fixtures.wasteListManager as WasteList;
    expect(keysOf(list)).toEqual(['chips', 'kpis', 'page', 'rows']);
    expect(keysOf(list.chips)).toEqual(['last7', 'reversed', 'today']);
  });
});
