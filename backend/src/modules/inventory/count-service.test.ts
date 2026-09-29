/**
 * Central Store counting rules (Milestone Six, Session 2 — plan §2.2, §4.5):
 * snapshot at submit, uncounted lines never adjusted, one ADJ-numbered
 * ADJUSTMENT per accepted non-zero variance in one transaction, reason
 * required against the *stored* threshold, send-back reopens only queried
 * lines, spot count = verified + adjustments in one step, notifications after
 * commit, role walls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countService } from './count-service';
import { countRepository } from './count-repository';
import { referenceCounterRepository } from './receiving-repository';
import { thresholdsRepository } from './thresholds-repository';
import { authRepository } from '../../repositories/auth-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { fcmService } from '../../services/fcm-service';
import { comparePin } from '../../utils/password';
import { attendant, centralStore, centralStoreId, count, countId, D, hubOrgId, line, storeManager } from './count-test-fixtures';

const order: string[] = [];
const txAdjustmentCreate = vi.fn();
const tx = { inventoryTransaction: { create: txAdjustmentCreate } };

vi.mock('./count-repository', () => ({
  countRepository: {
    listLiveCatalogItems: vi.fn(),
    listCategories: vi.fn(),
    findDaily: vi.fn(),
    findById: vi.fn(),
    createDraft: vi.fn(),
    addMissingLines: vi.fn(),
    setLineCount: vi.fn(),
    touch: vi.fn(),
    onHandByItem: vi.fn(),
    writeSnapshot: vi.fn(),
    markSubmitted: vi.fn(),
    updateLineDecision: vi.fn(),
    markReturned: vi.fn(),
    reopenQueriedLine: vi.fn(),
    markVerified: vi.fn(),
    createVerifiedSpot: vi.fn(),
    listSummaries: vi.fn(),
    todaysDaily: vi.fn(),
  },
}));
vi.mock('./receiving-repository', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('./thresholds-repository', () => ({ thresholdsRepository: { findByOrganization: vi.fn() } }));
vi.mock('../../repositories/auth-repository', () => ({ authRepository: { findUserByIdWithPassword: vi.fn() } }));
vi.mock('../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn(), findById: vi.fn() } }));
vi.mock('../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../utils/password', () => ({ comparePin: vi.fn() }));
vi.mock('../../services/fcm-service', () => ({
  fcmService: { sendCountSubmittedPush: vi.fn(), sendCountDirectorAlertPush: vi.fn() },
}));
vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => {
      order.push('tx:start');
      const result = await fn(tx);
      order.push('tx:commit');
      return result;
    }),
  },
}));

const pin = '1234';

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ name: 'Joseph Mwangi', pinHash: 'h' } as never);
  vi.mocked(comparePin).mockResolvedValue(true);
  vi.mocked(countRepository.listCategories).mockResolvedValue([]);
  vi.mocked(thresholdsRepository.findByOrganization).mockResolvedValue(null); // defaults: 500 / 5,000
  vi.mocked(countRepository.markSubmitted).mockResolvedValue(1);
  vi.mocked(countRepository.markVerified).mockResolvedValue(1);
  vi.mocked(countRepository.markReturned).mockResolvedValue(1);
  let ref = 3401;
  vi.mocked(referenceCounterRepository.nextReference).mockImplementation(async (_tx, _org, prefix) => `${prefix}-${++ref}`);
  vi.mocked(fcmService.sendCountSubmittedPush).mockImplementation(async () => {
    order.push('push:submitted');
  });
  vi.mocked(fcmService.sendCountDirectorAlertPush).mockImplementation(async () => {
    order.push('push:director');
  });
});

describe('submit (attendant sign)', () => {
  const draft = () =>
    count([
      line(1, { countedQty: D(124) }), // matches
      line(2, { countedQty: D(18), inventoryItem: { ...line(2).inventoryItem, currentCost: D(90) } }), // −9 × 90 = 810
      line(3), // uncounted
    ]);

  beforeEach(() => {
    vi.mocked(countRepository.findById).mockResolvedValue(draft());
    vi.mocked(countRepository.onHandByItem).mockResolvedValue(
      new Map([
        [line(1).inventoryItemId, D(124)],
        [line(2).inventoryItemId, D(27)],
      ]),
    );
  });

  it('snapshots expected, cost and reasonRequired on counted lines only, then notifies after commit', async () => {
    await countService.submit(attendant, countId, pin);

    const snapshots = vi.mocked(countRepository.writeSnapshot).mock.calls;
    expect(snapshots).toHaveLength(2); // the uncounted line is untouched
    const byLine = new Map(snapshots.map(([id, data]) => [id, data]));
    expect(byLine.get(line(1).id)).toMatchObject({ decision: 'ACCEPTED', reasonRequired: false });
    expect(byLine.get(line(2).id)).toMatchObject({ decision: 'PENDING', reasonRequired: true }); // 810 ≥ 500
    expect(byLine.get(line(2).id)!.expectedQty.toString()).toBe('27');
    expect(order).toEqual(['tx:start', 'tx:commit', 'push:submitted']);
  });

  it('a wrong PIN writes nothing', async () => {
    vi.mocked(comparePin).mockResolvedValue(false);
    await expect(countService.submit(attendant, countId, '0000')).rejects.toMatchObject({ statusCode: 401 });
    expect(countRepository.markSubmitted).not.toHaveBeenCalled();
    expect(fcmService.sendCountSubmittedPush).not.toHaveBeenCalled();
  });

  it('refuses an empty count and a second submit', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(count([line(1)]));
    await expect(countService.submit(attendant, countId, pin)).rejects.toMatchObject({ code: 'NOTHING_COUNTED' });

    vi.mocked(countRepository.findById).mockResolvedValue({ ...draft(), status: 'SUBMITTED' });
    await expect(countService.submit(attendant, countId, pin)).rejects.toMatchObject({ code: 'COUNT_LOCKED' });
  });

  it('a returned count needs every queried line recounted, and re-snapshots only those', async () => {
    const returned = count(
      [
        line(1, { countedQty: D(124), expectedQty: D(124), decision: 'ACCEPTED' }),
        line(2, { countedQty: null, firstCountedQty: D(18), decision: 'QUERIED' }),
      ],
      { status: 'RETURNED' },
    );
    vi.mocked(countRepository.findById).mockResolvedValue(returned);
    await expect(countService.submit(attendant, countId, pin)).rejects.toMatchObject({ code: 'RECOUNT_INCOMPLETE' });

    vi.mocked(countRepository.findById).mockResolvedValue(
      count([returned.lines[0]!, { ...returned.lines[1]!, countedQty: D(27) }], { status: 'RETURNED' }),
    );
    await countService.submit(attendant, countId, pin);
    expect(vi.mocked(countRepository.writeSnapshot).mock.calls.map(([id]) => id)).toEqual([line(2).id]);
  });

  it('the Store Manager cannot submit', async () => {
    await expect(countService.submit(storeManager as never, countId, pin)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('saveLines', () => {
  it('in RETURNED only queried lines are editable', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      count(
        [line(1, { decision: 'ACCEPTED', countedQty: D(1) }), line(2, { decision: 'QUERIED' })],
        { status: 'RETURNED' },
      ),
    );
    await expect(
      countService.saveLines(attendant, countId, { lines: [{ inventoryItemId: line(1).inventoryItemId, countedQty: '3' }] }),
    ).rejects.toMatchObject({ code: 'COUNT_LOCKED' });
    vi.mocked(countRepository.touch).mockResolvedValue(new Date('2026-09-12T04:10:00Z'));
    const saved = await countService.saveLines(attendant, countId, {
      lines: [{ inventoryItemId: line(2).inventoryItemId, countedQty: '27' }],
    });
    expect(saved).toMatchObject({ counted: 2, total: 2 });
  });
});

describe('approve', () => {
  const submitted = (lines = [
    line(1, { countedQty: D(124), expectedQty: D(124), unitCost: D(60), decision: 'ACCEPTED' }),
    line(2, { countedQty: D(18), expectedQty: D(27), unitCost: D(90), decision: 'ACCEPTED', reasonRequired: true, reason: 'SUSPECTED_LOSS' }),
    line(3, { countedQty: D(36), expectedQty: D(34), unitCost: D(110), decision: 'ACCEPTED' }),
    line(4), // uncounted
  ]) => count(lines, { status: 'SUBMITTED', counterSignedAt: new Date('2026-09-12T04:10:00Z') });

  beforeEach(() => {
    vi.mocked(countRepository.findById).mockResolvedValue(submitted());
  });

  it('writes one ADJUSTMENT per accepted non-zero variance, ADJ-numbered and linked, in one transaction', async () => {
    const result = await countService.approve(storeManager, countId, pin);

    expect(txAdjustmentCreate).toHaveBeenCalledTimes(2); // matched + uncounted write nothing
    const rows = txAdjustmentCreate.mock.calls.map(([arg]) => arg.data);
    expect(rows[0]).toMatchObject({
      type: 'ADJUSTMENT',
      stockCountLineId: line(2).id,
      reference: 'ADJ-3402',
      userId: 'sm1',
      locationId: centralStoreId,
    });
    expect(rows[0].quantity.toString()).toBe('-9');
    expect(rows[0].unitCost.toString()).toBe('90');
    expect(rows[1]).toMatchObject({ stockCountLineId: line(3).id, reference: 'ADJ-3403' });
    expect(rows[1].quantity.toString()).toBe('2');
    expect(result).toMatchObject({ adjustmentsWritten: 2, netAdjustmentValue: '-590', directorNotified: false });
    expect(countRepository.markVerified).toHaveBeenCalledTimes(1);
  });

  it('is blocked while any line is queried', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      submitted([line(1, { countedQty: D(1), expectedQty: D(2), unitCost: D(1), decision: 'QUERIED' })]),
    );
    await expect(countService.approve(storeManager, countId, pin)).rejects.toMatchObject({ statusCode: 409, code: 'QUERIED_LINES' });
    expect(txAdjustmentCreate).not.toHaveBeenCalled();
  });

  it('is blocked while a variance line is undecided', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      submitted([line(1, { countedQty: D(1), expectedQty: D(2), unitCost: D(1), decision: 'PENDING' })]),
    );
    await expect(countService.approve(storeManager, countId, pin)).rejects.toMatchObject({ code: 'LINES_UNDECIDED' });
  });

  it('REASON_REQUIRED uses the threshold stored on the line, not today\'s threshold', async () => {
    // The threshold has since been raised to KES 1,000,000 — the line was judged at 500.
    vi.mocked(thresholdsRepository.findByOrganization).mockResolvedValue({
      reasonRequiredKes: 1_000_000,
      directorAlertKes: 5000,
    } as never);
    vi.mocked(countRepository.findById).mockResolvedValue(
      submitted([
        line(2, { countedQty: D(18), expectedQty: D(27), unitCost: D(90), decision: 'ACCEPTED', reasonRequired: true, reason: null }),
      ]),
    );
    await expect(countService.approve(storeManager, countId, pin)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });

    // …and a line judged below the threshold at submit never needs one, even if the threshold is now 0.
    vi.mocked(thresholdsRepository.findByOrganization).mockResolvedValue({ reasonRequiredKes: 0, directorAlertKes: 5000 } as never);
    vi.mocked(countRepository.findById).mockResolvedValue(
      submitted([
        line(2, { countedQty: D(26), expectedQty: D(27), unitCost: D(90), decision: 'ACCEPTED', reasonRequired: false }),
      ]),
    );
    await expect(countService.approve(storeManager, countId, pin)).resolves.toMatchObject({ adjustmentsWritten: 1 });
  });

  it('"Other" without a note still counts as missing a reason', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      submitted([
        line(2, { countedQty: D(18), expectedQty: D(27), unitCost: D(90), decision: 'ACCEPTED', reasonRequired: true, reason: 'OTHER', reasonNote: '  ' }),
      ]),
    );
    await expect(countService.approve(storeManager, countId, pin)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('alerts Directors after commit when a line reaches the Director amount', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      submitted([
        line(2, { countedQty: D(0), expectedQty: D(100), unitCost: D(60), decision: 'ACCEPTED', reasonRequired: true, reason: 'SUSPECTED_LOSS' }),
      ]),
    ); // −100 × 60 = KES 6,000 ≥ 5,000
    const result = await countService.approve(storeManager, countId, pin);
    expect(result.directorNotified).toBe(true);
    expect(countRepository.markVerified).toHaveBeenCalledWith(
      countId,
      hubOrgId,
      'SUBMITTED',
      expect.objectContaining({ directorNotified: true }),
      tx,
    );
    expect(order).toEqual(['tx:start', 'tx:commit', 'push:director']);
    expect(fcmService.sendCountDirectorAlertPush).toHaveBeenCalledWith(
      expect.objectContaining({ alertLineCount: 1, largestValueKes: '6000' }),
    );
  });

  it('does not alert Directors below the amount', async () => {
    const result = await countService.approve(storeManager, countId, pin);
    expect(result.directorNotified).toBe(false);
    expect(fcmService.sendCountDirectorAlertPush).not.toHaveBeenCalled();
  });

  it('an attendant cannot verify', async () => {
    await expect(countService.approve(attendant as never, countId, pin)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a lost race (already verified) rolls back with 409', async () => {
    vi.mocked(countRepository.markVerified).mockResolvedValue(0);
    await expect(countService.approve(storeManager, countId, pin)).rejects.toMatchObject({ code: 'COUNT_LOCKED' });
    expect(txAdjustmentCreate).not.toHaveBeenCalled();
  });
});

describe('returnCount (send back)', () => {
  it('reopens only the queried lines, keeping the first figure', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      count(
        [
          line(1, { countedQty: D(124), expectedQty: D(124), decision: 'ACCEPTED' }),
          line(2, { countedQty: D(18), expectedQty: D(27), unitCost: D(90), decision: 'QUERIED' }),
        ],
        { status: 'SUBMITTED' },
      ),
    );
    await countService.returnCount(storeManager, countId, 'Just the chicken, please');
    expect(countRepository.reopenQueriedLine).toHaveBeenCalledTimes(1);
    expect(vi.mocked(countRepository.reopenQueriedLine).mock.calls[0]![0]).toBe(line(2).id);
    expect(vi.mocked(countRepository.reopenQueriedLine).mock.calls[0]![1]!.toString()).toBe('18');
  });

  it('needs at least one queried line', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      count([line(1, { countedQty: D(1), decision: 'ACCEPTED' })], { status: 'SUBMITTED' }),
    );
    await expect(countService.returnCount(storeManager, countId, 'x')).rejects.toMatchObject({ code: 'NO_QUERIED_LINES' });
  });
});

describe('decideLine', () => {
  it('only while SUBMITTED, and only on counted lines', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(count([line(1)], { status: 'RETURNED' }));
    await expect(
      countService.decideLine(storeManager, countId, line(1).id, { decision: 'QUERIED' }),
    ).rejects.toMatchObject({ code: 'COUNT_LOCKED' });

    vi.mocked(countRepository.findById).mockResolvedValue(count([line(1)], { status: 'SUBMITTED' }));
    await expect(
      countService.decideLine(storeManager, countId, line(1).id, { decision: 'ACCEPTED' }),
    ).rejects.toMatchObject({ code: 'LINE_NOT_COUNTED' });
  });

  it('a reason is stored only on an accepted line; a query note only on a queried one', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      count([line(1, { countedQty: D(1), expectedQty: D(2), unitCost: D(1) })], { status: 'SUBMITTED' }),
    );
    await countService.decideLine(storeManager, countId, line(1).id, {
      decision: 'QUERIED',
      reason: 'SUSPECTED_LOSS',
      queryNote: 'Check the back shelf',
    });
    expect(countRepository.updateLineDecision).toHaveBeenLastCalledWith(line(1).id, countId, {
      decision: 'QUERIED',
      reason: null,
      reasonNote: null,
      queryNote: 'Check the back shelf',
    });
  });
});

describe('spot count', () => {
  const items = [
    { id: line(1).inventoryItemId, name: 'Coffee beans', usageUnit: 'kg', categoryId: null, currentCost: D(800) },
    { id: line(2).inventoryItemId, name: 'Cooking oil', usageUnit: 'L', categoryId: null, currentCost: D(300) },
  ];

  beforeEach(() => {
    vi.mocked(countRepository.listLiveCatalogItems).mockResolvedValue(items);
    vi.mocked(countRepository.onHandByItem).mockResolvedValue(
      new Map([
        [items[0]!.id, D(25)],
        [items[1]!.id, D(40)],
      ]),
    );
    vi.mocked(countRepository.createVerifiedSpot).mockResolvedValue({
      id: countId,
      lines: [
        { id: line(1).id, inventoryItemId: items[0]!.id },
        { id: line(2).id, inventoryItemId: items[1]!.id },
      ],
    });
    vi.mocked(countRepository.findById).mockResolvedValue(count([], { status: 'VERIFIED', kind: 'SPOT' }));
  });

  it('is created VERIFIED and writes its adjustments in the same transaction', async () => {
    const result = await countService.createSpotCount(storeManager, {
      pin,
      lines: [
        { inventoryItemId: items[0]!.id, countedQty: '12', reason: 'SUSPECTED_LOSS' }, // −13 × 800 = 10,400 → reason + Director
        { inventoryItemId: items[1]!.id, countedQty: '40' }, // matches
      ],
    });
    expect(countRepository.createVerifiedSpot).toHaveBeenCalledTimes(1);
    expect(txAdjustmentCreate).toHaveBeenCalledTimes(1);
    expect(txAdjustmentCreate.mock.calls[0]![0].data).toMatchObject({
      type: 'ADJUSTMENT',
      stockCountLineId: line(1).id,
      reference: expect.stringMatching(/^ADJ-/),
    });
    expect(referenceCounterRepository.nextReference).toHaveBeenCalledWith(tx, hubOrgId, 'SPT');
    expect(result).toMatchObject({ adjustmentsWritten: 1, netAdjustmentValue: '-10400', directorNotified: true });
  });

  it('needs a reason on an above-threshold line and writes nothing without it', async () => {
    await expect(
      countService.createSpotCount(storeManager, { pin, lines: [{ inventoryItemId: items[0]!.id, countedQty: '12' }] }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    expect(countRepository.createVerifiedSpot).not.toHaveBeenCalled();
    expect(txAdjustmentCreate).not.toHaveBeenCalled();
  });

  it('rejects an item outside the live catalog', async () => {
    await expect(
      countService.createSpotCount(storeManager, {
        pin,
        lines: [{ inventoryItemId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', countedQty: '1' }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('an attendant cannot run a spot count', async () => {
    await expect(
      countService.createSpotCount(attendant as never, { pin, lines: [{ inventoryItemId: items[0]!.id, countedQty: '1' }] }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('org scoping', () => {
  it('a count outside the Central Store location is not found', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue({
      ...count([], { status: 'SUBMITTED' }),
      locationId: 'other-location',
    });
    await expect(countService.getForVerifier(storeManager, countId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a non-hub actor is refused', async () => {
    await expect(
      countService.getForVerifier({ ...storeManager, organizationId: 'branch-org' }, countId),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(countRepository.findById).not.toHaveBeenCalled();
  });
});
