/**
 * Usual recipes against a REAL database (no mocks): version numbering, the one-main-ingredient index, the unique keys, and
 * the service end to end. Existing Inventory tests mock Prisma, and a mocked test once hid a raw-SQL bug.
 *
 * Opt-in, because CI has no database. Run it in a lane (which has a seeded database; DATABASE_URL comes from backend/.env):
 *   cd <lane>/backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/prep/recipes/recipes.db.test.ts
 * The index and key checks run inside a transaction that is rolled back. The service test commits one throwaway prepped item
 * and its recipe, and deletes both when it finishes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { recipesRepository } from './recipes-repository';
import { recipesService } from './recipes-service';

const enabled = process.env['RUN_DB_TESTS'] === '1';

/** Thrown on purpose to roll the transaction back after the assertions. */
class Rollback extends Error {}

const inRolledBackTx = async (work: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> => {
  await expect(
    prisma.$transaction(async (tx) => {
      await work(tx);
      throw new Rollback('roll back');
    }),
  ).rejects.toBeInstanceOf(Rollback);
};

/** True when the statement fails the way a constraint violation does; the transaction is then unusable, so use a savepoint. */
const violates = async (tx: Prisma.TransactionClient, work: () => Promise<unknown>): Promise<boolean> => {
  await tx.$executeRawUnsafe('SAVEPOINT probe');
  try {
    await work();
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT probe');
    return false;
  } catch {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT probe');
    return true;
  }
};

describe.skipIf(!enabled)('Usual recipes against the real database', () => {
  const ctx = {} as {
    hubId: string;
    user: { id: string; role: 'STORE_MANAGER'; siteId: string };
    inputs: Array<{ id: string; name: string }>;
    preppedId: string;
  };

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true, isActive: true } });
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER', siteId: hub.id } });
    const inputs = await prisma.inventoryItem.findMany({ where: { siteId: hub.id, type: 'RAW_INGREDIENT', deletedAt: null }, select: { id: true, name: true }, take: 3 });
    expect(inputs.length).toBeGreaterThanOrEqual(3);
    const prepped = await prisma.inventoryItem.create({
      data: { siteId: hub.id, name: `ZZ recipe db test ${Date.now()}`, type: 'PREPPED', buyUnit: 'kg', usageUnit: 'kg', currentCost: new Prisma.Decimal(0) },
    });
    Object.assign(ctx, { hubId: hub.id, user: { id: user.id, role: 'STORE_MANAGER', siteId: hub.id }, inputs, preppedId: prepped.id });
  });

  afterAll(async () => {
    if (ctx.preppedId) {
      await prisma.prepRecipe.deleteMany({ where: { siteId: ctx.hubId, outputItemId: ctx.preppedId } }); // versions and lines cascade
      await prisma.inventoryItem.deleteMany({ where: { id: ctx.preppedId, siteId: ctx.hubId } });
    }
    await prisma.$disconnect();
  });

  it('refuses a second main ingredient in one version (partial unique index), allows one per version', async () => {
    await inRolledBackTx(async (tx) => {
      const recipe = await recipesRepository.createRecipe(tx, { siteId: ctx.hubId, outputItemId: ctx.preppedId });
      await recipesRepository.createVersion(tx, {
        siteId: ctx.hubId, recipeId: recipe.id, version: 1, targetYield: '5', reason: null, reasonNote: null, createdById: ctx.user.id,
        lines: [{ inputItemId: ctx.inputs[0]!.id, amount: '2', isMain: true }, { inputItemId: ctx.inputs[1]!.id, amount: '1', isMain: false }],
      });
      // a second version may have its own main
      await recipesRepository.createVersion(tx, {
        siteId: ctx.hubId, recipeId: recipe.id, version: 2, targetYield: '5', reason: 'BETTER_RECIPE', reasonNote: null, createdById: ctx.user.id,
        lines: [{ inputItemId: ctx.inputs[1]!.id, amount: '2', isMain: true }],
      });
      // two mains in one version is refused
      const twoMains = await violates(tx, () =>
        recipesRepository.createVersion(tx, {
          siteId: ctx.hubId, recipeId: recipe.id, version: 3, targetYield: '5', reason: 'OTHER', reasonNote: null, createdById: ctx.user.id,
          lines: [{ inputItemId: ctx.inputs[0]!.id, amount: '2', isMain: true }, { inputItemId: ctx.inputs[1]!.id, amount: '1', isMain: true }],
        }),
      );
      expect(twoMains).toBe(true);
    });
  });

  it('refuses a repeated version number and a second recipe for the same item (unique keys)', async () => {
    await inRolledBackTx(async (tx) => {
      const recipe = await recipesRepository.createRecipe(tx, { siteId: ctx.hubId, outputItemId: ctx.preppedId });
      const data = {
        siteId: ctx.hubId, recipeId: recipe.id, version: 1, targetYield: '5', reason: null, reasonNote: null, createdById: ctx.user.id,
        lines: [{ inputItemId: ctx.inputs[0]!.id, amount: '2', isMain: true }],
      };
      await recipesRepository.createVersion(tx, data);
      expect(await violates(tx, () => recipesRepository.createVersion(tx, data))).toBe(true);
      expect(await violates(tx, () => recipesRepository.createRecipe(tx, { siteId: ctx.hubId, outputItemId: ctx.preppedId }))).toBe(true);
    });
  });

  it('runs the service end to end: version 1, then version 2 with a reason, numbered 1, 2 and every row carries the hub', async () => {
    const [a, b, c] = ctx.inputs as [{ id: string; name: string }, { id: string; name: string }, { id: string; name: string }];
    const first = await recipesService.save(ctx.user as never, ctx.preppedId, {
      targetYield: '5',
      lines: [{ itemId: a.id, amount: '2', isMain: true }, { itemId: b.id, amount: '1', isMain: false }],
    });
    expect(first.current).toMatchObject({ version: 1, reason: null, targetYield: '5' });
    expect(first.history.map((h) => h.version)).toEqual([1]);

    await expect(
      recipesService.save(ctx.user as never, ctx.preppedId, { targetYield: '5', lines: [{ itemId: a.id, amount: '2', isMain: true }, { itemId: b.id, amount: '1', isMain: false }], reason: 'BETTER_RECIPE' }),
    ).rejects.toMatchObject({ code: 'RECIPE_UNCHANGED' });
    await expect(
      recipesService.save(ctx.user as never, ctx.preppedId, { targetYield: '6', lines: [{ itemId: a.id, amount: '2', isMain: true }] }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });

    const second = await recipesService.save(ctx.user as never, ctx.preppedId, {
      targetYield: '6',
      lines: [{ itemId: a.id, amount: '2', isMain: true }, { itemId: c.id, amount: '0.5', isMain: false }],
      reason: 'OTHER',
      reasonNote: 'db test',
    });
    expect(second.current).toMatchObject({ version: 2, reason: 'OTHER', targetYield: '6' });
    expect(second.history.map((h) => [h.version, h.reason, h.reasonNote])).toEqual([[2, 'OTHER', 'db test'], [1, null, null]]);

    const recipe = await prisma.prepRecipe.findFirstOrThrow({ where: { siteId: ctx.hubId, outputItemId: ctx.preppedId }, include: { versions: { orderBy: { version: 'asc' } } } });
    expect(recipe.currentVersion).toBe(2);
    expect(recipe.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(recipe.versions.every((v) => v.siteId === ctx.hubId)).toBe(true);

    const list = await recipesService.list(ctx.user as never, { show: 'has', changed: 'any', page: 1, perPage: 100, search: 'ZZ recipe db test' });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.recipe).toMatchObject({ version: 2, targetYield: '6' });
  });
});
