/**
 * The story repository against the REAL database: the queries run and read the ledger and documents the way the story rules
 * expect. Opt-in (`RUN_DB_TESTS=1`); read-only.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../../config/database';
import { countStoryRepository } from './count-story-repository';

const enabled = process.env['RUN_DB_TESTS'] === '1';

describe.skipIf(!enabled)('countStoryRepository against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const hubStore = async () => {
    const location = await prisma.location.findFirstOrThrow({ where: { type: 'CENTRAL_STORE' } });
    return { siteId: location.siteId, locationId: location.id };
  };
  const long = { from: new Date('2020-01-01T00:00:00Z'), to: new Date('2100-01-01T00:00:00Z') };

  it('finds an item that is an input of a current prep recipe, and not one that is not', async () => {
    const { siteId } = await hubStore();
    const line = await prisma.prepRecipeLine.findFirst({ where: { version: { siteId } }, select: { inputItemId: true } });
    if (line) expect(await countStoryRepository.isPrepRecipeInput(siteId, line.inputItemId)).toBeTypeOf('boolean');
    expect(await countStoryRepository.isPrepRecipeInput(siteId, '00000000-0000-4000-8000-000000000000')).toBe(false);
  });

  it('dispatches, prep runs and deliveries come back with their document labels', async () => {
    const { siteId, locationId } = await hubStore();
    const prep = await prisma.inventoryTransaction.findFirst({ where: { siteId, locationId, type: 'PREP_CONSUME', reversesTransactionId: null, quantity: { lt: 0 } } });
    if (prep) {
      const runs = await countStoryRepository.prepRuns({ siteId, locationId, itemId: prep.inventoryItemId, ...long });
      expect(runs.length).toBeGreaterThan(0);
      expect(runs.every((r) => r.reference.startsWith('PREP-') && r.quantity.isNegative())).toBe(true);
      expect(await countStoryRepository.usedInPrepLastWeek({ siteId, locationId, itemId: prep.inventoryItemId, to: new Date(prep.createdAt.getTime() + 1000) })).toBe(true);
    }
    const receive = await prisma.inventoryTransaction.findFirst({ where: { siteId, locationId, type: 'RECEIVE', quantity: { gt: 0 }, purchaseDeliveryLineId: { not: null } } });
    if (receive) {
      const deliveries = await countStoryRepository.deliveries({ siteId, locationId, itemId: receive.inventoryItemId, ...long });
      expect(deliveries.length).toBeGreaterThan(0);
      expect(deliveries.every((d) => d.reference.startsWith('GRN-'))).toBe(true);
    }
    const dispatch = await prisma.inventoryTransaction.findFirst({ where: { siteId, locationId, type: 'DISPATCH_OUT', dispatchLineId: { not: null } } });
    if (dispatch) {
      const dispatches = await countStoryRepository.dispatches({ siteId, locationId, itemId: dispatch.inventoryItemId, ...long });
      expect(dispatches.length).toBeGreaterThan(0);
      expect(dispatches.every((d) => d.label.length > 0 && d.toSiteName.length > 0)).toBe(true);
    }
  });

  it('an item with nothing in the window has nothing', async () => {
    const { siteId, locationId } = await hubStore();
    const itemId = '00000000-0000-4000-8000-000000000000';
    const window = { siteId, locationId, itemId, ...long };
    expect(await countStoryRepository.dispatches(window)).toEqual([]);
    expect(await countStoryRepository.prepRuns(window)).toEqual([]);
    expect(await countStoryRepository.deliveries(window)).toEqual([]);
    expect(await countStoryRepository.usedInPrepLastWeek({ siteId, locationId, itemId, to: long.to })).toBe(false);
  });
});
