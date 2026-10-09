/**
 * Branch waste service (contract §3.1, §4, §5, §6, §11) with the data layer mocked: the access grid for every endpoint and role, the
 * department rule, the money and blind rules, idempotency, the same-Nairobi-day reverse window, reversal as a linked ledger entry,
 * scoping by siteId and department, and the ledger door as the only way stock moves. The real-database paths are in
 * `branch-waste.db.test.ts`.
 */
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { deliveriesRepository } from '../../deliveries/deliveries-repository';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import {
  BRANCH_WASTE_BLIND_KEYS,
  branchWasteDetailSchema,
  branchWasteItemsSchema,
  branchWasteListSchema,
  logBranchWasteResultSchema,
  myBranchWasteListSchema,
  branchWasteEntrySchema,
} from '../_shared/waste-contract';
import { branchWasteRepository as repo } from './branch-repository';
import { branchWasteService } from './branch-service';

vi.mock('../../../../config/database', () => ({ prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn(), findActiveBranchOptions: vi.fn() } }));
vi.mock('../../deliveries/deliveries-repository', () => ({ deliveriesRepository: { ensureDepartmentLocation: vi.fn() } }));
vi.mock('../../stock/ledger/ledger-door', () => ({ postStockMovement: vi.fn() }));
vi.mock('./branch-repository', () => ({
  branchWasteRepository: {
    findStaff: vi.fn(),
    searchDepartmentItems: vi.fn(),
    departmentItemsByIds: vi.fn(),
    oftenItemIds: vi.fn(),
    findLoggableItems: vi.fn(),
    findBatch: vi.fn(),
    createBatch: vi.fn(),
    createLog: vi.fn(),
    latestDispatchInCost: vi.fn(),
    findPage: vi.fn(),
    findLog: vi.fn(),
    departmentsOf: vi.fn(),
    latestBatchToday: vi.fn(),
    ledgerRowsOf: vi.fn(),
    anyNegative: vi.fn(),
    loggedSince: vi.fn(),
    reversedSince: vi.fn(),
    lockLog: vi.fn(),
    findWasteLedgerRow: vi.fn(),
    stampReversal: vi.fn(),
  },
}));

const HUB = '11111111-1111-4111-8111-111111111111';
const NYERI = '20000000-0000-4000-8000-000000000001';
const KARATINA = '20000000-0000-4000-8000-000000000002';
const KITCHEN = '30000000-0000-4000-8000-000000000001';
const BARISTA = '30000000-0000-4000-8000-000000000002';
const KITCHEN_LOC = '40000000-0000-4000-8000-000000000001';
const BEEF = '10000000-0000-4000-8000-000000000071';
const PILAU = '10000000-0000-4000-8000-000000000072';
const NOW = new Date('2026-10-13T11:20:00Z'); // Tuesday 14:20 in Nairobi
const EARLIER_TODAY = new Date('2026-10-13T06:05:00Z');
const YESTERDAY = new Date('2026-10-12T14:00:00Z');

const member = { id: 'u-grace', role: 'CHEF' as const, siteId: NYERI };
const otherMember = { id: 'u-joseph', role: 'CHEF' as const, siteId: NYERI };
const branchManager = { id: 'u-bm', role: 'MANAGER' as const, siteId: NYERI };
const admin = { id: 'u-admin', role: 'SYSTEM_ADMIN' as const, siteId: null };
const director = { id: 'u-dir', role: 'DIRECTOR' as const, siteId: HUB };
const accountant = { id: 'u-acc', role: 'ACCOUNTANT' as const, siteId: HUB };
const storeManager = { id: 'u-sm', role: 'STORE_MANAGER' as const, siteId: HUB };
const attendant = { id: 'u-att', role: 'STORE_ATTENDANT' as const, siteId: HUB };
const NOT_DEPARTMENTS = [
  ['Branch Manager', branchManager],
  ['System Admin', admin],
  ['Director', director],
  ['Accountant', accountant],
  ['Store Manager', storeManager],
  ['Store Attendant', attendant],
] as const;

const staffOf = (over: Record<string, unknown> = {}) => ({
  id: member.id,
  name: 'Grace Wanjiru',
  role: 'CHEF',
  siteId: NYERI,
  departmentId: KITCHEN,
  department: { id: KITCHEN, name: 'Kitchen', siteId: NYERI, status: 'ACTIVE' },
  ...over,
});

const person = (id: string, name: string, role = 'CHEF') => ({ id, name, role });

/** A waste log as the repository returns it. */
const logRow = (over: Record<string, unknown> = {}) =>
  ({
    id: 'e0000000-0000-4000-8000-000000000001',
    siteId: NYERI,
    locationId: KITCHEN_LOC,
    batchId: 'b1',
    inventoryItemId: BEEF,
    quantity: new Prisma.Decimal(2),
    reason: 'EXPIRY',
    note: null,
    unitCost: new Prisma.Decimal(320),
    loggedById: member.id,
    createdAt: EARLIER_TODAY,
    reversedAt: null,
    reversedById: null,
    reversalReason: null,
    reversalNote: null,
    inventoryItem: { id: BEEF, name: 'Beef stew', usageUnit: 'kg' },
    loggedBy: person(member.id, 'Grace Wanjiru'),
    reversedBy: null,
    site: { id: NYERI, name: 'Nyeri Town', code: 'NYR' },
    location: { id: KITCHEN_LOC, name: 'Nyeri Town — Kitchen', departmentId: KITCHEN, department: { id: KITCHEN, name: 'Kitchen' } },
    ...over,
  }) as never;

const keysOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(keysOf) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : [];
const expectBlind = (payload: unknown) => {
  const keys = new Set(keysOf(payload));
  for (const blind of BRANCH_WASTE_BLIND_KEYS) expect(keys.has(blind), `carries ${blind}`).toBe(false);
};

const item = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  usageUnit: 'kg',
  currentCost: new Prisma.Decimal(320),
  deletedAt: null,
  inDepartment: true,
  ...over,
});

const input = {
  entries: [
    { inventoryItemId: BEEF, quantity: '2', reason: 'EXPIRY' as const },
    { inventoryItemId: PILAU, quantity: '3', reason: 'SPOILAGE' as const },
  ],
  note: 'Fridge 2 was off overnight',
  idempotencyKey: '3c4d5e6f-7a8b-4c9d-8e0f',
};

let n = 0;
beforeEach(() => {
  vi.resetAllMocks();
  n = 0;
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(branchRepository.findActiveBranchOptions).mockResolvedValue([
    { id: NYERI, name: 'Nyeri Town' },
    { id: KARATINA, name: 'Karatina' },
  ]);
  // Only the two Kitchen people have a department; anyone else (the Store Attendant sits at the hub) has none.
  vi.mocked(repo.findStaff).mockImplementation((async (id: string) =>
    id === member.id || id === otherMember.id ? staffOf({ id }) : staffOf({ id, siteId: HUB, departmentId: null, department: null })) as never);
  vi.mocked(repo.searchDepartmentItems).mockResolvedValue([]);
  vi.mocked(repo.departmentItemsByIds).mockResolvedValue([]);
  vi.mocked(repo.oftenItemIds).mockResolvedValue([]);
  vi.mocked(repo.ledgerRowsOf).mockResolvedValue([]);
  vi.mocked(repo.findBatch).mockResolvedValue(null);
  vi.mocked(repo.createBatch).mockResolvedValue({ id: 'b1' });
  vi.mocked(repo.createLog).mockImplementation(async (_tx, data) => logRow({ ...data, id: `e0000000-0000-4000-8000-00000000000${++n}`, createdAt: NOW, inventoryItem: { id: data.inventoryItemId, name: data.inventoryItemId === BEEF ? 'Beef stew' : 'Pilau', usageUnit: 'kg' } }));
  vi.mocked(repo.findLoggableItems).mockResolvedValue([item(BEEF, 'Beef stew'), item(PILAU, 'Pilau', { currentCost: new Prisma.Decimal(180) })]);
  vi.mocked(repo.latestDispatchInCost).mockResolvedValue(null);
  vi.mocked(repo.anyNegative).mockResolvedValue(false);
  vi.mocked(repo.departmentsOf).mockResolvedValue([{ id: KITCHEN, name: 'Kitchen' }]);
  vi.mocked(repo.loggedSince).mockResolvedValue([]);
  vi.mocked(repo.reversedSince).mockResolvedValue([]);
  vi.mocked(repo.findPage).mockResolvedValue({ rows: [], total: 0 });
  vi.mocked(deliveriesRepository.ensureDepartmentLocation).mockResolvedValue({ id: KITCHEN_LOC });
});

// ═══ The department rule ════════════════════════════════════════════════════════════════════════════════════════════════

describe('the department rule (BW1, BW2, BW3)', () => {
  const calls = {
    'BW1 items': (a: never) => branchWasteService.listItems(a, { limit: 20 }, NOW),
    'BW2 log': (a: never) => branchWasteService.log(a, input, NOW),
    'BW3 mine': (a: never) => branchWasteService.listMine(a, { page: 1, pageSize: 50 }, NOW),
  };

  for (const [name, call] of Object.entries(calls)) {
    describe(name, () => {
      it.each(NOT_DEPARTMENTS)('refuses the %s with 403 NOT_YOUR_DEPARTMENT, before reading or writing anything', async (_label, actor) => {
        await expect(call(actor as never)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_DEPARTMENT' });
        expect(repo.findPage).not.toHaveBeenCalled();
        expect(repo.createBatch).not.toHaveBeenCalled();
        expect(postStockMovement).not.toHaveBeenCalled();
      });

      it('refuses a person with no department (a branch waiter who was never given one)', async () => {
        vi.mocked(repo.findStaff).mockResolvedValue(staffOf({ departmentId: null, department: null }) as never);
        await expect(call({ ...member, role: 'WAITER' } as never)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_DEPARTMENT' });
      });

      it('refuses a person whose record sits at the hub (the hub has no departments)', async () => {
        vi.mocked(repo.findStaff).mockResolvedValue(staffOf({ siteId: HUB, department: { id: KITCHEN, name: 'Kitchen', siteId: HUB, status: 'ACTIVE' } }) as never);
        await expect(call(member as never)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_DEPARTMENT' });
      });

      it('refuses a member of a RETIRED department with a plain 403', async () => {
        vi.mocked(repo.findStaff).mockResolvedValue(staffOf({ department: { id: KITCHEN, name: 'Kitchen', siteId: NYERI, status: 'RETIRED' } }) as never);
        await expect(call(member as never)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_DEPARTMENT', message: expect.stringMatching(/retired/i) });
      });

      it('refuses a person whose department belongs to another branch than theirs', async () => {
        vi.mocked(repo.findStaff).mockResolvedValue(staffOf({ department: { id: KITCHEN, name: 'Kitchen', siteId: KARATINA, status: 'ACTIVE' } }) as never);
        await expect(call(member as never)).rejects.toMatchObject({ statusCode: 403 });
      });

      it('lets an active head or member of an active department through', async () => {
        await expect(call(member as never)).resolves.toBeDefined();
      });
    });
  }
});

// ═══ BW1 ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('BW1 items', () => {
  it('lists the department’s own items (the department comes from the caller) and the caller’s usual ones, and carries no cost or stock figure', async () => {
    vi.mocked(repo.oftenItemIds).mockResolvedValue([BEEF]);
    vi.mocked(repo.departmentItemsByIds).mockResolvedValue([{ id: BEEF, name: 'Beef stew', usageUnit: 'kg' }]);
    vi.mocked(repo.searchDepartmentItems).mockResolvedValue([{ id: BEEF, name: 'Beef stew', usageUnit: 'kg' }, { id: PILAU, name: 'Pilau', usageUnit: 'kg' }]);
    const result = await branchWasteService.listItems(member as never, { search: 'p', limit: 20 }, NOW);
    expect(() => branchWasteItemsSchema.parse(result)).not.toThrow();
    expect(result.often).toEqual([{ itemId: BEEF, name: 'Beef stew', unit: 'kg' }]);
    expect(result.items).toHaveLength(2);
    expectBlind(result);
    expect(repo.searchDepartmentItems).toHaveBeenCalledWith(HUB, KITCHEN, 'p', 20);
    expect(repo.oftenItemIds).toHaveBeenCalledWith(NYERI, member.id, KITCHEN, expect.any(Date), 6);
  });

  it('looks back 60 Nairobi days for the usual items', async () => {
    await branchWasteService.listItems(member as never, { limit: 20 }, NOW);
    const since = vi.mocked(repo.oftenItemIds).mock.calls[0]![3] as Date;
    expect(since.toISOString()).toBe('2026-08-13T21:00:00.000Z'); // 14 Aug 00:00 Nairobi: 60 days before Tuesday 13 Oct
  });
});

// ═══ BW2 ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('BW2 log', () => {
  it('writes one log and one WASTE ledger row per entry through the door, at the department’s location, in one batch', async () => {
    const { result, replayed } = await branchWasteService.log(member as never, input, NOW);
    expect(replayed).toBe(false);
    expect(repo.createBatch).toHaveBeenCalledTimes(1);
    expect(repo.createBatch).toHaveBeenCalledWith(expect.anything(), NYERI, member.id, input.idempotencyKey);
    expect(repo.createLog).toHaveBeenCalledTimes(2);
    expect(vi.mocked(repo.createLog).mock.calls[0]![1]).toMatchObject({ siteId: NYERI, locationId: KITCHEN_LOC, batchId: 'b1', inventoryItemId: BEEF, note: 'Fridge 2 was off overnight', loggedById: member.id });
    expect(postStockMovement).toHaveBeenCalledTimes(2);
    expect(vi.mocked(postStockMovement).mock.calls[0]![1]).toMatchObject({
      type: 'WASTE',
      locationId: KITCHEN_LOC,
      inventoryItemId: BEEF,
      quantity: new Prisma.Decimal(2),
      reason: 'EXPIRY',
      userId: member.id,
      links: { wasteLogId: 'e0000000-0000-4000-8000-000000000001' },
    });
    expect(() => logBranchWasteResultSchema.parse(result)).not.toThrow();
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({ department: { id: KITCHEN, name: 'Kitchen' }, branch: { id: NYERI } });
  });

  it('ensures the department’s location in the same transaction (a department added later has none yet)', async () => {
    await branchWasteService.log(member as never, input, NOW);
    expect(deliveriesRepository.ensureDepartmentLocation).toHaveBeenCalledWith(expect.anything(), NYERI, KITCHEN);
  });

  it('refuses when the department cannot be given a location', async () => {
    vi.mocked(deliveriesRepository.ensureDepartmentLocation).mockResolvedValue(null);
    await expect(branchWasteService.log(member as never, input, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('values an entry at the cost carried into the department, else at the item’s cost now', async () => {
    vi.mocked(repo.latestDispatchInCost).mockImplementation(async (_s, _l, itemId) => (itemId === BEEF ? new Prisma.Decimal(300) : null));
    await branchWasteService.log(member as never, input, NOW);
    expect(vi.mocked(repo.createLog).mock.calls[0]![1].unitCost.toString()).toBe('300');
    expect(vi.mocked(repo.createLog).mock.calls[1]![1].unitCost.toString()).toBe('180');
    expect(vi.mocked(postStockMovement).mock.calls[0]![1]).toMatchObject({ unitCost: new Prisma.Decimal(300) });
  });

  it('never trusts a department or location from the request: the logs carry the caller’s branch and department location', async () => {
    await branchWasteService.log(member as never, { ...input, locationId: 'x', departmentId: 'y' } as never, NOW);
    for (const call of vi.mocked(repo.createLog).mock.calls) expect(call[1]).toMatchObject({ siteId: NYERI, locationId: KITCHEN_LOC });
    expect(repo.findLoggableItems).toHaveBeenCalledWith(HUB, KITCHEN, [BEEF, PILAU]);
  });

  it('gives a head or member no money and no stock figure: no value, total, wentNegative', async () => {
    vi.mocked(repo.anyNegative).mockResolvedValue(true);
    const { result } = await branchWasteService.log(member as never, input, NOW);
    expectBlind(result);
    expect(repo.anyNegative).not.toHaveBeenCalled();
  });

  it('refuses an item the department does not hold with 422 ITEM_NOT_IN_DEPARTMENT, and writes nothing', async () => {
    vi.mocked(repo.findLoggableItems).mockResolvedValue([item(BEEF, 'Beef stew'), item(PILAU, 'Pilau', { inDepartment: false })]);
    await expect(branchWasteService.log(member as never, input, NOW)).rejects.toMatchObject({ statusCode: 422, code: 'ITEM_NOT_IN_DEPARTMENT', message: 'Pilau is not an item of your department.' });
    expect(repo.createBatch).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('refuses a retired item with 409 ITEM_RETIRED, and an unknown item with 404', async () => {
    vi.mocked(repo.findLoggableItems).mockResolvedValue([item(BEEF, 'Beef stew', { deletedAt: new Date('2026-09-01') }), item(PILAU, 'Pilau')]);
    await expect(branchWasteService.log(member as never, input, NOW)).rejects.toMatchObject({ statusCode: 409, code: 'ITEM_RETIRED' });
    vi.mocked(repo.findLoggableItems).mockResolvedValue([item(BEEF, 'Beef stew')]);
    await expect(branchWasteService.log(member as never, input, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('is idempotent: a repeated key returns the same entries with replayed:true and writes nothing', async () => {
    vi.mocked(repo.findBatch).mockResolvedValue({ id: 'b1', logs: [logRow(), logRow({ id: 'e0000000-0000-4000-8000-000000000002', inventoryItemId: PILAU })] } as never);
    const { result, replayed } = await branchWasteService.log(member as never, input, NOW);
    expect(replayed).toBe(true);
    expect(result.replayed).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(repo.findBatch).toHaveBeenCalledWith(NYERI, member.id, input.idempotencyKey);
    expect(repo.createBatch).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
    expectBlind(result);
  });

  it('settles a race on the unique key by replaying the winner’s batch', async () => {
    vi.mocked(repo.findBatch).mockResolvedValueOnce(null).mockResolvedValue({ id: 'b1', logs: [logRow()] } as never);
    vi.mocked(repo.createBatch).mockRejectedValue(Object.assign(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x', meta: { target: ['organization_id', 'user_id', 'idempotency_key'] } })));
    const { replayed } = await branchWasteService.log(member as never, input, NOW);
    expect(replayed).toBe(true);
  });

  it('lets any other database failure through, and posts nothing past it', async () => {
    vi.mocked(postStockMovement).mockRejectedValue(new Error('ledger down'));
    await expect(branchWasteService.log(member as never, input, NOW)).rejects.toThrow('ledger down');
  });
});

// ═══ BW3 ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('BW3 my department’s waste', () => {
  it('reads the whole department, scoped to the caller’s branch and department, default window the last 7 Nairobi days to today', async () => {
    vi.mocked(repo.findPage).mockResolvedValue({ rows: [logRow(), logRow({ id: 'e0000000-0000-4000-8000-000000000003', loggedById: otherMember.id, loggedBy: person(otherMember.id, 'Joseph Mwangi') })], total: 2 });
    vi.mocked(repo.latestBatchToday).mockResolvedValue({ at: NOW, count: 2 });
    const result = await branchWasteService.listMine(member as never, { page: 1, pageSize: 50 }, NOW);
    expect(() => myBranchWasteListSchema.parse(result)).not.toThrow();
    const [scope, filter] = vi.mocked(repo.findPage).mock.calls[0]!;
    expect(scope).toEqual({ siteIds: [NYERI], departmentId: KITCHEN });
    expect(filter.loggedFrom?.toISOString()).toBe('2026-10-06T21:00:00.000Z'); // 7 Oct 00:00 Nairobi
    expect(filter.loggedBefore?.toISOString()).toBe('2026-10-13T21:00:00.000Z'); // the start of 14 Oct, so 13 Oct is included
    expect(result.department).toEqual({ id: KITCHEN, name: 'Kitchen' });
    expect(result.bannerText).toBe('2 items logged at 14:20. You can reverse your own entries today.');
    expect(result.page).toEqual({ page: 1, pageSize: 50, total: 2 });
    expectBlind(result);
  });

  it('can.reverse is true only on the caller’s own entries logged today', async () => {
    vi.mocked(repo.findPage).mockResolvedValue({
      rows: [
        logRow({ id: 'e0000000-0000-4000-8000-000000000001' }),
        logRow({ id: 'e0000000-0000-4000-8000-000000000002', loggedById: otherMember.id, loggedBy: person(otherMember.id, 'Joseph Mwangi') }),
        logRow({ id: 'e0000000-0000-4000-8000-000000000003', createdAt: YESTERDAY }),
        logRow({ id: 'e0000000-0000-4000-8000-000000000004', reversedAt: NOW, reversedById: member.id, reversalReason: 'WRONG_ITEM', reversedBy: person(member.id, 'Grace Wanjiru') }),
      ],
      total: 4,
    });
    const { rows } = await branchWasteService.listMine(member as never, { page: 1, pageSize: 50 }, NOW);
    expect(rows.map((r) => r.can.reverse)).toEqual([true, false, false, false]);
    expect(rows[3]).toMatchObject({ status: 'REVERSED', reversal: { reason: 'WRONG_ITEM' } });
  });

  it('banner is null when the caller logged nothing today; an explicit range replaces the default', async () => {
    const result = await branchWasteService.listMine(member as never, { page: 2, pageSize: 25, from: '2026-10-01', to: '2026-10-03' }, NOW);
    expect(result.bannerText).toBeNull();
    const filter = vi.mocked(repo.findPage).mock.calls[0]![1];
    expect(filter.loggedFrom?.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(filter.loggedBefore?.toISOString()).toBe('2026-10-03T21:00:00.000Z');
    expect(vi.mocked(repo.findPage).mock.calls[0]![2]).toBe(2);
  });

  it('refuses from after to', async () => {
    await expect(branchWasteService.listMine(member as never, { page: 1, pageSize: 50, from: '2026-10-05', to: '2026-10-01' }, NOW)).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ═══ BW4 / BW5 ══════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('BW4 branch list', () => {
  it('is for the Branch Manager’s own branch, with values, the four figures and Reverse on a standing entry; default window today', async () => {
    vi.mocked(repo.findPage).mockResolvedValue({ rows: [logRow({ loggedById: otherMember.id })], total: 1 });
    const result = await branchWasteService.listBranch(branchManager as never, { page: 1, pageSize: 50, departmentId: KITCHEN, reason: 'EXPIRY', status: 'logged', search: 'beef' }, NOW);
    expect(() => branchWasteListSchema.parse(result)).not.toThrow();
    const [scope, filter, page, pageSize] = vi.mocked(repo.findPage).mock.calls[0]!;
    expect(scope).toEqual({ siteIds: [NYERI] });
    expect(filter).toMatchObject({ departmentId: KITCHEN, reason: 'EXPIRY', status: 'logged', search: 'beef' });
    expect(filter.loggedFrom?.toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(filter.loggedBefore?.toISOString()).toBe('2026-10-13T21:00:00.000Z');
    expect([page, pageSize]).toEqual([1, 50]);
    expect(result.kpis).toHaveLength(4);
    expect(result.rows[0]).toMatchObject({ valueKes: '640.00', can: { reverse: true } });
    expect(result.branches).toBeUndefined();
    expect(result.departments).toEqual([{ id: KITCHEN, name: 'Kitchen' }]);
    expect(repo.departmentsOf).toHaveBeenCalledWith([NYERI]);
  });

  it('reads the figures over the branch’s last 7 Nairobi days, whatever the filters', async () => {
    await branchWasteService.listBranch(branchManager as never, { page: 1, pageSize: 50, reason: 'EXPIRY' }, NOW);
    expect(vi.mocked(repo.loggedSince).mock.calls[0]![0]).toEqual({ siteIds: [NYERI] });
    expect((vi.mocked(repo.loggedSince).mock.calls[0]![1] as Date).toISOString()).toBe('2026-10-06T21:00:00.000Z');
    expect((vi.mocked(repo.reversedSince).mock.calls[0]![1] as Date).toISOString()).toBe('2026-10-06T21:00:00.000Z');
  });

  it('a reversed entry reads 0.00 in the Value column and offers no Reverse', async () => {
    vi.mocked(repo.findPage).mockResolvedValue({
      rows: [logRow({ reversedAt: NOW, reversedById: member.id, reversalReason: 'WRONG_ITEM', reversedBy: person(member.id, 'Grace Wanjiru') })],
      total: 1,
    });
    const { rows } = await branchWasteService.listBranch(branchManager as never, { page: 1, pageSize: 50 }, NOW);
    expect(rows[0]).toMatchObject({ valueKes: '0.00', status: 'REVERSED', can: { reverse: false } });
  });

  it('the System Admin reads the branch they stand in; without one it is 400', async () => {
    await branchWasteService.listBranch({ ...admin, siteId: KARATINA } as never, { page: 1, pageSize: 50 }, NOW);
    expect(vi.mocked(repo.findPage).mock.calls[0]![0]).toEqual({ siteIds: [KARATINA] });
    await expect(branchWasteService.listBranch(admin as never, { page: 1, pageSize: 50 }, NOW)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('a Branch Manager with no branch, or standing at the hub, is refused (400), never given the hub', async () => {
    await expect(branchWasteService.listBranch({ ...branchManager, siteId: null } as never, { page: 1, pageSize: 50 }, NOW)).rejects.toMatchObject({ statusCode: 400 });
    await expect(branchWasteService.listBranch({ ...branchManager, siteId: HUB } as never, { page: 1, pageSize: 50 }, NOW)).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([['Director', director], ['Accountant', accountant], ['Store Manager', storeManager], ['Store Attendant', attendant], ['a head or member', member]] as const)(
    'refuses the %s with 403 (the second wall behind the route)',
    async (_label, actor) => {
      await expect(branchWasteService.listBranch(actor as never, { page: 1, pageSize: 50 }, NOW)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.findPage).not.toHaveBeenCalled();
    },
  );
});

describe('BW5 any branch', () => {
  it.each([['Director', director], ['Accountant', accountant], ['Store Manager', storeManager], ['System Admin', admin]] as const)(
    '%s reads every active branch, read only: Reverse is never offered',
    async (_label, actor) => {
      vi.mocked(repo.findPage).mockResolvedValue({ rows: [logRow()], total: 1 });
      const result = await branchWasteService.listBranches(actor as never, { page: 1, pageSize: 50 }, NOW);
      expect(() => branchWasteListSchema.parse(result)).not.toThrow();
      expect(vi.mocked(repo.findPage).mock.calls[0]![0]).toEqual({ siteIds: [NYERI, KARATINA] });
      expect(result.rows.every((r) => r.can.reverse === false)).toBe(true);
      expect(result.rows[0]).toMatchObject({ valueKes: '640.00', branch: { name: 'Nyeri Town' } });
      expect(result.branches).toEqual([{ id: NYERI, name: 'Nyeri Town' }, { id: KARATINA, name: 'Karatina' }]);
      expect(result.kpis).toHaveLength(4);
    },
  );

  it('narrows to one branch when branchId is given; an unknown or inactive branch is 404', async () => {
    await branchWasteService.listBranches(director as never, { page: 1, pageSize: 50, branchId: KARATINA }, NOW);
    expect(vi.mocked(repo.findPage).mock.calls[0]![0]).toEqual({ siteIds: [KARATINA] });
    expect(repo.departmentsOf).toHaveBeenCalledWith([KARATINA]);
    await expect(branchWasteService.listBranches(director as never, { page: 1, pageSize: 50, branchId: '20000000-0000-4000-8000-0000000000ff' }, NOW)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('Today names the branch count when no branch is picked', async () => {
    vi.mocked(repo.loggedSince).mockResolvedValue([
      { createdAt: NOW, reversedAt: null, quantity: new Prisma.Decimal(1), unitCost: new Prisma.Decimal(100), reason: 'EXPIRY', siteId: NYERI, inventoryItemId: BEEF, inventoryItem: { name: 'Beef stew' }, location: { departmentId: KITCHEN, department: { id: KITCHEN, name: 'Kitchen' } }, reversedBy: null },
      { createdAt: NOW, reversedAt: null, quantity: new Prisma.Decimal(1), unitCost: new Prisma.Decimal(100), reason: 'EXPIRY', siteId: KARATINA, inventoryItemId: BEEF, inventoryItem: { name: 'Beef stew' }, location: { departmentId: BARISTA, department: { id: BARISTA, name: 'Barista' } }, reversedBy: null },
    ]);
    const result = await branchWasteService.listBranches(director as never, { page: 1, pageSize: 50 }, NOW);
    expect(result.kpis?.[0]?.caption).toBe('KES · 2 entries · 2 branches');
  });

  it.each([['Branch Manager', branchManager], ['Store Attendant', attendant], ['a head or member', member]] as const)('refuses the %s with 403', async (_label, actor) => {
    await expect(branchWasteService.listBranches(actor as never, { page: 1, pageSize: 50 }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.findPage).not.toHaveBeenCalled();
  });
});

// ═══ BW6 ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('BW6 detail', () => {
  const ID = 'e0000000-0000-4000-8000-000000000001';

  it('a head or member reads an entry of their own department, with no ledger rows and no money', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(logRow());
    const result = await branchWasteService.detail(member as never, ID, NOW);
    expect(() => branchWasteDetailSchema.parse(result)).not.toThrow();
    expect(repo.findLog).toHaveBeenCalledWith(ID, { siteIds: [NYERI], departmentId: KITCHEN });
    expectBlind(result);
    expect(repo.ledgerRowsOf).not.toHaveBeenCalled();
    expect(result.entry.can.reverse).toBe(true);
  });

  it('an entry outside the caller’s reach is a 404, not a 403', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(null);
    await expect(branchWasteService.detail(member as never, ID, NOW)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('the Branch Manager reads within their own branch, with the value and the ledger rows the entry wrote', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(logRow({ reversedAt: NOW, reversedById: member.id, reversalReason: 'WRONG_ITEM', reversedBy: person(member.id, 'Grace Wanjiru') }));
    vi.mocked(repo.ledgerRowsOf).mockResolvedValue([
      { quantity: new Prisma.Decimal(-2), createdAt: EARLIER_TODAY, reversesTransactionId: null },
      { quantity: new Prisma.Decimal(2), createdAt: NOW, reversesTransactionId: 'tx1' },
    ] as never);
    const result = await branchWasteService.detail(branchManager as never, ID, NOW);
    expect(repo.findLog).toHaveBeenCalledWith(ID, { siteIds: [NYERI] });
    expect(result.ledger).toEqual([
      { kind: 'LOGGED', at: EARLIER_TODAY.toISOString(), quantity: '-2' },
      { kind: 'REVERSAL', at: NOW.toISOString(), quantity: '2' },
    ]);
    expect(result.entry).toMatchObject({ valueKes: '0.00', status: 'REVERSED' });
  });

  it.each([['Director', director], ['Accountant', accountant], ['Store Manager', storeManager], ['System Admin', admin]] as const)('%s reads any branch’s entry, read only', async (_label, actor) => {
    vi.mocked(repo.findLog).mockResolvedValue(logRow());
    const result = await branchWasteService.detail(actor as never, ID, NOW);
    expect(vi.mocked(repo.findLog).mock.calls[0]![1]).toEqual({ siteIds: [NYERI, KARATINA] });
    expect(result.entry.can.reverse).toBe(actor.role === 'SYSTEM_ADMIN');
    expect(result.ledger).toBeDefined();
  });

  it('refuses someone who is none of these', async () => {
    await expect(branchWasteService.detail(attendant as never, ID, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_DEPARTMENT' });
  });
});

// ═══ BW7 ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('BW7 reverse', () => {
  const ID = 'e0000000-0000-4000-8000-000000000001';
  const body = { reason: 'WRONG_ITEM' as const };
  const original = { id: 'tx-orig', locationId: KITCHEN_LOC, inventoryItemId: BEEF, quantity: new Prisma.Decimal(-2), unitCost: new Prisma.Decimal(320) };
  const stamped = (over: Record<string, unknown> = {}) =>
    logRow({ reversedAt: NOW, reversedById: member.id, reversalReason: 'WRONG_ITEM', reversedBy: person(member.id, 'Grace Wanjiru'), ...over });

  beforeEach(() => {
    vi.mocked(repo.findLog).mockResolvedValue(logRow());
    vi.mocked(repo.findWasteLedgerRow).mockResolvedValue(original as never);
    vi.mocked(repo.stampReversal).mockImplementation(async (_tx, _site, _id, data) => stamped({ reversedAt: data.reversedAt, reversedById: data.reversedById, reversalReason: data.reversalReason, reversalNote: data.reversalNote }));
  });

  it('a head or member reverses their own entry the same day: a linked reversing ledger row through the door, then the stamp', async () => {
    const entry = await branchWasteService.reverse(member as never, ID, { reason: 'WRONG_QUANTITY', note: 'It was 1 kg' }, NOW);
    expect(() => branchWasteEntrySchema.parse(entry)).not.toThrow();
    expect(repo.lockLog).toHaveBeenCalledWith(expect.anything(), NYERI, ID);
    expect(postStockMovement).toHaveBeenCalledTimes(1);
    expect(vi.mocked(postStockMovement).mock.calls[0]![1]).toMatchObject({
      type: 'WASTE',
      locationId: KITCHEN_LOC,
      inventoryItemId: BEEF,
      quantity: new Prisma.Decimal(2),
      unitCost: new Prisma.Decimal(320),
      reason: 'Reversed: Wrong quantity',
      userId: member.id,
      links: { wasteLogId: ID },
      reversesTransactionId: 'tx-orig',
    });
    expect(repo.stampReversal).toHaveBeenCalledWith(expect.anything(), NYERI, ID, { reversedAt: NOW, reversedById: member.id, reversalReason: 'WRONG_QUANTITY', reversalNote: 'It was 1 kg' });
    expect(entry).toMatchObject({ status: 'REVERSED', can: { reverse: false }, reversal: { reason: 'WRONG_QUANTITY', note: 'It was 1 kg' } });
    expect(repo.findLog).toHaveBeenCalledWith(ID, { siteIds: [NYERI], departmentId: KITCHEN });
    expectBlind(entry);
  });

  it('stores no note when none is sent', async () => {
    await branchWasteService.reverse(member as never, ID, body, NOW);
    expect(vi.mocked(repo.stampReversal).mock.calls[0]![3]).toMatchObject({ reversalNote: null });
  });

  it('refuses a member reversing a colleague’s entry (NOT_YOUR_ENTRY), and writes nothing', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(logRow({ loggedById: otherMember.id }));
    await expect(branchWasteService.reverse(member as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_ENTRY' });
    expect(postStockMovement).not.toHaveBeenCalled();
    expect(repo.stampReversal).not.toHaveBeenCalled();
  });

  it('refuses a member reversing their own entry from an earlier Nairobi day (REVERSAL_WINDOW_PASSED)', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(logRow({ createdAt: YESTERDAY }));
    await expect(branchWasteService.reverse(member as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'REVERSAL_WINDOW_PASSED' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('an entry of another department or branch is a 404 for a member (outside their reach)', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(null);
    await expect(branchWasteService.reverse(member as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('the Branch Manager reverses any entry of their branch, however old and whoever logged it, within their own branch only', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(logRow({ createdAt: new Date('2026-09-01T08:00:00Z'), loggedById: otherMember.id }));
    const entry = await branchWasteService.reverse(branchManager as never, ID, body, NOW);
    expect(entry.status).toBe('REVERSED');
    expect(repo.findLog).toHaveBeenCalledWith(ID, { siteIds: [NYERI] });
    expect(vi.mocked(postStockMovement).mock.calls[0]![1]).toMatchObject({ userId: branchManager.id });
    expect(vi.mocked(repo.stampReversal).mock.calls[0]![3]).toMatchObject({ reversedById: branchManager.id });
  });

  it('the Branch Manager of another branch cannot reach the entry (404)', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(null);
    await expect(branchWasteService.reverse({ ...branchManager, siteId: KARATINA } as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(vi.mocked(repo.findLog).mock.calls[0]![1]).toEqual({ siteIds: [KARATINA] });
  });

  it('the System Admin reverses any entry of any branch, and their own id is recorded', async () => {
    await branchWasteService.reverse(admin as never, ID, body, NOW);
    expect(vi.mocked(repo.findLog).mock.calls[0]![1]).toEqual({ siteIds: [NYERI, KARATINA] });
    expect(vi.mocked(repo.stampReversal).mock.calls[0]![3]).toMatchObject({ reversedById: admin.id });
  });

  it.each([['Director', director], ['Accountant', accountant], ['Store Manager', storeManager]] as const)('refuses the %s with 403 before looking at the entry (read only)', async (_label, actor) => {
    await expect(branchWasteService.reverse(actor as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.findLog).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('refuses the Store Attendant (not a department of a branch)', async () => {
    await expect(branchWasteService.reverse(attendant as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_DEPARTMENT' });
  });

  it('a second reversal is 409 ALREADY_REVERSED, for a member and for the Branch Manager', async () => {
    vi.mocked(repo.findLog).mockResolvedValue(stamped());
    await expect(branchWasteService.reverse(member as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_REVERSED' });
    await expect(branchWasteService.reverse(branchManager as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_REVERSED' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('a race is settled under the row lock: the entry another person just reversed is ALREADY_REVERSED, nothing posted', async () => {
    vi.mocked(repo.findLog).mockResolvedValueOnce(logRow()).mockResolvedValueOnce(stamped());
    await expect(branchWasteService.reverse(member as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_REVERSED' });
    expect(repo.lockLog).toHaveBeenCalledTimes(1);
    expect(postStockMovement).not.toHaveBeenCalled();
    expect(repo.stampReversal).not.toHaveBeenCalled();
  });

  it('refuses when the entry has no stock movement to reverse (404), stamping nothing', async () => {
    vi.mocked(repo.findWasteLedgerRow).mockResolvedValue(null);
    await expect(branchWasteService.reverse(member as never, ID, body, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.stampReversal).not.toHaveBeenCalled();
  });

  it('does not stamp the entry when the door refuses the reversing row', async () => {
    vi.mocked(postStockMovement).mockRejectedValue(new Error('already reversed in the ledger'));
    await expect(branchWasteService.reverse(member as never, ID, body, NOW)).rejects.toThrow('already reversed');
    expect(repo.stampReversal).not.toHaveBeenCalled();
  });
});
