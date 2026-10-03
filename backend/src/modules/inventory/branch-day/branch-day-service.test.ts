/**
 * Branch day close rules (Milestone Six, Session 3 — plan §1.4, §2.3, §4.5):
 * BLOCKED derived from in-transit dispatches, snapshot at save, reason
 * required against the branch threshold, close preconditions, one ADJ-numbered
 * ADJUSTMENT per non-zero gap in one transaction, re-close reversal (linked,
 * equal and opposite, never reversed twice), reopen authority, role walls,
 * Director push only after commit.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { branchDayService } from './branch-day-service';
import { branchDayRepository } from './branch-day-repository';
import { referenceCounterRepository } from '../purchasing/receiving-repository';
import { thresholdsRepository } from '../counting/thresholds-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { fcmService } from '../../../services/fcm-service';
import { comparePin } from '../../../utils/password';

const D = (n: number | string) => new Prisma.Decimal(n);

const order: string[] = [];
const tx = { branchDayLine: { count: vi.fn() } };

vi.mock('./branch-day-repository', () => ({
  branchDayRepository: {
    findByDate: vi.fn(),
    findById: vi.fn(),
    departmentLocations: vi.fn(),
    createDay: vi.fn(),
    departmentItems: vi.fn(),
    itemsByIds: vi.fn(),
    onHandExcludingDay: vi.fn(),
    latestInboundCosts: vi.fn(),
    inTransitDispatches: vi.fn(),
    upsertLines: vi.fn(),
    setDepartmentStatus: vi.fn(),
    activeAdjustments: vi.fn(),
    writeAdjustment: vi.fn(),
    closeDay: vi.fn(),
    reopenDay: vi.fn(),
    openingsForDate: vi.fn(),
  },
}));
vi.mock('../purchasing/receiving-repository', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../counting/thresholds-repository', () => ({ thresholdsRepository: { findBySite: vi.fn() } }));
vi.mock('../../../repositories/auth-repository', () => ({ authRepository: { findUserByIdWithPassword: vi.fn() } }));
vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn(), findById: vi.fn() } }));
vi.mock('../../../utils/password', () => ({ comparePin: vi.fn() }));
vi.mock('../../../services/fcm-service', () => ({ fcmService: { sendBranchDayDirectorAlertPush: vi.fn() } }));
vi.mock('../../../config/database', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => {
      order.push('tx:start');
      const result = await fn(tx);
      order.push('tx:commit');
      return result;
    }),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const otherBranchOrgId = '99999999-9999-4999-8999-999999999999';
const dayId = '33333333-3333-4333-8333-333333333333';
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const manager = { id: 'bm1', role: 'MANAGER' as const, siteId: branchOrgId, isDepartmentHead: false };
const deptHead = { ...manager, id: 'dh1', isDepartmentHead: true };
const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, siteId: hubOrgId };
const director = { id: 'dir1', role: 'DIRECTOR' as const, siteId: null };

const items = [
  { id: uid(1), name: 'Rice', usageUnit: 'kg', currentCost: D(100) },
  { id: uid(2), name: 'Chicken', usageUnit: 'pcs', currentCost: D(200) },
];

const savedLine = (n: number, over: Record<string, unknown> = {}) => ({
  id: uid(100 + n),
  branchDayDepartmentId: 'dept-kitchen',
  inventoryItemId: uid(n),
  countedQty: D(0),
  expectedQty: D(0),
  unitCost: items[n - 1]!.currentCost,
  reason: null,
  reasonNote: null,
  reasonRequired: false,
  ...over,
});

const department = (tag: string, lines: ReturnType<typeof savedLine>[] = [], over: Record<string, unknown> = {}) => ({
  id: `dept-${tag.toLowerCase()}`,
  branchDayId: dayId,
  departmentTag: tag,
  locationId: `loc-${tag.toLowerCase()}`,
  status: 'NOT_STARTED',
  countedById: null,
  countedAt: null,
  countedBy: null,
  lines,
  ...over,
});

const TAGS = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

const day = (over: Record<string, unknown> = {}, departments = TAGS.map((t) => department(t))) => ({
  id: dayId,
  siteId: branchOrgId,
  businessDate: new Date('2026-09-30T00:00:00Z'),
  status: 'OPEN',
  reference: 'DAY-0001',
  closedById: null,
  closedAt: null,
  closedBy: null,
  reopenCount: 0,
  createdAt: new Date('2026-09-30T03:00:00Z'),
  site: { id: branchOrgId, name: 'Nyeri Town', address: 'Kimathi Way', city: 'Nyeri', phone: '+254712000000' },
  departments,
  reopens: [],
  ...over,
});

/** Every department fully counted with no gaps — the base for "ready to close" tests. */
const countedDepartments = (kitchenLines: ReturnType<typeof savedLine>[]) =>
  TAGS.map((t) => (t === 'KITCHEN' ? department(t, kitchenLines) : department(t, [])));

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(thresholdsRepository.findBySite).mockResolvedValue(null); // defaults: branch 1,000 / Director 5,000
  vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ name: 'Peter Njoroge', pinHash: 'h' } as never);
  vi.mocked(comparePin).mockResolvedValue(true);
  vi.mocked(branchDayRepository.inTransitDispatches).mockResolvedValue([]);
  vi.mocked(branchDayRepository.findByDate).mockResolvedValue(null);
  // Kitchen counts two items; every other department has none (auto-counted, Q-D).
  vi.mocked(branchDayRepository.departmentItems).mockImplementation(async (_hub, _org, locationId) =>
    locationId === 'loc-kitchen' ? items : [],
  );
  vi.mocked(branchDayRepository.itemsByIds).mockResolvedValue([]);
  vi.mocked(branchDayRepository.onHandExcludingDay).mockResolvedValue(new Map([[uid(1), D(18)], [uid(2), D(14)]]));
  vi.mocked(branchDayRepository.latestInboundCosts).mockResolvedValue(new Map());
  vi.mocked(branchDayRepository.activeAdjustments).mockResolvedValue([]);
  vi.mocked(branchDayRepository.openingsForDate).mockResolvedValue([]); // no accepted opening the next morning
  tx.branchDayLine.count.mockResolvedValue(0);
  let ref = 3400;
  vi.mocked(referenceCounterRepository.nextReference).mockImplementation(async (_tx, _org, prefix) => `${prefix}-${++ref}`);
  vi.mocked(fcmService.sendBranchDayDirectorAlertPush).mockImplementation(async () => {
    order.push('push:director');
  });
});

describe('role walls', () => {
  it.each([
    ['store manager', storeManager],
    ['department head', deptHead],
  ])('%s cannot work the branch day', async (_label, actor) => {
    await expect(branchDayService.getToday(actor as never)).rejects.toMatchObject({ statusCode: 403 });
    await expect(branchDayService.close(actor as never, dayId, { pin: '1234' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a manager cannot reach another branch — the day lookup is scoped to their own org', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(null);
    await expect(branchDayService.getDepartment(manager as never, dayId, 'KITCHEN')).rejects.toMatchObject({ statusCode: 404 });
    expect(branchDayRepository.findById).toHaveBeenCalledWith(dayId, branchOrgId);
  });
});

describe('getToday', () => {
  it('derives BLOCKED from an in-transit dispatch, COUNTING from partial counts, and lists what stops the close', async () => {
    vi.mocked(branchDayRepository.findByDate).mockResolvedValue(
      day({}, [
        department('KITCHEN', [savedLine(1, { countedQty: D(18), expectedQty: D(18) })]), // 1 of 2 → counting
        department('PASTRY'),
        department('BARISTA'),
        department('SERVICE'),
        department('HOUSEKEEPING'),
      ]) as never,
    );
    vi.mocked(branchDayRepository.inTransitDispatches).mockResolvedValue([
      { id: uid(900), departmentTag: 'BARISTA', sequenceLabel: 'Dispatch 2 · Nyeri Town · 30 Sep' },
    ] as never);

    const today = await branchDayService.getToday(manager as never);
    const status = Object.fromEntries(today.departments.map((d) => [d.tag, d.status]));
    expect(status).toEqual({ KITCHEN: 'COUNTING', PASTRY: 'COUNTED', BARISTA: 'BLOCKED', SERVICE: 'COUNTED', HOUSEKEEPING: 'COUNTED' });
    expect(today.canClose).toBe(false);
    expect(today.closeBlockers.map((b) => b.code).sort()).toEqual(['BLOCKED', 'NOT_COUNTED']);
    expect(today.closeBlockers.find((b) => b.code === 'BLOCKED')!.message).toContain('Dispatch 2');
  });

  it('creates today lazily with a DAY- reference when none exists', async () => {
    vi.mocked(branchDayRepository.findByDate).mockResolvedValueOnce(null).mockResolvedValue(day() as never);
    vi.mocked(branchDayRepository.departmentLocations).mockResolvedValue(
      TAGS.map((t) => ({ id: `loc-${t.toLowerCase()}`, departmentTag: t, name: t })) as never,
    );
    await branchDayService.getToday(manager as never);
    expect(referenceCounterRepository.nextReference).toHaveBeenCalledWith(expect.anything(), branchOrgId, 'DAY');
    expect(branchDayRepository.createDay).toHaveBeenCalledOnce();
  });
});

describe('saveLines', () => {
  beforeEach(() => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day() as never);
  });

  it('snapshots expected and cost, and stores reasonRequired against the branch threshold', async () => {
    // Chicken: 14 expected × KES 200; counted 9 → −5 × 200 = 1,000 → at the 1,000 default → reason required.
    await branchDayService.saveLines(manager as never, dayId, 'KITCHEN', {
      lines: [
        { inventoryItemId: uid(1), countedQty: '18' },
        { inventoryItemId: uid(2), countedQty: '9', reason: 'UNLOGGED_WASTE' },
      ],
    });
    const writes = vi.mocked(branchDayRepository.upsertLines).mock.calls[0]![2];
    const rice = writes.find((w) => w.inventoryItemId === uid(1))!;
    const chicken = writes.find((w) => w.inventoryItemId === uid(2))!;
    expect(rice.expectedQty.toString()).toBe('18');
    expect(rice.reasonRequired).toBe(false);
    expect(chicken.expectedQty.toString()).toBe('14');
    expect(chicken.reasonRequired).toBe(true);
    expect(chicken.reason).toBe('UNLOGGED_WASTE');
  });

  it('drops a reason on a line that does not need one, so stale reasons never linger', async () => {
    await branchDayService.saveLines(manager as never, dayId, 'KITCHEN', {
      lines: [{ inventoryItemId: uid(1), countedQty: '17', reason: 'CONSUMPTION' }], // −1 × 100 = 100 < 1,000
    });
    const [write] = vi.mocked(branchDayRepository.upsertLines).mock.calls[0]![2];
    expect(write!.reasonRequired).toBe(false);
    expect(write!.reason).toBeNull();
  });

  it('judges against the branch threshold in force, not the default', async () => {
    vi.mocked(thresholdsRepository.findBySite).mockResolvedValue({ reasonRequiredKes: 50, overnightAlertKes: 500, directorAlertKes: null } as never);
    await branchDayService.saveLines(manager as never, dayId, 'KITCHEN', { lines: [{ inventoryItemId: uid(1), countedQty: '17' }] });
    expect(vi.mocked(branchDayRepository.upsertLines).mock.calls[0]![2][0]!.reasonRequired).toBe(true);
  });

  it('skips an untouched, uncounted item and keeps the snapshot of a cleared count', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(
      day({}, countedDepartments([savedLine(1, { countedQty: D(17), expectedQty: D(18) })])) as never,
    );
    await branchDayService.saveLines(manager as never, dayId, 'KITCHEN', {
      lines: [
        { inventoryItemId: uid(1), countedQty: null },
        { inventoryItemId: uid(2), countedQty: null },
      ],
    });
    const writes = vi.mocked(branchDayRepository.upsertLines).mock.calls[0]![2];
    expect(writes).toHaveLength(1);
    expect(writes[0]!.countedQty).toBeNull();
    expect(writes[0]!.expectedQty.toString()).toBe('18');
  });

  it('marks the department COUNTED only when every item has a count', async () => {
    tx.branchDayLine.count.mockResolvedValue(2);
    await branchDayService.saveLines(manager as never, dayId, 'KITCHEN', { lines: [{ inventoryItemId: uid(1), countedQty: '18' }] });
    expect(branchDayRepository.setDepartmentStatus).toHaveBeenCalledWith(tx, 'dept-kitchen', 'COUNTED', 'bm1', expect.any(Date));
    tx.branchDayLine.count.mockResolvedValue(1);
    await branchDayService.saveLines(manager as never, dayId, 'KITCHEN', { lines: [{ inventoryItemId: uid(1), countedQty: '18' }] });
    expect(branchDayRepository.setDepartmentStatus).toHaveBeenLastCalledWith(tx, 'dept-kitchen', 'NOT_STARTED', 'bm1', expect.any(Date));
  });

  it('rejects saves on a closed day, on a blocked department, and for items the department does not count', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ status: 'CLOSED' }) as never);
    await expect(
      branchDayService.saveLines(manager as never, dayId, 'KITCHEN', { lines: [{ inventoryItemId: uid(1), countedQty: '1' }] }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'DAY_CLOSED' });

    vi.mocked(branchDayRepository.findById).mockResolvedValue(day() as never);
    vi.mocked(branchDayRepository.inTransitDispatches).mockResolvedValue([
      { id: uid(900), departmentTag: 'KITCHEN', sequenceLabel: 'Dispatch 1 · Nyeri Town · 30 Sep' },
    ] as never);
    await expect(
      branchDayService.saveLines(manager as never, dayId, 'KITCHEN', { lines: [{ inventoryItemId: uid(1), countedQty: '1' }] }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'DEPARTMENT_BLOCKED' });

    vi.mocked(branchDayRepository.inTransitDispatches).mockResolvedValue([]);
    await expect(
      branchDayService.saveLines(manager as never, dayId, 'KITCHEN', { lines: [{ inventoryItemId: uid(77), countedQty: '1' }] }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'ITEM_NOT_IN_DEPARTMENT' });
    expect(branchDayRepository.upsertLines).not.toHaveBeenCalled();
  });
});

describe('close', () => {
  const twoCounted = () => [
    savedLine(1, { countedQty: D(18), expectedQty: D(18) }), // matches → no adjustment
    savedLine(2, { countedQty: D(9), expectedQty: D(14), reasonRequired: true, reason: 'UNLOGGED_WASTE' }), // −5 × 200 = −1,000
  ];

  it('refuses with the blocker list, before touching the PIN or the ledger', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day() as never); // kitchen uncounted
    await expect(branchDayService.close(manager as never, dayId, { pin: '1234' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'DAY_NOT_READY',
      details: { blockers: [expect.objectContaining({ code: 'NOT_COUNTED', departmentTag: 'KITCHEN' })] },
    });
    expect(comparePin).not.toHaveBeenCalled();
    expect(branchDayRepository.writeAdjustment).not.toHaveBeenCalled();
  });

  it('refuses while an above-threshold gap has no reason (and OTHER needs a note)', async () => {
    const lines = twoCounted();
    lines[1] = savedLine(2, { countedQty: D(9), expectedQty: D(14), reasonRequired: true, reason: 'OTHER', reasonNote: '  ' });
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({}, countedDepartments(lines)) as never);
    await expect(branchDayService.close(manager as never, dayId, { pin: '1234' })).rejects.toMatchObject({
      code: 'DAY_NOT_READY',
      details: { blockers: [expect.objectContaining({ code: 'REASON_REQUIRED' })] },
    });
  });

  it('a wrong PIN writes nothing', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({}, countedDepartments(twoCounted())) as never);
    vi.mocked(comparePin).mockResolvedValue(false);
    await expect(branchDayService.close(manager as never, dayId, { pin: '0000' })).rejects.toMatchObject({ statusCode: 401 });
    expect(order).not.toContain('tx:start');
  });

  it('writes one ADJ-numbered ADJUSTMENT per non-zero gap in one transaction, closes the day, then notifies after commit', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({}, countedDepartments(twoCounted())) as never);
    vi.mocked(thresholdsRepository.findBySite).mockImplementation(
      async (org) => (org === hubOrgId ? ({ reasonRequiredKes: 500, directorAlertKes: 1000 } as never) : null),
    );

    const result = await branchDayService.close(manager as never, dayId, { pin: '1234' });

    expect(branchDayRepository.writeAdjustment).toHaveBeenCalledTimes(1);
    const adj = vi.mocked(branchDayRepository.writeAdjustment).mock.calls[0]![1];
    expect(adj).toMatchObject({
      siteId: branchOrgId,
      locationId: 'loc-kitchen',
      inventoryItemId: uid(2),
      branchDayLineId: uid(102),
      reference: 'ADJ-3401',
      reason: 'Unlogged waste',
      userId: 'bm1',
    });
    expect(adj.quantity.toString()).toBe('-5');
    expect(branchDayRepository.closeDay).toHaveBeenCalledWith(tx, dayId, 'bm1', expect.any(Date));
    expect(result).toMatchObject({ status: 'CLOSED', adjustmentCount: 1, reversalCount: 0, netAdjustmentValue: '-1000', directorNotified: true });
    // Push is fire-and-forget and only after the transaction commits.
    expect(order).toEqual(['tx:start', 'tx:commit', 'push:director']);
  });

  it('does not notify the Director below the company-wide alert amount', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({}, countedDepartments(twoCounted())) as never);
    const result = await branchDayService.close(manager as never, dayId, { pin: '1234' }); // default 5,000 > 1,000
    expect(result.directorNotified).toBe(false);
    expect(fcmService.sendBranchDayDirectorAlertPush).not.toHaveBeenCalled();
  });

  it('never adjusts an uncounted line', async () => {
    // Department with no counted items but no items either → auto-counted; nothing to adjust.
    vi.mocked(branchDayRepository.departmentItems).mockResolvedValue([]);
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day() as never);
    const result = await branchDayService.close(manager as never, dayId, { pin: '1234' });
    expect(result.adjustmentCount).toBe(0);
    expect(branchDayRepository.writeAdjustment).not.toHaveBeenCalled();
  });

  it('a re-close reverses every standing adjustment with a linked, equal-and-opposite row, then writes fresh ones', async () => {
    // Reopened day: Chicken was counted 9 (gap −5) at the first close; now recounted 12 (gap −2).
    const lines = [
      savedLine(1, { countedQty: D(18), expectedQty: D(18) }),
      savedLine(2, { countedQty: D(12), expectedQty: D(14), reasonRequired: false }),
    ];
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ reopenCount: 1 }, countedDepartments(lines)) as never);
    vi.mocked(branchDayRepository.activeAdjustments).mockResolvedValue([
      {
        id: 'orig-1',
        locationId: 'loc-kitchen',
        inventoryItemId: uid(2),
        branchDayLineId: uid(102),
        quantity: D(-5),
        unitCost: D(200),
        reference: 'ADJ-3390',
      },
    ] as never);

    const result = await branchDayService.close(manager as never, dayId, { pin: '1234' });

    const writes = vi.mocked(branchDayRepository.writeAdjustment).mock.calls.map((c) => c[1]);
    expect(writes).toHaveLength(2);
    const [reversal, fresh] = writes;
    expect(reversal!.quantity.toString()).toBe('5'); // equal and opposite
    expect(reversal!.reversesTransactionId).toBe('orig-1');
    expect(reversal!.branchDayLineId).toBe(uid(102));
    expect(reversal!.reason).toContain('ADJ-3390');
    expect(fresh!.quantity.toString()).toBe('-2');
    expect(fresh!.reversesTransactionId).toBeUndefined();
    // Net of the old adjustment + its reversal is zero; only the fresh row moves stock.
    expect(D(-5).plus(reversal!.quantity).plus(fresh!.quantity).toString()).toBe('-2');
    expect(result).toMatchObject({ adjustmentCount: 1, reversalCount: 1 });
  });

  it('cannot close a day twice', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ status: 'CLOSED' }) as never);
    await expect(branchDayService.close(manager as never, dayId, { pin: '1234' })).rejects.toMatchObject({ statusCode: 409, code: 'DAY_CLOSED' });
  });
});

describe('reopen', () => {
  it('reopens a closed day and records who and why', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ status: 'CLOSED' }) as never);
    vi.mocked(branchDayRepository.reopenDay).mockResolvedValue({ reopenCount: 1 });
    const result = await branchDayService.reopen(manager as never, dayId, { reason: 'Kitchen counted against the wrong department' });
    expect(branchDayRepository.reopenDay).toHaveBeenCalledWith(tx, dayId, 'bm1', 'Kitchen counted against the wrong department');
    expect(result).toEqual({ id: dayId, status: 'OPEN', reopenCount: 1 });
    // Reopening never touches the ledger — only the next close does.
    expect(branchDayRepository.writeAdjustment).not.toHaveBeenCalled();
  });

  it('only a closed day can be reopened', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day() as never);
    await expect(branchDayService.reopen(manager as never, dayId, { reason: 'x' })).rejects.toMatchObject({ statusCode: 409, code: 'DAY_NOT_CLOSED' });
  });

  it('a Director may reopen any branch day (unscoped lookup); a manager stays scoped to their own org', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ status: 'CLOSED', siteId: otherBranchOrgId }) as never);
    vi.mocked(branchDayRepository.reopenDay).mockResolvedValue({ reopenCount: 1 });
    await branchDayService.reopen(director as never, dayId, { reason: 'Audit correction' });
    expect(branchDayRepository.findById).toHaveBeenLastCalledWith(dayId, null);
    await branchDayService.reopen(manager as never, dayId, { reason: 'Audit correction' });
    expect(branchDayRepository.findById).toHaveBeenLastCalledWith(dayId, branchOrgId);
  });
});

describe('document', () => {
  it('is only available once the day is closed', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day() as never);
    await expect(branchDayService.getDocument(manager as never, dayId)).rejects.toMatchObject({ statusCode: 409, code: 'DAY_NOT_CLOSED' });
  });

  it('summarises departments, gaps and the signer', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(
      day(
        { status: 'CLOSED', closedAt: new Date('2026-09-30T18:40:00Z'), closedBy: { id: 'bm1', name: 'Peter Njoroge' } },
        countedDepartments([
          savedLine(1, { countedQty: D(18), expectedQty: D(18) }),
          savedLine(2, { countedQty: D(9), expectedQty: D(14), reasonRequired: true, reason: 'UNLOGGED_WASTE' }),
        ]),
      ) as never,
    );
    const doc = await branchDayService.getDocument(manager as never, dayId);
    expect(doc.branchName).toBe('Nyeri Town');
    expect(doc.closedBy.name).toBe('Peter Njoroge');
    expect(doc.departments.find((d) => d.tag === 'KITCHEN')).toMatchObject({ items: 2, gaps: 1, status: 'Closed' });
    expect(doc.totals).toEqual({ items: 2, gapLines: 1, netAdjustmentValue: '-1000' });
  });
});
