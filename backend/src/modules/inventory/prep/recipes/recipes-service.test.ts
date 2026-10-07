import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { branchRepository } from '../../../../repositories/branch-repository';
import { recipesRepository } from './recipes-repository';
import { recipesService } from './recipes-service';
import { recipesQuerySchema } from './recipes-validators';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));
vi.mock('./recipes-repository', () => ({
  recipesRepository: {
    listPreppedItems: vi.fn(),
    findItem: vi.fn(),
    findLiveItems: vi.fn(),
    recipesForItems: vi.fn(),
    findRecipe: vi.fn(),
    versionsOf: vi.fn(),
    findRecipeForUpdate: vi.fn(),
    createRecipe: vi.fn(),
    setCurrentVersion: vi.fn(),
    createVersion: vi.fn(),
    recordedRuns: vi.fn(),
    lastRecordedRun: vi.fn(),
  },
}));

const hubId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const friedId = '33333333-3333-4333-8333-333333333333';
const stewId = '33333333-3333-4333-8333-333333333334';
const chickenId = '44444444-4444-4444-8444-444444444444';
const pasteId = '44444444-4444-4444-8444-444444444445';
const recipeId = '55555555-5555-4555-8555-555555555555';

const D = (v: string) => new Prisma.Decimal(v);
const manager = { id: 'sm1', role: 'STORE_MANAGER', siteId: hubId } as never;
const attendant = { id: 'sa1', role: 'STORE_ATTENDANT', siteId: hubId } as never;
const accountant = { id: 'ac1', role: 'ACCOUNTANT', siteId: hubId } as never;
const outsider = { id: 'sm2', role: 'STORE_MANAGER', siteId: branchId } as never;
const branchManager = { id: 'bm1', role: 'MANAGER', siteId: branchId } as never;

const NOW = new Date('2026-10-07T09:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const query = (over: Record<string, unknown> = {}) => recipesQuerySchema.parse(over);

const friedItem = { id: friedId, name: 'Fried chicken', usageUnit: 'portions', type: 'PREPPED' as const, deletedAt: null };
const stewItem = { id: stewId, name: 'Beef stew', usageUnit: 'kg', type: 'PREPPED' as const, deletedAt: null };

const version = (over: Record<string, unknown> = {}) => ({
  id: 'ver2',
  recipeId,
  siteId: hubId,
  version: 2,
  targetYield: D('38'),
  reason: 'BETTER_RECIPE',
  reasonNote: null,
  createdById: 'sm1',
  createdAt: daysAgo(3),
  createdBy: { id: 'sm1', name: 'Isabel Wanjiru', role: 'STORE_MANAGER' },
  lines: [
    { id: 'l1', versionId: 'ver2', inputItemId: chickenId, amount: D('10'), isMain: true, lineOrder: 0, inputItem: { id: chickenId, name: 'Chicken, cut', usageUnit: 'kg', currentCost: D('420') } },
    { id: 'l2', versionId: 'ver2', inputItemId: pasteId, amount: D('1'), isMain: false, lineOrder: 1, inputItem: { id: pasteId, name: 'Garlic-ginger paste', usageUnit: 'kg', currentCost: D('300') } },
  ],
  ...over,
});
const friedRecipe = (v = version()) => ({ id: recipeId, siteId: hubId, outputItemId: friedId, currentVersion: v.version, createdAt: daysAgo(40), versions: [v] });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubId } as never);
  vi.mocked(recipesRepository.listPreppedItems).mockResolvedValue([stewItem, friedItem]);
  vi.mocked(recipesRepository.recipesForItems).mockResolvedValue([friedRecipe()] as never);
  vi.mocked(recipesRepository.recordedRuns).mockResolvedValue([]);
  vi.mocked(recipesRepository.findItem).mockResolvedValue(friedItem as never);
  vi.mocked(recipesRepository.findRecipe).mockResolvedValue(friedRecipe() as never);
  vi.mocked(recipesRepository.versionsOf).mockResolvedValue([
    { version: 2, createdAt: daysAgo(3), reason: 'BETTER_RECIPE', reasonNote: null, createdBy: { id: 'sm1', name: 'Isabel Wanjiru', role: 'STORE_MANAGER' } },
    { version: 1, createdAt: daysAgo(40), reason: null, reasonNote: null, createdBy: { id: 'sm1', name: 'Isabel Wanjiru', role: 'STORE_MANAGER' } },
  ] as never);
  vi.mocked(recipesRepository.findLiveItems).mockResolvedValue([{ id: chickenId, name: 'Chicken, cut' }, { id: pasteId, name: 'Garlic-ginger paste' }]);
  vi.mocked(recipesRepository.findRecipeForUpdate).mockResolvedValue(null);
  vi.mocked(recipesRepository.createRecipe).mockResolvedValue({ id: recipeId });
  vi.mocked(recipesRepository.lastRecordedRun).mockResolvedValue(null);
});

describe('recipesService.list', () => {
  it('shows every live prepped item, recipe or not, with the ingredients line and the counts', async () => {
    const out = await recipesService.list(manager, query(), NOW);
    expect(out.items.map((r) => r.itemName)).toEqual(['Beef stew', 'Fried chicken']);
    expect(out.items[1]?.recipe).toMatchObject({
      ingredientsText: '10 kg chicken, cut · 1 kg garlic-ginger paste',
      targetYield: '38',
      mainItemName: 'Chicken, cut',
      version: 2,
      lastChangedBy: { id: 'sm1', name: 'Isabel Wanjiru', initials: 'IW', roleLabel: 'Store Manager' },
    });
    expect(out.items[0]?.recipe).toBeNull();
    expect(out).toMatchObject({ total: 2, totalItems: 2, withoutRecipe: 1 });
  });

  it('reads the hub, every query carries the hub site id, and everyone with prep.read can list', async () => {
    for (const actor of [manager, attendant, accountant, branchManager]) {
      vi.mocked(recipesRepository.listPreppedItems).mockClear();
      await recipesService.list(actor, query(), NOW);
      expect(recipesRepository.listPreppedItems).toHaveBeenCalledWith(hubId);
      expect(recipesRepository.recipesForItems).toHaveBeenLastCalledWith(hubId, [stewId, friedId]);
    }
  });

  it('refuses a caller outside the hub who cannot read across sites (the Branch Manager can, see above)', async () => {
    await expect(recipesService.list(outsider, query(), NOW)).rejects.toThrow(/hub/i);
    expect(recipesRepository.listPreppedItems).not.toHaveBeenCalled();
  });

  it('gives an item with no recipe its past-runs average, "about 3 kg", from RECORDED runs only', async () => {
    vi.mocked(recipesRepository.recordedRuns).mockResolvedValue([
      { actualYield: D('3'), createdAt: daysAgo(1) },
      { actualYield: D('3.2'), createdAt: daysAgo(2) },
      { actualYield: D('2.8'), createdAt: daysAgo(3) },
    ]);
    const out = await recipesService.list(manager, query(), NOW);
    expect(out.items[0]).toMatchObject({ itemName: 'Beef stew', recipe: null, pastRunsAverageText: 'about 3 kg' });
    expect(out.items[1]?.pastRunsAverageText).toBeNull();
    expect(recipesRepository.recordedRuns).toHaveBeenCalledTimes(1);
    expect(recipesRepository.recordedRuns).toHaveBeenCalledWith(hubId, stewId);
  });

  it('has no average when there are no runs', async () => {
    const out = await recipesService.list(manager, query(), NOW);
    expect(out.items[0]?.pastRunsAverageText).toBeNull();
  });

  it('filters by show', async () => {
    expect((await recipesService.list(manager, query({ show: 'has' }), NOW)).items.map((r) => r.itemName)).toEqual(['Fried chicken']);
    expect((await recipesService.list(manager, query({ show: 'none' }), NOW)).items.map((r) => r.itemName)).toEqual(['Beef stew']);
  });

  it('searches the item name and the ingredient names, case-insensitively', async () => {
    expect((await recipesService.list(manager, query({ search: 'GARLIC' }), NOW)).items.map((r) => r.itemName)).toEqual(['Fried chicken']);
    expect((await recipesService.list(manager, query({ search: 'stew' }), NOW)).items.map((r) => r.itemName)).toEqual(['Beef stew']);
    expect((await recipesService.list(manager, query({ search: 'nothing' }), NOW)).total).toBe(0);
  });

  it('filters by when the recipe last changed; an item without a recipe never matches a date filter', async () => {
    expect((await recipesService.list(manager, query({ changed: '30d' }), NOW)).items.map((r) => r.itemName)).toEqual(['Fried chicken']);
    expect((await recipesService.list(manager, query({ changed: 'older' }), NOW)).total).toBe(0);
    vi.mocked(recipesRepository.recipesForItems).mockResolvedValue([friedRecipe(version({ createdAt: daysAgo(45) }))] as never);
    expect((await recipesService.list(manager, query({ changed: 'older' }), NOW)).items.map((r) => r.itemName)).toEqual(['Fried chicken']);
    expect((await recipesService.list(manager, query({ changed: '30d' }), NOW)).total).toBe(0);
  });

  it('keeps the counts whole while the filters narrow the rows, and pages', async () => {
    const out = await recipesService.list(manager, query({ show: 'has', perPage: 1, page: 1 }), NOW);
    expect(out).toMatchObject({ total: 1, totalItems: 2, withoutRecipe: 1 });
    const second = await recipesService.list(manager, query({ perPage: 1, page: 2 }), NOW);
    expect(second.items.map((r) => r.itemName)).toEqual(['Fried chicken']);
  });
});

describe('recipesService.get', () => {
  it('returns the current version, who changed it, the history, and the cost per unit for a caller who sees costs', async () => {
    const detail = await recipesService.get(manager, friedId);
    expect(detail.current).toMatchObject({ version: 2, targetYield: '38', reason: 'BETTER_RECIPE', changedBy: { name: 'Isabel Wanjiru' } });
    expect(detail.current?.lines).toEqual([
      { itemId: chickenId, itemName: 'Chicken, cut', unit: 'kg', amount: '10', isMain: true },
      { itemId: pasteId, itemName: 'Garlic-ginger paste', unit: 'kg', amount: '1', isMain: false },
    ]);
    expect(detail.history.map((h) => h.version)).toEqual([2, 1]);
    // (10 x 420 + 1 x 300) / 38 = 118.42
    expect(detail.costPerUnitNow).toBe('118.42');
    expect(detail.suggestFromLastRun).toBeNull();
    expect(recipesRepository.findItem).toHaveBeenCalledWith(hubId, friedId);
    expect(recipesRepository.findRecipe).toHaveBeenCalledWith(hubId, friedId);
  });

  it('never carries a cost to the Attendant (the key is absent, not null)', async () => {
    const detail = await recipesService.get(attendant, friedId);
    expect('costPerUnitNow' in detail).toBe(false);
    expect(JSON.stringify(detail)).not.toMatch(/cost/i);
    expect(detail.current?.lines).toHaveLength(2);
  });

  it('carries the cost for the Accountant, Director and Branch Manager too', async () => {
    for (const actor of [accountant, branchManager, { id: 'd', role: 'DIRECTOR', siteId: hubId } as never]) {
      expect((await recipesService.get(actor, friedId)).costPerUnitNow).toBe('118.42');
    }
  });

  it('suggests the last run when there is no recipe, with the amounts it used', async () => {
    vi.mocked(recipesRepository.findItem).mockResolvedValue(stewItem as never);
    vi.mocked(recipesRepository.findRecipe).mockResolvedValue(null);
    vi.mocked(recipesRepository.lastRecordedRun).mockResolvedValue({
      reference: 'PREP-0131',
      actualYield: D('3'),
      createdAt: new Date('2026-10-05T10:00:00.000Z'),
      inputLines: [{ inputItemId: chickenId, quantity: D('6'), inputItem: { name: 'Beef mince', usageUnit: 'kg' } }],
    } as never);
    const detail = await recipesService.get(manager, stewId);
    expect(detail.current).toBeNull();
    expect(detail.history).toEqual([]);
    expect(detail.suggestFromLastRun).toEqual({
      lines: [{ itemId: chickenId, itemName: 'Beef mince', unit: 'kg', amount: '6' }],
      made: '3',
      basedOn: 'last run, 5 Oct (PREP-0131)',
    });
    expect('costPerUnitNow' in detail).toBe(false);
  });

  it('is 404 for an item that is not prepped or not in the site', async () => {
    vi.mocked(recipesRepository.findItem).mockResolvedValue({ ...friedItem, type: 'RAW_INGREDIENT' } as never);
    await expect(recipesService.get(manager, friedId)).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(recipesRepository.findItem).mockResolvedValue(null);
    await expect(recipesService.get(manager, friedId)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('recipesService.save', () => {
  const lines = [
    { itemId: chickenId, amount: '10', isMain: true },
    { itemId: pasteId, amount: '1', isMain: false },
  ];

  it('writes version 1 with no reason, in one transaction, scoped to the hub', async () => {
    vi.mocked(recipesRepository.findRecipe).mockResolvedValue(null);
    await recipesService.save(manager, friedId, { targetYield: '38', lines, reason: 'BETTER_RECIPE' });
    expect(recipesRepository.createRecipe).toHaveBeenCalledWith(expect.anything(), { siteId: hubId, outputItemId: friedId });
    expect(recipesRepository.createVersion).toHaveBeenCalledWith(expect.anything(), {
      siteId: hubId,
      recipeId,
      version: 1,
      targetYield: '38',
      reason: null,
      reasonNote: null,
      createdById: 'sm1',
      lines: [
        { inputItemId: chickenId, amount: '10', isMain: true },
        { inputItemId: pasteId, amount: '1', isMain: false },
      ],
    });
    expect(recipesRepository.setCurrentVersion).not.toHaveBeenCalled();
    expect(recipesRepository.findLiveItems).toHaveBeenCalledWith(hubId, [chickenId, pasteId]);
  });

  const existing = () =>
    vi.mocked(recipesRepository.findRecipeForUpdate).mockResolvedValue({
      id: recipeId,
      siteId: hubId,
      outputItemId: friedId,
      currentVersion: 2,
      createdAt: daysAgo(40),
      versions: [{ ...version(), lines: version().lines.map(({ inputItem: _i, ...l }) => l) }],
    } as never);

  it('writes version n+1 with the reason and bumps currentVersion', async () => {
    existing();
    await recipesService.save(manager, friedId, { targetYield: '40', lines, reason: 'PORTION_SIZE_CHANGED' });
    expect(recipesRepository.createRecipe).not.toHaveBeenCalled();
    expect(recipesRepository.createVersion).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ version: 3, recipeId, reason: 'PORTION_SIZE_CHANGED', reasonNote: null, targetYield: '40' }));
    expect(recipesRepository.setCurrentVersion).toHaveBeenCalledWith(expect.anything(), hubId, recipeId, 3);
  });

  it('keeps the note only when the reason is Other', async () => {
    existing();
    await recipesService.save(manager, friedId, { targetYield: '40', lines, reason: 'OTHER', reasonNote: ' less salt ' });
    expect(recipesRepository.createVersion).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ reason: 'OTHER', reasonNote: 'less salt' }));
    await recipesService.save(manager, friedId, { targetYield: '41', lines, reason: 'NEW_SUPPLIER', reasonNote: 'ignored' });
    expect(recipesRepository.createVersion).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ reason: 'NEW_SUPPLIER', reasonNote: null }));
  });

  it('refuses a second version without a reason (422 REASON_REQUIRED)', async () => {
    existing();
    await expect(recipesService.save(manager, friedId, { targetYield: '40', lines })).rejects.toMatchObject({ statusCode: 422, code: 'REASON_REQUIRED' });
    expect(recipesRepository.createVersion).not.toHaveBeenCalled();
  });

  it('refuses a save that changes nothing (422 RECIPE_UNCHANGED), whatever the line order or number format', async () => {
    existing();
    await expect(
      recipesService.save(manager, friedId, { targetYield: '38.0', lines: [{ itemId: pasteId, amount: '1.00', isMain: false }, { itemId: chickenId, amount: '10', isMain: true }], reason: 'BETTER_RECIPE' }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'RECIPE_UNCHANGED' });
    expect(recipesRepository.createVersion).not.toHaveBeenCalled();
  });

  it('counts a changed main ingredient as a change', async () => {
    existing();
    await recipesService.save(manager, friedId, {
      targetYield: '38',
      lines: [{ itemId: chickenId, amount: '10', isMain: false }, { itemId: pasteId, amount: '1', isMain: true }],
      reason: 'BETTER_RECIPE',
    });
    expect(recipesRepository.createVersion).toHaveBeenCalled();
  });

  it('needs exactly one main ingredient (422 MAIN_INGREDIENT_REQUIRED)', async () => {
    for (const mains of [[false, false], [true, true]]) {
      await expect(
        recipesService.save(manager, friedId, { targetYield: '38', lines: [{ itemId: chickenId, amount: '10', isMain: mains[0] as boolean }, { itemId: pasteId, amount: '1', isMain: mains[1] as boolean }] }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'MAIN_INGREDIENT_REQUIRED' });
    }
    expect(recipesRepository.createVersion).not.toHaveBeenCalled();
  });

  it('refuses a duplicate ingredient and an ingredient that is the output', async () => {
    await expect(
      recipesService.save(manager, friedId, { targetYield: '38', lines: [{ itemId: chickenId, amount: '10', isMain: true }, { itemId: chickenId, amount: '1', isMain: false }] }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DUPLICATE_INPUT_LINE' });
    await expect(
      recipesService.save(manager, friedId, { targetYield: '38', lines: [{ itemId: friedId, amount: '10', isMain: true }] }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INPUT_IS_OUTPUT' });
  });

  it('is 409 for a retired item and 404 for an item that is not prepped', async () => {
    vi.mocked(recipesRepository.findItem).mockResolvedValue({ ...friedItem, deletedAt: daysAgo(1) } as never);
    await expect(recipesService.save(manager, friedId, { targetYield: '38', lines })).rejects.toMatchObject({ statusCode: 409 });
    vi.mocked(recipesRepository.findItem).mockResolvedValue({ ...friedItem, type: 'STOCKED' } as never);
    await expect(recipesService.save(manager, friedId, { targetYield: '38', lines })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses an ingredient that is missing or retired', async () => {
    vi.mocked(recipesRepository.findLiveItems).mockResolvedValue([{ id: chickenId, name: 'Chicken, cut' }]);
    await expect(recipesService.save(manager, friedId, { targetYield: '38', lines })).rejects.toMatchObject({ statusCode: 400, code: 'INGREDIENT_NOT_FOUND' });
  });

  it('turns a clash on the version number into a 409', async () => {
    existing();
    vi.mocked(recipesRepository.createVersion).mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'test' }));
    await expect(recipesService.save(manager, friedId, { targetYield: '40', lines, reason: 'BETTER_RECIPE' })).rejects.toMatchObject({ statusCode: 409, code: 'RECIPE_CHANGED_ELSEWHERE' });
  });

  it('writes only for the hub: a Store Manager sitting elsewhere is refused, the System Admin is not', async () => {
    await expect(recipesService.save(outsider, friedId, { targetYield: '38', lines })).rejects.toThrow(/hub/i);
    expect(recipesRepository.createVersion).not.toHaveBeenCalled();
    await expect(recipesService.save({ id: 'ad', role: 'SYSTEM_ADMIN', siteId: null } as never, friedId, { targetYield: '38', lines })).resolves.toBeDefined();
  });

  it('answers with the new detail', async () => {
    const detail = await recipesService.save(manager, friedId, { targetYield: '38', lines });
    expect(detail.itemId).toBe(friedId);
    expect(detail.costPerUnitNow).toBe('118.42');
  });
});
