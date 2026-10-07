import { Prisma, type UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { LEDGER_RULES, reversedPrepQuantity, signedQuantity } from '../../stock/ledger/ledger-rules';
import { postStockMovement, type PostStockMovementInput } from '../../stock/ledger/ledger-door';
import { prepRecipeReader } from '../_shared/prep-recipe-reader';
import { prepRunRepository, type PrepRunRow } from '../_shared/prep-run-repository';
import { serializeRunDetail } from '../_shared/prep-run-serializer';
import { recordRepository } from '../record/record-repository';
import { assertCanFix, fixService } from './fix-service';
import { fixRepository } from './fix-repository';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ tx: true })) } }));
vi.mock('../../_shared/reference-counter', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../../stock/ledger/ledger-door', () => ({ postStockMovement: vi.fn() }));
vi.mock('../record/record-repository', () => ({ recordRepository: { findCentralStore: vi.fn(), onHandByItem: vi.fn() } }));
vi.mock('./fix-repository', () => ({ fixRepository: { netEffectByItem: vi.fn() } }));
vi.mock('../_shared/prep-recipe-reader', () => ({ prepRecipeReader: { readCurrent: vi.fn(), readCurrentForItems: vi.fn() } }));
vi.mock('../_shared/prep-run-repository', () => ({
  prepRunRepository: {
    findById: vi.fn(),
    findItems: vi.fn(),
    findByIdempotencyKey: vi.fn(),
    recentRecordedYields: vi.fn(),
    recordedRunsBetween: vi.fn(),
    lockForFix: vi.fn(),
    findReversibleRows: vi.fn(),
    latestRecordedRunId: vi.fn(),
    closeRun: vi.fn(),
    createReplacement: vi.fn(),
    setItemCurrentCost: vi.fn(),
  },
}));

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const HUB = 'hub-1';
const OUT = '33333333-3333-4333-8333-333333333333';
const CHICKEN = '44444444-4444-4444-8444-444444444444';
const PASTE = '55555555-5555-4555-8555-555555555555';
const KEY = '66666666-6666-4666-8666-666666666666';
const HOUR = 3_600_000;
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const otherAttendant = { id: 'att-2', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const manager = { id: 'sm', role: 'STORE_MANAGER', siteId: HUB } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;

const item = (id: string, name: string, type: 'PREPPED' | 'RAW_INGREDIENT', cost: number) =>
  ({ id, name, type, usageUnit: type === 'PREPPED' ? 'portions' : 'kg', currentCost: D(cost), deletedAt: null });

const recipe = {
  versionId: 'v1',
  version: 1,
  targetYield: D(38),
  lines: [
    { inputItemId: CHICKEN, itemName: 'chicken', unit: 'kg', amount: D(10), isMain: true },
    { inputItemId: PASTE, itemName: 'paste', unit: 'kg', amount: D(1), isMain: false },
  ],
};

const user = (id: string, name: string, role: UserRole) => ({ id, name, role });
const line = (id: string, itemId: string, name: string, qty: number, cost: number, order: number) => ({
  id, prepRunId: 'run-1', inputItemId: itemId, quantity: D(qty), unitCostAtRunTime: D(cost), lineCost: D(qty * cost), lineOrder: order, onHandAtRunTime: D(50), inputItem: { id: itemId, name, usageUnit: 'kg' },
});
const runRow = (over: Partial<PrepRunRow> = {}): PrepRunRow =>
  ({
    id: 'run-1', siteId: HUB, reference: 'PREP-0001', outputItemId: OUT, actualYield: D(38), outputUnitCost: D(121), totalInputCost: D(4598),
    yieldVarianceLabel: 'normal', notifiedStoreManager: false, locationId: 'loc-1', createdById: 'att', createdAt: new Date(Date.now() - 2 * HOUR),
    status: 'RECORDED', replacesRunId: null, closedAt: null, closedById: null, correctionReason: null, cancelReason: null, reasonNote: null, yieldReason: null,
    expectedYield: D(38), expectedSource: 'RECIPE', recipeVersionId: 'v1', stockFlag: false, needsLook: false, reviewedAt: null, reviewedById: null, idempotencyKey: 'old-key',
    outputItem: { id: OUT, name: 'Marinated chicken', usageUnit: 'portions' },
    createdBy: user('att', 'Sarah Achieng', 'STORE_ATTENDANT'), closedBy: null, reviewedBy: null, replacesRun: null, replacedByRun: null, recipeVersion: { version: 1 },
    inputLines: [line('l1', CHICKEN, 'chicken', 10, 430, 0), line('l2', PASTE, 'paste', 1, 298, 1)],
    ...over,
  }) as PrepRunRow;

// The old run's three ledger rows, as the door stored them (consumes negative, produce positive).
const originals = [
  { id: 't1', type: 'PREP_CONSUME' as const, locationId: 'loc-1', inventoryItemId: CHICKEN, quantity: D(-10), unitCost: D(430) },
  { id: 't2', type: 'PREP_CONSUME' as const, locationId: 'loc-1', inventoryItemId: PASTE, quantity: D(-1), unitCost: D(298) },
  { id: 't3', type: 'PREP_PRODUCE' as const, locationId: 'loc-1', inventoryItemId: OUT, quantity: D(38), unitCost: D(121) },
];

const body = { idempotencyKey: KEY, inputs: [{ itemId: CHICKEN, quantity: '10' }, { itemId: PASTE, quantity: '1' }], made: '38', reason: 'TYPO' as const };

/** What the door would store for a call, so a test can add the ledger up. */
const storedQuantity = (input: PostStockMovementInput): Prisma.Decimal => {
  const rule = LEDGER_RULES[input.type]!;
  return input.reversesTransactionId ? reversedPrepQuantity(rule.direction, input.quantity) : signedQuantity(rule.direction, input.quantity);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(recordRepository.findCentralStore).mockResolvedValue({ id: 'loc-1', siteId: HUB });
  vi.mocked(recordRepository.onHandByItem).mockResolvedValue(new Map([[CHICKEN, D(50)], [PASTE, D(5)], [OUT, D(38)]]));
  vi.mocked(prepRunRepository.findItems).mockResolvedValue([item(OUT, 'Marinated chicken', 'PREPPED', 0), item(CHICKEN, 'chicken', 'RAW_INGREDIENT', 500), item(PASTE, 'paste', 'RAW_INGREDIENT', 298)] as never);
  vi.mocked(prepRunRepository.findByIdempotencyKey).mockResolvedValue(null);
  vi.mocked(prepRunRepository.findById).mockResolvedValue(runRow());
  vi.mocked(prepRunRepository.lockForFix).mockResolvedValue(runRow());
  vi.mocked(prepRunRepository.recentRecordedYields).mockResolvedValue([]);
  vi.mocked(prepRunRepository.recordedRunsBetween).mockResolvedValue([]);
  vi.mocked(prepRunRepository.findReversibleRows).mockResolvedValue(originals);
  vi.mocked(prepRunRepository.latestRecordedRunId).mockResolvedValue('run-1');
  vi.mocked(prepRunRepository.closeRun).mockResolvedValue(true);
  vi.mocked(prepRecipeReader.readCurrent).mockResolvedValue(recipe as never);
  vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('PREP-0002');
  vi.mocked(prepRunRepository.createReplacement).mockImplementation(async (_tx, data) =>
    runRow({
      id: 'run-2', reference: 'PREP-0002', actualYield: data.actualYield, outputUnitCost: data.outputUnitCost, totalInputCost: data.totalInputCost,
      createdById: data.createdById, needsLook: data.needsLook, replacesRunId: data.replacesRunId, correctionReason: data.correctionReason, reasonNote: data.reasonNote,
      createdBy: user(data.createdById, data.createdById === 'sm' ? 'Grace Wanjiru' : 'Sarah Achieng', data.createdById === 'sm' ? 'STORE_MANAGER' : 'STORE_ATTENDANT'),
      replacesRun: { id: 'run-1', reference: 'PREP-0001', createdAt: new Date(), actualYield: D(38), outputUnitCost: D(121), inputLines: [
        { inputItemId: CHICKEN, quantity: D(10), unitCostAtRunTime: D(430), inputItem: { name: 'chicken', usageUnit: 'kg' } },
        { inputItemId: PASTE, quantity: D(1), unitCostAtRunTime: D(298), inputItem: { name: 'paste', usageUnit: 'kg' } },
      ] },
      inputLines: data.lines.map((l, i) => ({ id: `n${i}`, prepRunId: 'run-2', inputItemId: l.inputItemId, quantity: l.quantity, unitCostAtRunTime: l.unitCostAtRunTime, lineCost: l.lineCost, lineOrder: i, onHandAtRunTime: l.onHandAtRunTime, inputItem: { id: l.inputItemId, name: l.inputItemId === CHICKEN ? 'chicken' : 'paste', usageUnit: 'kg' } })),
    }),
  );
});

describe('the window rule', () => {
  const run = (hoursAgo: number, createdById = 'att') => ({ createdById, createdAt: new Date(Date.now() - hoursAgo * HOUR) });
  const now = new Date();

  it('lets an Attendant fix their own run at 23h59', () => {
    expect(() => assertCanFix({ createdById: 'att', createdAt: new Date(now.getTime() - (24 * HOUR - 60_000)) }, { id: 'att', role: 'STORE_ATTENDANT' }, now)).not.toThrow();
  });

  it('locks it at 24h01 with "Ask the Store Manager"', () => {
    expect(() => assertCanFix({ createdById: 'att', createdAt: new Date(now.getTime() - (24 * HOUR + 60_000)) }, { id: 'att', role: 'STORE_ATTENDANT' }, now)).toThrowError(
      expect.objectContaining({ statusCode: 403, code: 'PREP_RUN_LOCKED', message: 'Ask the Store Manager' }),
    );
  });

  it("locks someone else's run at any age", () => {
    expect(() => assertCanFix(run(1), { id: 'att-2', role: 'STORE_ATTENDANT' }, now)).toThrowError(expect.objectContaining({ code: 'PREP_RUN_LOCKED' }));
  });

  it('lets a Store Manager (prep.fix_any) fix any run of any age', () => {
    expect(() => assertCanFix(run(24 * 40, 'someone'), { id: 'sm', role: 'STORE_MANAGER' }, now)).not.toThrow();
  });
});

describe('correct', () => {
  it('reverses every row of the old run (same type, opposite sign) and the ledger nets to zero per original', async () => {
    await fixService.correct(attendant, 'run-1', body);
    const posts = vi.mocked(postStockMovement).mock.calls.map((c) => c[1]);
    const reversals = posts.filter((p) => p.reversesTransactionId);
    expect(reversals.map((p) => p.reversesTransactionId)).toEqual(['t1', 't2', 't3']);
    expect(reversals.map((p) => p.type)).toEqual(['PREP_CONSUME', 'PREP_CONSUME', 'PREP_PRODUCE']);
    expect(reversals.every((p) => p.quantity.isPositive() && p.links.prepRecordId === 'run-1')).toBe(true);
    for (const original of originals) {
      const reversal = reversals.find((p) => p.reversesTransactionId === original.id)!;
      expect(original.quantity.plus(storedQuantity(reversal)).isZero()).toBe(true);
    }
  });

  it('then posts the new consume and produce rows for the new run', async () => {
    await fixService.correct(attendant, 'run-1', { ...body, made: '40' });
    const fresh = vi.mocked(postStockMovement).mock.calls.map((c) => c[1]).filter((p) => !p.reversesTransactionId);
    expect(fresh.map((p) => p.type)).toEqual(['PREP_CONSUME', 'PREP_CONSUME', 'PREP_PRODUCE']);
    expect(fresh.every((p) => p.links.prepRecordId === 'run-2')).toBe(true);
    expect(fresh[2]?.quantity.toString()).toBe('40');
  });

  it('closes the old run as CORRECTED and creates the new one with replacesRunId, reason and a fresh number', async () => {
    const r = await fixService.correct(attendant, 'run-1', body);
    expect(vi.mocked(prepRunRepository.closeRun).mock.calls[0]![3]).toMatchObject({ status: 'CORRECTED', closedById: 'att' });
    expect(vi.mocked(prepRunRepository.createReplacement).mock.calls[0]![1]).toMatchObject({ reference: 'PREP-0002', replacesRunId: 'run-1', correctionReason: 'TYPO', idempotencyKey: KEY });
    expect(referenceCounterRepository.nextReference).toHaveBeenCalledWith(expect.anything(), HUB, 'PREP');
    expect(r.replayed).toBe(false);
    expect(r.run).toMatchObject({ id: 'run-2', isCorrection: true, status: 'RECORDED' });
  });

  it('keeps the original unit cost for an item it already used and snapshots the current cost for an added one', async () => {
    const extra = '77777777-7777-4777-8777-777777777777';
    vi.mocked(prepRunRepository.findItems).mockResolvedValue([item(OUT, 'Marinated chicken', 'PREPPED', 0), item(CHICKEN, 'chicken', 'RAW_INGREDIENT', 500), item(PASTE, 'paste', 'RAW_INGREDIENT', 298), item(extra, 'salt', 'RAW_INGREDIENT', 20)] as never);
    await fixService.correct(manager, 'run-1', { ...body, inputs: [...body.inputs, { itemId: extra, quantity: '2' }] });
    const lines = vi.mocked(prepRunRepository.createReplacement).mock.calls[0]![1].lines;
    expect(lines.map((l) => l.unitCostAtRunTime.toString())).toEqual(['430', '298', '20']);
  });

  it('moves the output cost only when the fixed run is the latest recorded run of that output', async () => {
    await fixService.correct(manager, 'run-1', body);
    expect(prepRunRepository.setItemCurrentCost).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
    vi.mocked(prepRunRepository.latestRecordedRunId).mockResolvedValue('run-9');
    await fixService.correct(manager, 'run-1', body);
    expect(prepRunRepository.setItemCurrentCost).not.toHaveBeenCalled();
  });

  it("sends an Attendant's correction to Needs a look and not a clean Manager's", async () => {
    await fixService.correct(attendant, 'run-1', body);
    expect(vi.mocked(prepRunRepository.createReplacement).mock.calls[0]![1].needsLook).toBe(true);
    await fixService.correct(manager, 'run-1', { ...body, idempotencyKey: '88888888-8888-4888-8888-888888888888' });
    expect(vi.mocked(prepRunRepository.createReplacement).mock.calls[1]![1].needsLook).toBe(false);
  });

  it("flags a manager's correction that is itself off target", async () => {
    await fixService.correct(manager, 'run-1', { ...body, made: '20' });
    expect(vi.mocked(prepRunRepository.createReplacement).mock.calls[0]![1].needsLook).toBe(true);
  });

  it('replays a used key as 200 and writes nothing', async () => {
    vi.mocked(prepRunRepository.findByIdempotencyKey).mockResolvedValue(runRow({ id: 'run-2', reference: 'PREP-0002', replacesRunId: 'run-1', correctionReason: 'TYPO' }));
    const r = await fixService.correct(attendant, 'run-1', body);
    expect(r.replayed).toBe(true);
    expect(postStockMovement).not.toHaveBeenCalled();
    expect(prepRunRepository.createReplacement).not.toHaveBeenCalled();
  });

  it('refuses a run that is no longer open with RUN_NOT_OPEN', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(runRow({ status: 'CANCELLED' }));
    await expect(fixService.correct(manager, 'run-1', body)).rejects.toMatchObject({ statusCode: 409, code: 'RUN_NOT_OPEN' });
  });

  it('answers RUN_NOT_OPEN when another fixer closed it while this one waited for the lock', async () => {
    vi.mocked(prepRunRepository.lockForFix).mockResolvedValue(runRow({ status: 'CORRECTED' }));
    await expect(fixService.correct(manager, 'run-1', body)).rejects.toMatchObject({ code: 'RUN_NOT_OPEN' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it("locks an Attendant out of someone else's run and of their own after 24 hours", async () => {
    await expect(fixService.correct(otherAttendant, 'run-1', body)).rejects.toMatchObject({ statusCode: 403, code: 'PREP_RUN_LOCKED' });
    vi.mocked(prepRunRepository.findById).mockResolvedValue(runRow({ createdAt: new Date(Date.now() - 25 * HOUR) }));
    await expect(fixService.correct(attendant, 'run-1', body)).rejects.toMatchObject({ code: 'PREP_RUN_LOCKED' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('lets a Store Manager correct a 25-hour-old run', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(runRow({ createdAt: new Date(Date.now() - 25 * HOUR) }));
    await expect(fixService.correct(manager, 'run-1', body)).resolves.toMatchObject({ replayed: false });
  });

  it('404s a run that is not in this site', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(null);
    await expect(fixService.correct(manager, 'run-1', body)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a zero amount with QUANTITY_NOT_POSITIVE and an ingredient that is the output with INPUT_IS_OUTPUT', async () => {
    await expect(fixService.correct(manager, 'run-1', { ...body, made: '0' })).rejects.toMatchObject({ statusCode: 422, code: 'QUANTITY_NOT_POSITIVE' });
    await expect(fixService.correct(manager, 'run-1', { ...body, inputs: [{ itemId: OUT, quantity: '1' }] })).rejects.toMatchObject({ code: 'INPUT_IS_OUTPUT' });
  });
});

describe('the correction payload per role', () => {
  const corrected = async (actor: never, made = '40') => (await fixService.correct(actor, 'run-1', { ...body, made, inputs: [{ itemId: CHICKEN, quantity: '12' }, { itemId: PASTE, quantity: '1' }] })).run;

  it('shows the manager what changed with costs, and the unit cost before and after', async () => {
    const run = await corrected(manager);
    expect(run.correction).toMatchObject({ reason: 'TYPO', by: { name: 'Grace Wanjiru' } });
    expect(run.correction?.changed).toEqual([
      { itemName: 'Marinated chicken', was: '38', now: '40', unit: 'portions' },
      { itemName: 'chicken', was: '10', now: '12', unit: 'kg', costNow: '5160' },
    ]);
    expect(run.correction?.unitCostBefore).toBe('121');
    expect(run.correction?.unitCostAfter).toBeDefined();
    expect(run.replaces).toMatchObject({ reference: 'PREP-0001' });
    expect(run.timeline[0]?.text).toBe('Recorded as PREP-0002, correcting PREP-0001 · Grace Wanjiru');
  });

  it('gives the Attendant the same changes without any cost or flag', async () => {
    const run = await corrected(attendant);
    expect(run.correction?.changed.every((row) => !('costNow' in row))).toBe(true);
    expect(run.correction).not.toHaveProperty('unitCostBefore');
    expect(run).not.toHaveProperty('needsLook');
    expect(run).not.toHaveProperty('flags');
    expect(run).not.toHaveProperty('totalInputCost');
  });

  it('shows a dropped ingredient as now = null and an added one as was = null', async () => {
    const run = (await fixService.correct(manager, 'run-1', { ...body, inputs: [{ itemId: CHICKEN, quantity: '10' }] })).run;
    expect(run.correction?.changed).toEqual([{ itemName: 'paste', was: '1', now: null, unit: 'kg' }]);
  });

  it("shows the corrected run's note as the correction note, not the yield note", async () => {
    const run = (await fixService.correct(manager, 'run-1', { ...body, reason: 'OTHER', reasonNote: 'Scale was off' })).run;
    expect(run.correction).toMatchObject({ reason: 'OTHER', note: 'Scale was off' });
    expect(run.yieldReasonNote).toBeNull();
  });
});

describe('cancel', () => {
  const cancelled = (over: Partial<PrepRunRow> = {}) => runRow({ status: 'CANCELLED', cancelReason: 'ENTERED_TWICE', closedAt: new Date(), closedById: 'att', closedBy: user('att', 'Sarah Achieng', 'STORE_ATTENDANT'), ...over });

  it('reverses every row, marks the run CANCELLED with its reason, and leaves the output cost alone', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValueOnce(runRow()).mockResolvedValueOnce(cancelled());
    const run = await fixService.cancel(attendant, 'run-1', { reason: 'ENTERED_TWICE' });
    expect(vi.mocked(prepRunRepository.closeRun).mock.calls[0]![3]).toMatchObject({ status: 'CANCELLED', cancelReason: 'ENTERED_TWICE' });
    const posts = vi.mocked(postStockMovement).mock.calls.map((c) => c[1]);
    expect(posts.map((p) => p.reversesTransactionId)).toEqual(['t1', 't2', 't3']);
    for (const original of originals) {
      expect(original.quantity.plus(storedQuantity(posts.find((p) => p.reversesTransactionId === original.id)!)).isZero()).toBe(true);
    }
    expect(prepRunRepository.setItemCurrentCost).not.toHaveBeenCalled();
    expect(prepRunRepository.createReplacement).not.toHaveBeenCalled();
    expect(run.cancellation).toMatchObject({ reason: 'ENTERED_TWICE', by: { name: 'Sarah Achieng' } });
    expect(run.timeline.at(-1)?.text).toBe('Cancelled · Sarah Achieng');
    expect(run.can).toMatchObject({ correct: false, cancel: false });
  });

  it('a repeat is RUN_NOT_OPEN', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(cancelled());
    await expect(fixService.cancel(manager, 'run-1', { reason: 'ENTERED_TWICE' })).rejects.toMatchObject({ statusCode: 409, code: 'RUN_NOT_OPEN' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it("locks an Attendant out of another person's run", async () => {
    await expect(fixService.cancel(otherAttendant, 'run-1', { reason: 'NEVER_MADE' })).rejects.toMatchObject({ code: 'PREP_RUN_LOCKED' });
  });
});

describe('cancel preview', () => {
  it('says which items would drop below zero', async () => {
    // The chicken has been used since: only 4 kg on hand, and the 38 portions went out in sales.
    vi.mocked(recordRepository.onHandByItem).mockResolvedValue(new Map([[CHICKEN, D(4)], [PASTE, D(5)], [OUT, D(30)]]));
    vi.mocked(fixRepository.netEffectByItem).mockResolvedValue(new Map([[CHICKEN, D(-10)], [PASTE, D(-1)], [OUT, D(38)]]));
    const { items } = await fixService.cancelPreview(manager, 'run-1');
    expect(items).toEqual([
      { itemId: CHICKEN, itemName: 'chicken', unit: 'kg', onHandNow: '4', onHandAfter: '14', belowZero: false },
      { itemId: PASTE, itemName: 'paste', unit: 'kg', onHandNow: '5', onHandAfter: '6', belowZero: false },
      { itemId: OUT, itemName: 'Marinated chicken', unit: 'portions', onHandNow: '30', onHandAfter: '-8', belowZero: true },
    ]);
  });

  it('writes nothing, and refuses a run that is closed', async () => {
    vi.mocked(fixRepository.netEffectByItem).mockResolvedValue(new Map());
    await fixService.cancelPreview(accountant, 'run-1');
    expect(postStockMovement).not.toHaveBeenCalled();
    vi.mocked(prepRunRepository.findById).mockResolvedValue(runRow({ status: 'CANCELLED' }));
    await expect(fixService.cancelPreview(manager, 'run-1')).rejects.toMatchObject({ code: 'RUN_NOT_OPEN' });
  });
});

describe('serializeRunDetail can-fix flags', () => {
  it('gives the Attendant the window end for their own open run and the locked reason after it', () => {
    const inside = serializeRunDetail(runRow(), { id: 'att', role: 'STORE_ATTENDANT' } as never);
    expect(inside.can.correct).toBe(true);
    expect(inside.windowEndsAt).not.toBeNull();
    const after = serializeRunDetail(runRow({ createdAt: new Date(Date.now() - 25 * HOUR) }), { id: 'att', role: 'STORE_ATTENDANT' } as never);
    expect(after.can).toMatchObject({ correct: false, lockedReason: 'Ask the Store Manager' });
    expect(after.windowEndsAt).toBeNull();
  });
});
