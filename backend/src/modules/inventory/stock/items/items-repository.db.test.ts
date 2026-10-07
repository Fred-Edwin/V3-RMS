/**
 * The All-items SQL against a REAL database, read only. Opt-in: `RUN_DB_TESTS=1 DATABASE_URL=... pnpm exec vitest run <file>`.
 * Proves the SQL status chips agree with `itemStockStatus` (the TypeScript rule the rows use) and with the store totals.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../../config/database';
import { itemStockStatus } from '../_shared/stock-status';
import { stockRepository } from '../_shared/stock-repository';
import { itemsRepository, type ItemsFilter } from './items-repository';

const enabled = process.env['RUN_DB_TESTS'] === '1';

describe.skipIf(!enabled)('All items against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const filter = async (): Promise<ItemsFilter> => {
    const location = await prisma.location.findFirstOrThrow({ where: { type: 'CENTRAL_STORE' } });
    return { siteId: location.siteId, locationId: location.id };
  };

  it('the chips are what the rows’ statuses say, row by row', async () => {
    const f = await filter();
    const all = await itemsRepository.findPage(f, 'all', 1, 10_000);
    const chips = await itemsRepository.chipCounts(f);
    const status = all.map((r) => itemStockStatus(r.onHand, r.restockLevel));
    expect(chips.all).toBe(all.length);
    expect(chips.low).toBe(status.filter((s) => s === 'LOW' || s === 'OUT').length);
    expect(chips.negative).toBe(status.filter((s) => s === 'NEGATIVE').length);
    const low = await itemsRepository.findPage(f, 'low', 1, 10_000);
    expect(low.every((r) => ['LOW', 'OUT'].includes(itemStockStatus(r.onHand, r.restockLevel)))).toBe(true);
    expect(low).toHaveLength(chips.low);
  });

  it('the store totals match the rows', async () => {
    const f = await filter();
    const all = await itemsRepository.findPage(f, 'all', 1, 10_000);
    const totals = await stockRepository.storeTotals(f.siteId, f.locationId);
    const chips = await itemsRepository.chipCounts(f);
    expect(totals.tracked).toBe(all.length);
    expect(totals.lowOrOut).toBe(chips.low);
    expect(totals.negative).toBe(chips.negative);
    const value = all.reduce((sum, r) => sum.plus(r.onHand.times(r.currentCost)), totals.value.times(0));
    expect(value.toDecimalPlaces(4).toString()).toBe(totals.value.toDecimalPlaces(4).toString());
  });

  it('search narrows by name and the pager walks the rows once each', async () => {
    const f = await filter();
    const all = await itemsRepository.findPage(f, 'all', 1, 10_000);
    const hits = await itemsRepository.findPage({ ...f, search: all[0]!.name.slice(0, 3) }, 'all', 1, 100);
    expect(hits.map((r) => r.itemId)).toContain(all[0]!.itemId);
    const seen: string[] = [];
    for (let page = 1; page <= Math.ceil(all.length / 25); page += 1) seen.push(...(await itemsRepository.findPage(f, 'all', page, 25)).map((r) => r.itemId));
    expect(seen).toEqual(all.map((r) => r.itemId));
  });
});
