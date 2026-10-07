import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { wasteEntrySchema, wasteItemsSchema } from './waste-contract';
import type { WasteLogRow } from './waste-row';
import { wasteView } from './waste-view';

const NOW = new Date('2026-10-13T11:20:00Z');
const attendant = { id: 'u-peter', role: 'STORE_ATTENDANT' as const, siteId: 'hub' };
const manager = { id: 'u-sam', role: 'STORE_MANAGER' as const, siteId: 'hub' };

const log = (over: Partial<WasteLogRow> = {}): WasteLogRow => ({
  id: 'd0000000-0000-4000-8000-000000000001',
  siteId: 'hub',
  locationId: 'store',
  inventoryItemId: '10000000-0000-4000-8000-000000000060',
  quantity: new Prisma.Decimal(3),
  reason: 'EXPIRY',
  note: null,
  unitCost: new Prisma.Decimal(420),
  loggedById: 'u-peter',
  createdAt: new Date('2026-10-13T08:00:00Z'),
  batchId: 'b1',
  reversedAt: null,
  reversedById: null,
  reversalReason: null,
  reversalNote: null,
  inventoryItem: { id: '10000000-0000-4000-8000-000000000060', name: 'Marinated chicken', usageUnit: 'kg' },
  loggedBy: { id: 'u-peter', name: 'Peter Kariuki', role: 'STORE_ATTENDANT' },
  reversedBy: null,
  ...over,
});

const reversed = log({
  reversedAt: new Date('2026-10-13T08:10:00Z'),
  reversedById: 'u-peter',
  reversalReason: 'WRONG_QUANTITY',
  reversalNote: null,
  reversedBy: { id: 'u-peter', name: 'Peter Kariuki', role: 'STORE_ATTENDANT' },
});

describe('wasteView.entry', () => {
  it('builds the contract shape with item cost for the Attendant', () => {
    const entry = wasteView.entry(attendant, log(), NOW);
    expect(() => wasteEntrySchema.parse(entry)).not.toThrow();
    expect(entry).toMatchObject({ quantity: '3', unit: 'kg', reasonText: 'Expired', valueKes: '1260.00', status: 'LOGGED', reversal: null, can: { reverse: true } });
    expect(entry.loggedBy).toEqual({ id: 'u-peter', name: 'Peter Kariuki', initials: 'PK', roleLabel: 'Store Attendant' });
  });

  it('counts a reversed entry for nothing and shows who reversed it and why', () => {
    const entry = wasteView.entry(manager, reversed, NOW);
    expect(() => wasteEntrySchema.parse(entry)).not.toThrow();
    expect(entry).toMatchObject({ status: 'REVERSED', valueKes: '0.00', can: { reverse: false } });
    expect(entry.reversal).toMatchObject({ reason: 'WRONG_QUANTITY', reasonText: 'Wrong quantity', note: null, by: { name: 'Peter Kariuki' } });
  });

  it('says the Attendant cannot reverse someone else’s entry or an old one, the Manager can reverse an old one', () => {
    expect(wasteView.entry(attendant, log({ loggedById: 'u-other' }), NOW).can.reverse).toBe(false);
    const old = log({ createdAt: new Date('2026-10-10T08:00:00Z') });
    expect(wasteView.entry(attendant, old, NOW).can.reverse).toBe(false);
    expect(wasteView.entry(manager, old, NOW).can.reverse).toBe(true);
  });

  it('never carries a stock figure key', () => {
    const json = JSON.stringify(wasteView.entry(attendant, log(), NOW));
    expect(json).not.toMatch(/onHand|wentNegative|expected|difference|restock/i);
  });
});

describe('wasteView.logResult', () => {
  it('adds the total and went-negative only for those who may see them', () => {
    const logs = [log(), log({ id: 'd0000000-0000-4000-8000-000000000002', quantity: new Prisma.Decimal(2), unitCost: new Prisma.Decimal(180) })];
    const forManager = wasteView.logResult(manager, logs, { wentNegative: true, replayed: false }, NOW);
    expect(forManager).toMatchObject({ totalValueKes: '1620.00', wentNegative: true, replayed: false });
    const forAttendant = wasteView.logResult(attendant, logs, { wentNegative: true, replayed: false }, NOW);
    expect(forAttendant).toMatchObject({ totalValueKes: '1620.00', replayed: false });
    expect(forAttendant).not.toHaveProperty('wentNegative');
  });
});

describe('wasteView.items', () => {
  it('drops on-hand for the Attendant and keeps it for the Manager', () => {
    const row = { id: '10000000-0000-4000-8000-000000000050', name: 'Tomatoes', usageUnit: 'kg', currentCost: new Prisma.Decimal(90), onHand: new Prisma.Decimal(-4) };
    const forManager = wasteView.items(manager, { often: [], items: [row] });
    expect(() => wasteItemsSchema.parse(forManager)).not.toThrow();
    expect(forManager.items[0]).toEqual({ itemId: row.id, name: 'Tomatoes', unit: 'kg', unitCost: '90.00', onHand: '-4' });
    expect(wasteView.items(attendant, { often: [], items: [row] }).items[0]).toEqual({ itemId: row.id, name: 'Tomatoes', unit: 'kg', unitCost: '90.00' });
  });
});
