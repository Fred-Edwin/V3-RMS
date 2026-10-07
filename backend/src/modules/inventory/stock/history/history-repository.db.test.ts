/**
 * The ledger summary SQL against a REAL database (no mocks), read only: nothing is written, so it runs against whatever
 * ledger the dev database holds. Opt-in, like the door's: `RUN_DB_TESTS=1 pnpm exec vitest run <this file>`.
 *
 * It proves what a mocked test cannot: that the grouped SQL adds up by construction (every movement type is in exactly one
 * column), that opening and closing agree with an independent aggregate, that the chips count what the rows are, and that
 * search finds the document numbers.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { addDays, dayEndInstant, dayStartInstant, nairobiDay } from '../_shared/nairobi-time';
import { historyRepository, type LedgerFilter } from './history-repository';

const enabled = process.env['RUN_DB_TESTS'] === '1';

describe.skipIf(!enabled)('the ledger summary against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const base = async (): Promise<LedgerFilter> => {
    const location = await prisma.location.findFirstOrThrow({ where: { type: 'CENTRAL_STORE' } });
    const today = nairobiDay(new Date());
    return { siteId: location.siteId, locationId: location.id, start: dayStartInstant(addDays(today, -400)), end: dayEndInstant(today) };
  };

  it('every row adds up: opening + in + sentOut + prepUse + waste + adjusted = closing', async () => {
    const filter = await base();
    const rows = await historyRepository.findSummaryAll(filter, 'all', 10_000);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const sum = [row.in, row.sentOut, row.prepUse, row.waste, row.adjusted].reduce((total, v) => total.plus(v), row.opening);
      expect(sum.toString(), row.name).toBe(row.closing.toString());
    }
  });

  it('closing agrees with an independent sum of the ledger, and a narrower period moves opening, not the closing', async () => {
    const filter = await base();
    const rows = await historyRepository.findSummaryAll(filter, 'all', 10_000);
    const sample = rows.slice(0, 5);
    for (const row of sample) {
      const direct = await prisma.inventoryTransaction.aggregate({ where: { siteId: filter.siteId, locationId: filter.locationId, inventoryItemId: row.itemId, createdAt: { lt: filter.end } }, _sum: { quantity: true } });
      expect(row.closing.toString(), row.name).toBe((direct._sum.quantity ?? new Prisma.Decimal(0)).toString());
    }
    const recent = { ...filter, start: dayStartInstant(addDays(nairobiDay(new Date()), -3)) };
    const narrow = await historyRepository.findSummaryAll(recent, 'all', 10_000);
    for (const row of narrow) {
      const wide = rows.find((r) => r.itemId === row.itemId);
      if (wide) expect(row.closing.toString(), row.name).toBe(wide.closing.toString());
      const sum = [row.in, row.sentOut, row.prepUse, row.waste, row.adjusted].reduce((total, v) => total.plus(v), row.opening);
      expect(sum.toString(), row.name).toBe(row.closing.toString());
    }
  });

  it('the money totals add up: opening + in + out + adjusted = closing, and match the sum of the rows’ closing values', async () => {
    const filter = await base();
    const totals = await historyRepository.totals(filter);
    expect(totals.openingValue.plus(totals.inValue).plus(totals.outValue).plus(totals.adjustedValue).toDecimalPlaces(4).toString()).toBe(totals.closingValue.toDecimalPlaces(4).toString());
    const rows = await historyRepository.findSummaryAll(filter, 'all', 10_000);
    const sum = rows.reduce((total, r) => total.plus(r.closingValue), new Prisma.Decimal(0));
    expect(sum.toDecimalPlaces(4).toString()).toBe(totals.closingValue.toDecimalPlaces(4).toString());
  });

  it('the chip counts are the number of rows each chip returns', async () => {
    const filter = await base();
    const chips = await historyRepository.chipCounts(filter);
    for (const chip of ['all', 'adjustments', 'waste', 'negative'] as const) {
      const rows = await historyRepository.findSummaryAll(filter, chip, 10_000);
      expect(rows.length, chip).toBe(chips[chip]);
    }
    expect(chips.all).toBeGreaterThanOrEqual(chips.adjustments);
  });

  it('pages cover the rows once each, by name', async () => {
    const filter = await base();
    const all = await historyRepository.findSummaryAll(filter, 'all', 10_000);
    const pageSize = 25;
    const seen: string[] = [];
    for (let page = 1; page <= Math.ceil(all.length / pageSize); page += 1) {
      seen.push(...(await historyRepository.findSummaryPage(filter, 'all', page, pageSize)).map((r) => r.itemId));
    }
    expect(seen).toEqual(all.map((r) => r.itemId));
  });

  it('search finds an item by name and by an ADJ or GRN number in the period', async () => {
    const filter = await base();
    const adjustment = await prisma.inventoryTransaction.findFirst({ where: { siteId: filter.siteId, locationId: filter.locationId, type: 'ADJUSTMENT', reference: { not: null } } });
    if (adjustment?.reference) {
      const found = await historyRepository.findSummaryAll({ ...filter, search: adjustment.reference }, 'all', 100);
      expect(found.map((r) => r.itemId)).toContain(adjustment.inventoryItemId);
    }
    const receipt = await prisma.inventoryTransaction.findFirst({
      where: { siteId: filter.siteId, locationId: filter.locationId, type: 'RECEIVE', purchaseDeliveryLineId: { not: null } },
      include: { purchaseDeliveryLine: { include: { delivery: true } } },
    });
    if (receipt?.purchaseDeliveryLine) {
      const found = await historyRepository.findSummaryAll({ ...filter, search: receipt.purchaseDeliveryLine.delivery.reference }, 'all', 100);
      expect(found.map((r) => r.itemId)).toContain(receipt.inventoryItemId);
    }
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { id: (await historyRepository.findSummaryAll(filter, 'all', 1))[0]!.itemId } });
    const byName = await historyRepository.findSummaryAll({ ...filter, search: item.name.slice(0, 4) }, 'all', 100);
    expect(byName.map((r) => r.itemId)).toContain(item.id);
    expect(await historyRepository.findSummaryAll({ ...filter, search: 'no-such-thing-zzzz' }, 'all', 100)).toEqual([]);
  });

  it('the section filter keeps only that section’s items', async () => {
    const filter = await base();
    const section = await prisma.countSection.findFirst({ where: { siteId: filter.siteId, items: { some: {} } }, include: { items: true } });
    if (!section) return;
    const ids = new Set(section.items.map((i) => i.inventoryItemId));
    const rows = await historyRepository.findSummaryAll({ ...filter, sectionId: section.id }, 'all', 10_000);
    for (const row of rows) expect(ids.has(row.itemId), row.name).toBe(true);
  });

  it('a card’s entries chain from the opening to the closing', async () => {
    const filter = await base();
    const [first] = await historyRepository.findSummaryAll(filter, 'all', 1);
    const opening = await historyRepository.positionBefore(filter.siteId, filter.locationId, first!.itemId, filter.start);
    const entries = await historyRepository.findCardEntries(filter.siteId, filter.locationId, first!.itemId, filter.start, filter.end);
    const closing = entries.reduce((total, e) => total.plus(e.quantity), opening.quantity);
    expect(closing.toString()).toBe(first!.closing.toString());
  });
});
