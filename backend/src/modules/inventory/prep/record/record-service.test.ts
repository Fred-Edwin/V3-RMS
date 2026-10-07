import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { prepRecipeReader } from '../_shared/prep-recipe-reader';
import { prepRunRepository, type PrepRunRow } from '../_shared/prep-run-repository';
import { recordRepository } from './record-repository';
import { recordService } from './record-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ tx: true })) } }));
vi.mock('../../_shared/reference-counter', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../../stock/ledger/ledger-door', () => ({ postStockMovement: vi.fn() }));
vi.mock('./record-repository', () => ({ recordRepository: { findCentralStore: vi.fn(), onHandByItem: vi.fn() } }));
vi.mock('../_shared/prep-recipe-reader', () => ({ prepRecipeReader: { readCurrent: vi.fn(), readCurrentForItems: vi.fn() } }));
vi.mock('../_shared/prep-run-repository', () => ({
  prepRunRepository: {
    findItems: vi.fn(),
    findByIdempotencyKey: vi.fn(),
    recentRecordedYields: vi.fn(),
    recordedRunsBetween: vi.fn(),
    recordedYieldsSince: vi.fn(),
    latestRecordedByOutput: vi.fn(),
    findLiveOutputs: vi.fn(),
    mostMadeSince: vi.fn(),
    mostRecentOutputs: vi.fn(),
    create: vi.fn(),
    setItemCurrentCost: vi.fn(),
  },
}));

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const HUB = 'hub-1';
const OUT = '33333333-3333-4333-8333-333333333333';
const CHICKEN = '44444444-4444-4444-8444-444444444444';
const PASTE = '55555555-5555-4555-8555-555555555555';
const KEY = '66666666-6666-4666-8666-666666666666';
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const manager = { id: 'sm', role: 'STORE_MANAGER', siteId: HUB } as never;
const branchAttendant = { id: 'x', role: 'STORE_ATTENDANT', siteId: 'branch-9' } as never;

const item = (id: string, name: string, type: 'PREPPED' | 'RAW_INGREDIENT', cost: number, deletedAt: Date | null = null) =>
  ({ id, name, type, usageUnit: type === 'PREPPED' ? 'portions' : 'kg', currentCost: D(cost), deletedAt });

const recipe = {
  versionId: 'v1',
  version: 1,
  targetYield: D(38),
  lines: [
    { inputItemId: CHICKEN, itemName: 'chicken', unit: 'kg', amount: D(10), isMain: true },
    { inputItemId: PASTE, itemName: 'paste', unit: 'kg', amount: D(1), isMain: false },
  ],
};

const user = (id: string, name: string, role: string) => ({ id, name, role });
const runRow = (over: Partial<PrepRunRow> = {}): PrepRunRow =>
  ({
    id: 'run-1',
    siteId: HUB,
    reference: 'PREP-0001',
    outputItemId: OUT,
    actualYield: D(38),
    outputUnitCost: D(121),
    totalInputCost: D(4598),
    yieldVarianceLabel: 'normal',
    notifiedStoreManager: false,
    locationId: 'loc-1',
    createdById: 'att',
    createdAt: new Date(),
    status: 'RECORDED',
    replacesRunId: null,
    closedAt: null,
    closedById: null,
    correctionReason: null,
    cancelReason: null,
    reasonNote: null,
    yieldReason: null,
    expectedYield: D(38),
    expectedSource: 'RECIPE',
    recipeVersionId: 'v1',
    stockFlag: true,
    needsLook: true,
    reviewedAt: null,
    reviewedById: null,
    idempotencyKey: KEY,
    outputItem: { id: OUT, name: 'Marinated chicken', usageUnit: 'portions' },
    createdBy: user('att', 'Sarah Achieng', 'STORE_ATTENDANT'),
    closedBy: null,
    reviewedBy: null,
    replacesRun: null,
    replacedByRun: null,
    recipeVersion: { version: 1 },
    inputLines: [
      { id: 'l1', prepRunId: 'run-1', inputItemId: CHICKEN, quantity: D(10), unitCostAtRunTime: D(430), lineCost: D(4300), lineOrder: 0, onHandAtRunTime: D(4), inputItem: { id: CHICKEN, name: 'chicken', usageUnit: 'kg' } },
    ],
    ...over,
  }) as PrepRunRow;

const body = { idempotencyKey: KEY, outputItemId: OUT, inputs: [{ itemId: CHICKEN, quantity: '10' }, { itemId: PASTE, quantity: '1' }], made: '38' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(recordRepository.findCentralStore).mockResolvedValue({ id: 'loc-1', siteId: HUB });
  vi.mocked(recordRepository.onHandByItem).mockResolvedValue(new Map([[CHICKEN, D(50)], [PASTE, D(5)]]));
  vi.mocked(prepRunRepository.findItems).mockResolvedValue([item(OUT, 'Marinated chicken', 'PREPPED', 0), item(CHICKEN, 'chicken', 'RAW_INGREDIENT', 430), item(PASTE, 'paste', 'RAW_INGREDIENT', 298)] as never);
  vi.mocked(prepRunRepository.findByIdempotencyKey).mockResolvedValue(null);
  vi.mocked(prepRunRepository.recentRecordedYields).mockResolvedValue([]);
  vi.mocked(prepRunRepository.recordedRunsBetween).mockResolvedValue([]);
  vi.mocked(prepRecipeReader.readCurrent).mockResolvedValue(recipe as never);
  vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('PREP-0001');
  vi.mocked(prepRunRepository.create).mockImplementation(async () => runRow());
});

describe('check', () => {
  it('judges against the recipe and gives the manager costs and stock, no more', async () => {
    const r = await recordService.check(manager, { ...body, inputs: [{ itemId: CHICKEN, quantity: '20' }], made: '60' });
    expect(r.expected).toMatchObject({ amount: '76.00', source: 'RECIPE', text: 'about 76 portions' });
    expect(r.tier).toBe('WARN');
    expect(r.vsUsual?.label).toBe('LOW');
    expect(r.cost).toEqual({ totalInput: '8600', perUnit: '143.3333' });
    expect(r.stock).toEqual([{ itemId: CHICKEN, onHand: '50', exceeds: false }]);
  });

  it('gives the Attendant neither costs nor stock, and the WARN wording for a 35%+ miss', async () => {
    const r = await recordService.check(attendant, { ...body, made: '20' });
    expect(r.tier).toBe('WARN');
    expect(r).not.toHaveProperty('cost');
    expect(r).not.toHaveProperty('stock');
  });

  it('shows the manager NOTIFY for the same miss', async () => {
    expect((await recordService.check(manager, { ...body, made: '20' })).tier).toBe('NOTIFY');
  });

  it('flags a typo and a repeat without blocking', async () => {
    vi.mocked(prepRunRepository.recordedRunsBetween).mockResolvedValue([
      { id: 'r0', reference: 'PREP-0000', createdAt: new Date('2026-10-07T05:00:00Z'), inputLines: [{ inputItemId: CHICKEN, quantity: D(10) }, { inputItemId: PASTE, quantity: D(1) }] },
    ]);
    const r = await recordService.check(attendant, { ...body, made: '380' });
    expect(r.typoSuspect.suspect).toBe(true);
    expect(r.repeat).toMatchObject({ duplicate: true, of: { reference: 'PREP-0000' } });
    expect(r.usualRecipeText).toContain('Usual recipe');
  });

  it('writes nothing', async () => {
    await recordService.check(manager, body);
    expect(prepRunRepository.create).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('refuses a branch Attendant (hub only)', async () => {
    await expect(recordService.check(branchAttendant, body)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('record', () => {
  it('posts one PREP_CONSUME per input and one PREP_PRODUCE, all linked to the run, and sets the output cost', async () => {
    const r = await recordService.record(attendant, body);
    expect(r.replayed).toBe(false);
    const posts = vi.mocked(postStockMovement).mock.calls.map((c) => c[1]);
    expect(posts.map((p) => p.type)).toEqual(['PREP_CONSUME', 'PREP_CONSUME', 'PREP_PRODUCE']);
    expect(posts.every((p) => p.links.prepRecordId === 'run-1')).toBe(true);
    expect(posts[2]?.quantity.toString()).toBe('38');
    // 10 kg at 430 + 1 kg at 298 = 4598; / 38 = 121
    expect(prepRunRepository.setItemCurrentCost).toHaveBeenCalledWith(expect.anything(), HUB, OUT, expect.anything());
    const cost = vi.mocked(prepRunRepository.setItemCurrentCost).mock.calls[0]![3];
    expect(cost.toString()).toBe('121');
  });

  it('numbers the run from the PREP counter inside the transaction and stores the judgement', async () => {
    await recordService.record(manager, body);
    expect(referenceCounterRepository.nextReference).toHaveBeenCalledWith(expect.anything(), HUB, 'PREP');
    const data = vi.mocked(prepRunRepository.create).mock.calls[0]![1];
    expect(data).toMatchObject({ reference: 'PREP-0001', expectedSource: 'RECIPE', yieldVarianceLabel: 'normal', notifiedStoreManager: false, needsLook: false, stockFlag: false, recipeVersionId: 'v1' });
    expect(data.lines.map((l) => l.onHandAtRunTime.toString())).toEqual(['50', '5']);
  });

  it('a run that uses more than is in stock saves, sets the silent flag and needsLook', async () => {
    vi.mocked(recordRepository.onHandByItem).mockResolvedValue(new Map([[CHICKEN, D(4)], [PASTE, D(5)]]));
    await recordService.record(attendant, body);
    expect(vi.mocked(prepRunRepository.create).mock.calls[0]![1]).toMatchObject({ stockFlag: true, needsLook: true });
  });

  it('never puts the silent flag, needsLook, costs or stock in the Attendant response; the manager gets them', async () => {
    const a = (await recordService.record(attendant, body)).run;
    const text = JSON.stringify(a);
    expect(text).not.toMatch(/stockFlag|exceedsStock|stockExceeded|needsLook|flags|onHand|unitCost|lineCost|totalInputCost|outputUnitCost/);

    const m = (await recordService.record(manager, body)).run;
    expect(m.needsLook).toBe(true);
    expect(m.flags?.stockExceeded).toBe(true);
    expect(m.flags?.exceedsText).toContain('Used 10 kg chicken');
    expect(m.inputs[0]).toMatchObject({ onHand: '4', exceedsStock: true, unitCost: '430' });
    expect(m.totalInputCost).toBe('4598');
  });

  it('judges a 20% miss as off target and flags it for the manager only', async () => {
    await recordService.record(manager, { ...body, made: '30', yieldReason: 'SPILLAGE' });
    expect(vi.mocked(prepRunRepository.create).mock.calls[0]![1]).toMatchObject({ yieldVarianceLabel: 'low yield', needsLook: true, notifiedStoreManager: false, yieldReason: 'SPILLAGE' });
  });

  it('with no recipe and no past runs it records unjudged', async () => {
    vi.mocked(prepRecipeReader.readCurrent).mockResolvedValue(null);
    await recordService.record(manager, body);
    expect(vi.mocked(prepRunRepository.create).mock.calls[0]![1]).toMatchObject({ expectedSource: 'NONE', expectedYield: null, yieldVarianceLabel: null, needsLook: false });
  });

  it('replays: the same key returns the recorded run, writes nothing, says replayed', async () => {
    vi.mocked(prepRunRepository.findByIdempotencyKey).mockResolvedValue(runRow());
    const r = await recordService.record(attendant, body);
    expect(r.replayed).toBe(true);
    expect(prepRunRepository.create).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('a race past the check is decided by the unique index: the loser returns the winner', async () => {
    vi.mocked(prepRunRepository.findByIdempotencyKey).mockResolvedValueOnce(null).mockResolvedValueOnce(runRow());
    vi.mocked(prepRunRepository.create).mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    const r = await recordService.record(attendant, body);
    expect(r.replayed).toBe(true);
    expect(r.run.id).toBe('run-1');
  });

  it('404s an unknown or non-prepped output, 409s a retired one, 404s an unknown ingredient, 409s a retired one', async () => {
    vi.mocked(prepRunRepository.findItems).mockResolvedValue([]);
    await expect(recordService.record(attendant, body)).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(prepRunRepository.findItems).mockResolvedValue([item(OUT, 'M', 'RAW_INGREDIENT', 0)] as never);
    await expect(recordService.record(attendant, body)).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(prepRunRepository.findItems).mockResolvedValue([item(OUT, 'M', 'PREPPED', 0, new Date())] as never);
    await expect(recordService.record(attendant, body)).rejects.toMatchObject({ statusCode: 409 });
    vi.mocked(prepRunRepository.findItems).mockResolvedValue([item(OUT, 'M', 'PREPPED', 0), item(CHICKEN, 'chicken', 'RAW_INGREDIENT', 1)] as never);
    await expect(recordService.record(attendant, body)).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(prepRunRepository.findItems).mockResolvedValue([item(OUT, 'M', 'PREPPED', 0), item(CHICKEN, 'chicken', 'RAW_INGREDIENT', 1, new Date()), item(PASTE, 'paste', 'RAW_INGREDIENT', 1)] as never);
    await expect(recordService.record(attendant, body)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('answers 422 for the contract codes', async () => {
    await expect(recordService.record(attendant, { ...body, inputs: [{ itemId: OUT, quantity: '1' }] })).rejects.toMatchObject({ statusCode: 422, code: 'INPUT_IS_OUTPUT' });
    await expect(recordService.record(attendant, { ...body, inputs: [body.inputs[0]!, body.inputs[0]!] })).rejects.toMatchObject({ code: 'DUPLICATE_INPUT_LINE' });
    await expect(recordService.record(attendant, { ...body, made: '0' })).rejects.toMatchObject({ code: 'QUANTITY_NOT_POSITIVE' });
  });

  it('refuses a branch Attendant (hub only)', async () => {
    await expect(recordService.record(branchAttendant, body)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('outputs and prep-again', () => {
  beforeEach(() => {
    vi.mocked(prepRecipeReader.readCurrentForItems).mockResolvedValue(new Map([[OUT, recipe as never]]));
    vi.mocked(prepRunRepository.recordedYieldsSince).mockResolvedValue([]);
    vi.mocked(prepRunRepository.latestRecordedByOutput).mockResolvedValue([
      { outputItemId: OUT, actualYield: D(38), inputLines: [{ inputItemId: CHICKEN, quantity: D(10), inputItem: { name: 'chicken', usageUnit: 'kg' } }, { inputItemId: PASTE, quantity: D(1), inputItem: { name: 'paste', usageUnit: 'kg' } }] },
    ] as never);
  });

  it('lists every live prepped item with its usual figure and last run', async () => {
    vi.mocked(prepRunRepository.findLiveOutputs).mockResolvedValue([{ id: OUT, name: 'Marinated chicken', usageUnit: 'portions' }, { id: 'o2', name: 'Soup', usageUnit: 'L' }]);
    const r = await recordService.outputs(attendant);
    expect(r.items[0]).toMatchObject({ itemId: OUT, hasRecipe: true, expectedText: 'about 38 portions', lastRun: { made: '38' } });
    expect(r.items[1]).toMatchObject({ itemId: 'o2', hasRecipe: false, expectedText: null, lastRun: null });
  });

  it('tops the tiles up from all time and spells out the ingredients', async () => {
    vi.mocked(prepRunRepository.mostMadeSince).mockResolvedValue([OUT]);
    vi.mocked(prepRunRepository.mostRecentOutputs).mockResolvedValue([]);
    const r = await recordService.prepAgain(attendant);
    expect(prepRunRepository.mostRecentOutputs).toHaveBeenCalledWith(HUB, [OUT], 2);
    expect(r.tiles).toEqual([{ itemId: OUT, name: 'Marinated chicken', ingredientsText: '10 kg chicken · 1 kg paste', expectedText: 'about 38 portions', lastRun: expect.anything() }]);
  });
});
