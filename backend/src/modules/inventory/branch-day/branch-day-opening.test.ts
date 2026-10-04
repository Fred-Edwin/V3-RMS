/**
 * Day close history & next-morning opening (Milestone Six, Session 4 — plan §1.6, §2.3, Flow 12b/12c):
 * history reads saved lines only and never lists today's open day, the opening pre-fills from the ledger,
 * accept is one transaction (opening + lines + linked ADJ-numbered overnight adjustments), only the
 * department head's own department, one accept per day, push only after commit and only above the
 * threshold, and a re-close reverses and recomputes an already-accepted opening.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { branchDayService } from './branch-day-service';
import { branchDayRepository } from './branch-day-repository';
import { referenceCounterRepository } from '../_shared/reference-counter';
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
    activeAdjustments: vi.fn(),
    writeAdjustment: vi.fn(),
    closeDay: vi.fn(),
    setDepartmentStatus: vi.fn(),
    historyDays: vi.fn(),
    reopenAudit: vi.fn(),
    onHandAt: vi.fn(),
    findOpening: vi.fn(),
    createOpening: vi.fn(),
    openingsForDate: vi.fn(),
    updateOpeningLine: vi.fn(),
    activeOpeningAdjustments: vi.fn(),
  },
}));
vi.mock('../_shared/reference-counter', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../counting/thresholds-repository', () => ({ thresholdsRepository: { findBySite: vi.fn() } }));
vi.mock('../../../repositories/auth-repository', () => ({ authRepository: { findUserByIdWithPassword: vi.fn() } }));
vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn(), findById: vi.fn() } }));
vi.mock('../../../utils/password', () => ({ comparePin: vi.fn() }));
vi.mock('../../../services/fcm-service', () => ({
  fcmService: { sendBranchDayDirectorAlertPush: vi.fn(), sendOvernightVarianceAlertPush: vi.fn() },
}));
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
const dayId = '33333333-3333-4333-8333-333333333333';
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const manager = { id: 'bm1', role: 'MANAGER' as const, siteId: branchOrgId, isDepartmentHead: false };
const kitchenHead = { id: 'dh1', role: 'CHEF' as const, siteId: branchOrgId, isDepartmentHead: true, departmentTag: 'KITCHEN' as const };
const waiter = { id: 'w1', role: 'WAITER' as const, siteId: branchOrgId, isDepartmentHead: false, departmentTag: 'SERVICE' as const };

const items = [
  { id: uid(1), name: 'Rice', usageUnit: 'kg', currentCost: D(100) },
  { id: uid(2), name: 'Chicken', usageUnit: 'pcs', currentCost: D(200) },
];

const TAGS = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

const department = (tag: string, lines: unknown[] = [], over: Record<string, unknown> = {}) => ({
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

const day = (over: Record<string, unknown> = {}, departments = TAGS.map((t) => department(t))) => ({
  id: dayId,
  siteId: branchOrgId,
  businessDate: new Date('2026-09-30T00:00:00Z'),
  status: 'OPEN',
  reference: 'DAY-0002',
  closedById: null,
  closedAt: null,
  closedBy: null,
  reopenCount: 0,
  createdAt: new Date('2026-09-30T03:00:00Z'),
  site: { id: branchOrgId, name: 'Nyeri Town', address: 'Kimathi Way', city: 'Nyeri', phone: null },
  departments,
  reopens: [],
  ...over,
});

const createdOpening = (lines: { inventoryItemId: string }[]) => ({
  id: uid(950),
  lines: lines.map((l, i) => ({ id: `ol-${i + 1}`, inventoryItemId: l.inventoryItemId })),
});

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(thresholdsRepository.findBySite).mockResolvedValue(null); // branch overnight alert defaults to KES 500
  vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ name: 'Peter Njoroge', pinHash: 'h' } as never);
  vi.mocked(comparePin).mockResolvedValue(true);
  vi.mocked(branchDayRepository.inTransitDispatches).mockResolvedValue([]);
  vi.mocked(branchDayRepository.findByDate).mockResolvedValue(day() as never);
  vi.mocked(branchDayRepository.departmentItems).mockImplementation(async (_h, _o, locationId) => (locationId === 'loc-kitchen' ? items : []));
  vi.mocked(branchDayRepository.itemsByIds).mockResolvedValue(items);
  vi.mocked(branchDayRepository.latestInboundCosts).mockResolvedValue(new Map());
  vi.mocked(branchDayRepository.onHandAt).mockResolvedValue(new Map([[uid(1), D(18)], [uid(2), D(9)]]));
  vi.mocked(branchDayRepository.findOpening).mockResolvedValue(null);
  vi.mocked(branchDayRepository.onHandExcludingDay).mockResolvedValue(new Map());
  vi.mocked(branchDayRepository.activeAdjustments).mockResolvedValue([]);
  vi.mocked(branchDayRepository.openingsForDate).mockResolvedValue([]);
  vi.mocked(branchDayRepository.activeOpeningAdjustments).mockResolvedValue([]);
  vi.mocked(branchDayRepository.createOpening).mockImplementation(async (_tx, input) => createdOpening(input.lines) as never);
  let ref = 3400;
  vi.mocked(referenceCounterRepository.nextReference).mockImplementation(async (_tx, _org, prefix) => `${prefix}-${++ref}`);
  vi.mocked(fcmService.sendOvernightVarianceAlertPush).mockImplementation(async () => {
    order.push('push:overnight');
  });
});

describe('history', () => {
  const range = { from: '2026-09-10', to: '2026-09-30' };

  it('is Branch Manager only and scoped to their own branch', async () => {
    await expect(branchDayService.getHistory(kitchenHead as never, range)).rejects.toMatchObject({ statusCode: 403 });
    vi.mocked(branchDayRepository.historyDays).mockResolvedValue([]);
    await branchDayService.getHistory(manager as never, range);
    expect(branchDayRepository.historyDays).toHaveBeenCalledWith(branchOrgId, expect.any(Date), expect.any(Date), expect.any(Date));
  });

  it('aggregates gaps and net adjustment from the saved lines, and marks a reopened day', async () => {
    const line = (n: number, counted: number, expected: number, reasonRequired: boolean) => ({
      id: `l${n}`,
      inventoryItemId: uid(n),
      countedQty: D(counted),
      expectedQty: D(expected),
      unitCost: items[n - 1]!.currentCost,
      reasonRequired,
      reason: null,
      reasonNote: null,
    });
    vi.mocked(branchDayRepository.historyDays).mockResolvedValue([
      day(
        { status: 'CLOSED', reopenCount: 1, closedAt: new Date('2026-09-29T18:40:00Z'), closedBy: { id: uid(900), name: 'Peter Njoroge' } },
        [department('KITCHEN', [line(1, 9, 14, true), line(2, 5, 5, false)]), ...TAGS.slice(1).map((t) => department(t))],
      ),
    ] as never);
    const { days } = await branchDayService.getHistory(manager as never, range);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      status: 'CLOSED',
      reopenCount: 1,
      departmentsClosed: 5,
      departmentsTotal: 5,
      gapLines: 1,
      netAdjustmentValue: '-500', // −5 kg × KES 100
    });
  });

  it('rejects a range longer than 92 days or reversed', async () => {
    const { HistoryQuerySchema } = await import('./branch-day-validators');
    expect(HistoryQuerySchema.safeParse({ from: '2026-01-01', to: '2026-09-30' }).success).toBe(false);
    expect(HistoryQuerySchema.safeParse({ from: '2026-09-30', to: '2026-09-01' }).success).toBe(false);
    expect(HistoryQuerySchema.safeParse(range).success).toBe(true);
  });
});

describe('getOverview (a reopened past day)', () => {
  it('builds the same overview for the branch\'s own day by id, and cannot reach another branch', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ businessDate: new Date('2026-09-28T00:00:00Z') }) as never);
    const overview = await branchDayService.getOverview(manager as never, dayId);
    expect(overview).toMatchObject({ id: dayId, date: '2026-09-28', status: 'OPEN', departments: expect.any(Array) });
    expect(branchDayRepository.findById).toHaveBeenCalledWith(dayId, branchOrgId);
    vi.mocked(branchDayRepository.findById).mockResolvedValue(null);
    await expect(branchDayService.getOverview(manager as never, dayId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('judges a past day against the position at the end of that business day (Nairobi midnight), never today\'s ledger', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ businessDate: new Date('2026-09-28T00:00:00Z') }) as never);
    await branchDayService.getOverview(manager as never, dayId);
    const asOf = vi.mocked(branchDayRepository.onHandExcludingDay).mock.calls[0]![4];
    expect(asOf?.toISOString()).toBe('2026-09-28T21:00:00.000Z'); // 29 Sep 00:00 in Nairobi
  });

  it('gives today (or a later date) no cutoff — its position is the live ledger', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ businessDate: new Date('2999-01-01T00:00:00Z') }) as never);
    await branchDayService.getOverview(manager as never, dayId);
    expect(vi.mocked(branchDayRepository.onHandExcludingDay).mock.calls[0]![4]).toBeUndefined();
  });
});

describe('getDetail', () => {
  it('reads saved lines only (never a live expected figure) and carries the reopen audit trail', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(
      day({ status: 'CLOSED', reopenCount: 1, closedAt: new Date('2026-09-29T18:40:00Z'), closedBy: { id: uid(900), name: 'Peter Njoroge' } }) as never,
    );
    vi.mocked(branchDayRepository.reopenAudit).mockResolvedValue([
      { id: 'r1', reopenedBy: { id: uid(900), name: 'Peter Njoroge' }, reopenedAt: new Date('2026-09-29T19:00:00Z'), reason: 'Miscounted Pastry' },
    ] as never);
    const detail = await branchDayService.getDetail(manager as never, dayId);
    expect(detail.reopens).toEqual([expect.objectContaining({ reason: 'Miscounted Pastry' })]);
    expect(detail.kpis).toMatchObject({ departmentsClosed: 5, reopens: 1 });
    expect(branchDayRepository.onHandExcludingDay).not.toHaveBeenCalled();
  });

  it('cannot reach another branch', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(null);
    await expect(branchDayService.getDetail(manager as never, dayId)).rejects.toMatchObject({ statusCode: 404 });
    expect(branchDayRepository.findById).toHaveBeenCalledWith(dayId, branchOrgId);
  });
});

describe('opening — role walls', () => {
  it.each([
    ['branch manager', manager],
    ['a non-head staff member', waiter],
  ])('%s cannot open a department', async (_l, actor) => {
    await expect(branchDayService.getOpening(actor as never)).rejects.toMatchObject({ statusCode: 403 });
    await expect(branchDayService.acceptOpening(actor as never, { lines: [] })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a head only ever sees their own department — the tag comes from the actor, never the request', async () => {
    await branchDayService.getOpening(kitchenHead as never);
    expect(branchDayRepository.departmentItems).toHaveBeenCalledWith(hubOrgId, branchOrgId, 'loc-kitchen', 'KITCHEN');
  });
});

describe('getOpening', () => {
  it('pre-fills from the department ledger and reports when last night closed', async () => {
    vi.mocked(branchDayRepository.findByDate).mockImplementation(async (_org, date) =>
      (date.getUTCDate() === 29
        ? day({ status: 'CLOSED', closedAt: new Date('2026-09-29T18:40:00Z') })
        : day()) as never,
    );
    const view = await branchDayService.getOpening(kitchenHead as never);
    expect(view.status).toBe('PENDING');
    expect(view.lastCloseAt).toBe('2026-09-29T18:40:00.000Z');
    expect(view.lines.map((l) => [l.name, l.prefilledQty, l.acceptedQty])).toEqual([
      ['Rice', '18', null],
      ['Chicken', '9', null],
    ]);
  });

  it('reports no last close when yesterday was never closed', async () => {
    const view = await branchDayService.getOpening(kitchenHead as never);
    expect(view.lastCloseAt).toBeNull();
  });

  it('once accepted, returns the signed figures, not the live ledger', async () => {
    vi.mocked(branchDayRepository.findOpening).mockResolvedValue({
      id: 'opening-1',
      acceptedAt: new Date('2026-09-30T03:12:00Z'),
      acceptedBy: { id: uid(901), name: 'Grace Wanjiru' },
      lines: [{ id: 'ol-1', inventoryItemId: uid(2), prefilledQty: D(9), acceptedQty: D(7), overnightVariance: D(-2), unitCost: D(200) }],
    } as never);
    const view = await branchDayService.getOpening(kitchenHead as never);
    expect(view).toMatchObject({ status: 'ACCEPTED', varianceLineCount: 1 });
    expect(view.lines[0]).toMatchObject({ name: 'Chicken', prefilledQty: '9', acceptedQty: '7', overnightVariance: '-2' });
    expect(branchDayRepository.onHandAt).not.toHaveBeenCalled();
  });
});

describe('acceptOpening', () => {
  it('writes the opening and one linked, ADJ-numbered overnight adjustment per differing line, in one transaction', async () => {
    const result = await branchDayService.acceptOpening(kitchenHead as never, {
      lines: [{ inventoryItemId: uid(2), acceptedQty: '7' }], // chicken 9 → 7; rice omitted → accepted at 18
    });
    expect(result).toMatchObject({ varianceLineCount: 1, adjustmentCount: 1, managerNotified: false });

    const create = vi.mocked(branchDayRepository.createOpening).mock.calls[0]![1];
    expect(create.lines).toHaveLength(2); // every item is on the record, including the unchanged one
    expect(create.lines.find((l) => l.inventoryItemId === uid(1))!.overnightVariance.toString()).toBe('0');

    const writes = vi.mocked(branchDayRepository.writeAdjustment).mock.calls.map((c) => c[1]);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      inventoryItemId: uid(2),
      locationId: 'loc-kitchen',
      reason: 'Overnight variance',
      reference: 'ADJ-3401',
      openingLineId: 'ol-2',
    });
    expect(writes[0]!.quantity.toString()).toBe('-2');
    expect(writes[0]!.branchDayLineId).toBeUndefined();
  });

  it('an unchanged opening writes no adjustment at all', async () => {
    const result = await branchDayService.acceptOpening(kitchenHead as never, { lines: [] });
    expect(result).toMatchObject({ varianceLineCount: 0, adjustmentCount: 0 });
    expect(branchDayRepository.writeAdjustment).not.toHaveBeenCalled();
  });

  it('refuses an item the department does not count, and a second accept the same day', async () => {
    await expect(
      branchDayService.acceptOpening(kitchenHead as never, { lines: [{ inventoryItemId: uid(77), acceptedQty: '1' }] }),
    ).rejects.toMatchObject({ statusCode: 400 });
    vi.mocked(branchDayRepository.findOpening).mockResolvedValue({ id: 'opening-1' } as never);
    await expect(branchDayService.acceptOpening(kitchenHead as never, { lines: [] })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('pushes the Branch Manager only after commit, and only for a line at or above the alert amount', async () => {
    // chicken −2 × KES 200 = KES 400 — under the KES 500 default: no push.
    await branchDayService.acceptOpening(kitchenHead as never, { lines: [{ inventoryItemId: uid(2), acceptedQty: '7' }] });
    expect(fcmService.sendOvernightVarianceAlertPush).not.toHaveBeenCalled();

    // chicken −3 × KES 200 = KES 600 — over it.
    order.length = 0;
    const result = await branchDayService.acceptOpening(kitchenHead as never, { lines: [{ inventoryItemId: uid(2), acceptedQty: '6' }] });
    expect(result.managerNotified).toBe(true);
    expect(fcmService.sendOvernightVarianceAlertPush).toHaveBeenCalledWith(
      branchOrgId,
      expect.objectContaining({ departmentName: 'Kitchen', alertLineCount: 1, largestValueKes: '600' }),
    );
    expect(order).toEqual(['tx:start', 'tx:commit', 'push:overnight']);
  });
});

describe('re-close recomputes an accepted opening (Flow 12b step 4)', () => {
  const countedKitchen = () =>
    day({}, [
      department('KITCHEN', [
        { id: 'bl-1', branchDayDepartmentId: 'dept-kitchen', inventoryItemId: uid(1), countedQty: D(18), expectedQty: D(18), unitCost: D(100), reason: null, reasonNote: null, reasonRequired: false },
        { id: 'bl-2', branchDayDepartmentId: 'dept-kitchen', inventoryItemId: uid(2), countedQty: D(9), expectedQty: D(9), unitCost: D(200), reason: null, reasonNote: null, reasonRequired: false },
      ]),
      ...TAGS.slice(1).map((t) => department(t)),
    ]);

  it('reverses the standing overnight row, re-derives the pre-fill, and writes a fresh row for what now differs', async () => {
    vi.mocked(branchDayRepository.findByDate).mockResolvedValue(countedKitchen() as never);
    vi.mocked(branchDayRepository.findById).mockResolvedValue(countedKitchen() as never);
    vi.mocked(branchDayRepository.openingsForDate).mockResolvedValue([
      {
        id: 'opening-1',
        locationId: 'loc-kitchen',
        lines: [
          { id: 'ol-1', inventoryItemId: uid(1), prefilledQty: D(18), acceptedQty: D(18), overnightVariance: D(0), unitCost: D(100) },
          { id: 'ol-2', inventoryItemId: uid(2), prefilledQty: D(9), acceptedQty: D(7), overnightVariance: D(-2), unitCost: D(200) },
        ],
      },
    ] as never);
    vi.mocked(branchDayRepository.activeOpeningAdjustments).mockResolvedValue([
      { id: 'adj-old', locationId: 'loc-kitchen', inventoryItemId: uid(2), quantity: D(-2), unitCost: D(200), reference: 'ADJ-3300', openingLineId: 'ol-2' },
    ] as never);
    // After the re-close the ledger (without the opening's own rows) says chicken is 8, not 9.
    vi.mocked(branchDayRepository.onHandAt).mockResolvedValue(new Map([[uid(1), D(18)], [uid(2), D(8)]]));

    await branchDayService.close(manager as never, dayId, { pin: '1234' });

    const writes = vi.mocked(branchDayRepository.writeAdjustment).mock.calls.map((c) => c[1]);
    const reversal = writes.find((w) => w.reversesTransactionId === 'adj-old')!;
    expect(reversal.quantity.toString()).toBe('2'); // equal and opposite
    expect(reversal.openingLineId).toBe('ol-2');

    const fresh = writes.find((w) => w.openingLineId === 'ol-2' && !w.reversesTransactionId)!;
    expect(fresh.quantity.toString()).toBe('-1'); // accepted 7 vs new pre-fill 8
    expect(fresh.reason).toBe('Overnight variance');

    expect(branchDayRepository.updateOpeningLine).toHaveBeenCalledWith(tx, 'ol-2', expect.anything(), expect.anything());
    const call = vi.mocked(branchDayRepository.updateOpeningLine).mock.calls.find((c) => c[1] === 'ol-2')!;
    expect(call[2].toString()).toBe('8');
    expect(call[3].toString()).toBe('-1');
    // Rice was unchanged (18 vs 18): no row for it.
    expect(writes.some((w) => w.openingLineId === 'ol-1')).toBe(false);
  });

  it('does nothing when the next morning has no accepted opening', async () => {
    vi.mocked(branchDayRepository.findByDate).mockResolvedValue(countedKitchen() as never);
    vi.mocked(branchDayRepository.findById).mockResolvedValue(countedKitchen() as never);
    await branchDayService.close(manager as never, dayId, { pin: '1234' });
    expect(branchDayRepository.activeOpeningAdjustments).not.toHaveBeenCalled();
    expect(branchDayRepository.updateOpeningLine).not.toHaveBeenCalled();
  });
});

describe('response contracts (frozen)', () => {
  it('opening, history and detail serialize exactly to their schemas — nothing undeclared leaks', async () => {
    const { OpeningViewSchema, HistoryListSchema, BranchDayDetailSchema, AcceptOpeningResultSchema } = await import('./branch-day-validators');

    const opening = await branchDayService.getOpening(kitchenHead as never);
    expect(OpeningViewSchema.parse(opening)).toEqual(opening);

    vi.mocked(branchDayRepository.historyDays).mockResolvedValue([day({ status: 'CLOSED', closedAt: new Date('2026-09-29T18:40:00Z'), closedBy: { id: uid(900), name: 'Peter Njoroge' } })] as never);
    const history = await branchDayService.getHistory(manager as never, { from: '2026-09-10', to: '2026-09-30' });
    expect(HistoryListSchema.parse(history)).toEqual(history);

    vi.mocked(branchDayRepository.findById).mockResolvedValue(day({ status: 'CLOSED', closedAt: new Date('2026-09-29T18:40:00Z'), closedBy: { id: uid(900), name: 'Peter Njoroge' } }) as never);
    vi.mocked(branchDayRepository.reopenAudit).mockResolvedValue([]);
    const detail = await branchDayService.getDetail(manager as never, dayId);
    expect(BranchDayDetailSchema.parse(detail)).toEqual(detail);

    const accepted = await branchDayService.acceptOpening(kitchenHead as never, { lines: [] });
    expect(AcceptOpeningResultSchema.parse(accepted)).toEqual(accepted);
  });
});
