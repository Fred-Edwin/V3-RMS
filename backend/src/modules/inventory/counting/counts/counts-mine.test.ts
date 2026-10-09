/**
 * Block 5, the Attendant's front door and history: C31 (home) and C32 (my counts) with mocked repositories, and W3 (the waste
 * list) for the Attendant over a date range. The rules pinned here: own entries only, the default 30-day window, the Nairobi
 * day, the longest-ago section as a date, and that no stock figure or difference appears in any of the three responses.
 */
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { COUNT_STOCK_FIGURE_KEYS, countsHomeSchema, myCountsListSchema } from '../_shared/counting-contract';
import { count, hubId, line } from '../_shared/count-fixtures';
import { longestWithoutCount, type LongestWithoutCount } from '../_shared/count-reads';
import { entriesRepository } from '../../waste/entries/entries-repository';
import { entriesService } from '../../waste/entries/entries-service';
import type { WasteLogRow } from '../../waste/_shared/waste-row';
import { countsRepository, type MyCountListRow } from './counts-repository';
import { countsService } from './counts-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../_shared/count-reads', () => ({ longestWithoutCount: vi.fn() }));
vi.mock('./counts-repository', () => ({
  countsRepository: { findOpenOf: vi.fn(), signedCountOf: vi.fn(), wasteEntriesLogged: vi.fn(), mineList: vi.fn() },
}));
vi.mock('../../waste/entries/entries-repository', () => ({
  entriesRepository: { findPage: vi.fn(), chipCounts: vi.fn(), findLast7: vi.fn(), findReversedLast7: vi.fn(), latestBatchToday: vi.fn(), loggers: vi.fn() },
}));

const attendant = { id: 'u-linnet', role: 'STORE_ATTENDANT', siteId: hubId, name: 'Linnet' } as never;
const manager = { id: 'u-isabel', role: 'STORE_MANAGER', siteId: hubId, name: 'Isabel' } as never;
const admin = { id: 'u-admin', role: 'SYSTEM_ADMIN', siteId: null, name: 'Sam' } as never;
const director = { id: 'u-grace', role: 'DIRECTOR', siteId: hubId, name: 'Grace' } as never;
const branchManager = { id: 'u-bm', role: 'MANAGER', siteId: 'branch-1', name: 'Beth' } as never;
const now = new Date('2026-10-13T06:00:00Z'); // 09:00 Nairobi on 13 Oct

const stockKeys = new Set<string>(COUNT_STOCK_FIGURE_KEYS);
/** Every key at every depth of a response, so a stock figure cannot hide in a nested object. */
const allKeys = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(allKeys) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...allKeys(v)]) : [];
const stockKeysIn = (value: unknown): string[] => allKeys(value).filter((k) => stockKeys.has(k));

const section = (name: string, lastCountedAt: Date | null, n = 1): LongestWithoutCount => ({ kind: 'SECTION', refId: `5e00000${n}-0000-4000-8000-000000000001`, name, itemCount: 12, sectionName: null, lastCountedAt });

const mineRow = (over: Partial<MyCountListRow> = {}): MyCountListRow => ({
  id: 'c0000000-0000-4000-8000-000000000007',
  reference: 'CNT-2026-0007',
  status: 'SUBMITTED',
  selfSigned: false,
  signedAt: new Date('2026-10-13T04:42:00Z'),
  scopeNames: ['Samrat', 'Summer'],
  firstItemNames: [],
  itemCount: 35,
  ...over,
});
const query = { status: 'all' as const, page: 1, pageSize: 50 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubId } as never);
  vi.mocked(countsRepository.findOpenOf).mockResolvedValue(null);
  vi.mocked(countsRepository.signedCountOf).mockResolvedValue(12);
  vi.mocked(countsRepository.wasteEntriesLogged).mockResolvedValue(3);
  vi.mocked(countsRepository.mineList).mockResolvedValue({ rows: [mineRow()], total: 1 });
  vi.mocked(longestWithoutCount).mockResolvedValue([section('Samrat Supermarket', new Date('2026-10-10T06:00:00Z')), section('Others', new Date('2026-10-12T06:00:00Z'), 2)]);
});

describe('C31 GET /counts/home', () => {
  it('answers the contract, for the caller only', async () => {
    const out = await countsService.home(attendant, now);
    expect(countsHomeSchema.parse(out)).toBeTruthy();
    expect(countsRepository.findOpenOf).toHaveBeenCalledWith(hubId, 'u-linnet');
    expect(countsRepository.signedCountOf).toHaveBeenCalledWith(hubId, 'u-linnet');
    expect(out.signedCount).toBe(12);
    expect(out.wasteToday).toBe(3);
  });

  it('the longest-ago section is a name and a date, and no figure', async () => {
    const out = await countsService.home(attendant, now);
    expect(out.sections).toEqual({
      total: 2,
      longestAgo: { id: '5e000001-0000-4000-8000-000000000001', name: 'Samrat Supermarket', lastCountedAt: '2026-10-10T06:00:00.000Z', lastCountedText: '3 days ago' },
    });
    expect(Object.keys(out.sections.longestAgo!).sort()).toEqual(['id', 'lastCountedAt', 'lastCountedText', 'name']);
  });

  it('counts sections only: an item row from the longest-without-count list is not a section', async () => {
    vi.mocked(longestWithoutCount).mockResolvedValue([
      { kind: 'ITEM', refId: 'i1', name: 'Sugar', itemCount: null, sectionName: 'Samrat', lastCountedAt: new Date('2026-09-01T06:00:00Z') },
      section('Samrat', new Date('2026-10-12T06:00:00Z')),
    ]);
    const out = await countsService.home(attendant, now);
    expect(out.sections.total).toBe(1);
    expect(out.sections.longestAgo?.name).toBe('Samrat');
  });

  it('a section never counted says so, with no date', async () => {
    vi.mocked(longestWithoutCount).mockResolvedValue([section('Packaging', null)]);
    expect((await countsService.home(attendant, now)).sections.longestAgo).toMatchObject({ name: 'Packaging', lastCountedAt: null, lastCountedText: 'Never counted' });
  });

  it('no sections at all: longestAgo is null', async () => {
    vi.mocked(longestWithoutCount).mockResolvedValue([]);
    expect((await countsService.home(attendant, now)).sections).toEqual({ total: 0, longestAgo: null });
  });

  it('asks the whole longest-without-count list, so the section total is every section', async () => {
    await countsService.home(attendant, now);
    expect(longestWithoutCount).toHaveBeenCalledWith(hubId, now, Number.MAX_SAFE_INTEGER);
  });

  it('no open count: openCount is null', async () => {
    expect((await countsService.home(attendant, now)).openCount).toBeNull();
  });

  it('the open count carries what Resume needs: id, reference, section, counted and total lines', async () => {
    const open = count([line(1, { countedQty: new Prisma.Decimal(2) }), line(2)], { status: 'OPEN', counterId: 'u-linnet' });
    vi.mocked(countsRepository.findOpenOf).mockResolvedValue(open);
    const out = await countsService.home(attendant, now);
    expect(out.openCount).toEqual({ id: open.id, reference: open.reference, sectionsText: expect.any(String), counted: 1, total: 2, progressText: '1 of 2 counted' });
    expect(out.openCount!.sectionsText.length).toBeGreaterThan(0);
  });

  it('counts today’s waste in the Nairobi day: 00:00 to 24:00 Nairobi, not the UTC day', async () => {
    await countsService.home(attendant, now);
    // 13 Oct Nairobi starts at 12 Oct 21:00 UTC and ends at 13 Oct 21:00 UTC.
    expect(countsRepository.wasteEntriesLogged).toHaveBeenCalledWith(hubId, 'u-linnet', new Date('2026-10-12T21:00:00Z'), new Date('2026-10-13T21:00:00Z'));
    // Just after midnight in Nairobi (21:30 UTC on the 13th) is already the 14th.
    await countsService.home(attendant, new Date('2026-10-13T21:30:00Z'));
    expect(countsRepository.wasteEntriesLogged).toHaveBeenLastCalledWith(hubId, 'u-linnet', new Date('2026-10-13T21:00:00Z'), new Date('2026-10-14T21:00:00Z'));
  });

  it('the Store Manager and the System Admin see their own work only', async () => {
    await countsService.home(manager, now);
    expect(countsRepository.findOpenOf).toHaveBeenLastCalledWith(hubId, 'u-isabel');
    expect(countsRepository.signedCountOf).toHaveBeenLastCalledWith(hubId, 'u-isabel');
    expect(countsRepository.wasteEntriesLogged).toHaveBeenLastCalledWith(hubId, 'u-isabel', expect.any(Date), expect.any(Date));
    await countsService.home(admin, now);
    expect(countsRepository.signedCountOf).toHaveBeenLastCalledWith(hubId, 'u-admin');
  });

  it('someone outside the hub who may only read it from elsewhere is refused (a write-side actor check)', async () => {
    await expect(countsService.home(branchManager, now)).rejects.toMatchObject({ statusCode: 403 });
    expect(countsRepository.signedCountOf).not.toHaveBeenCalled();
  });

  it('carries no stock figure or difference key at any depth', async () => {
    vi.mocked(countsRepository.findOpenOf).mockResolvedValue(count([line(1, { countedQty: new Prisma.Decimal(2), expectedQty: new Prisma.Decimal(9), result: 'EXCEEDS' })], { status: 'OPEN', counterId: 'u-linnet' }));
    for (const actor of [attendant, manager, admin]) expect(stockKeysIn(await countsService.home(actor, now))).toEqual([]);
  });
});

describe('C32 GET /counts/mine', () => {
  it('answers the contract and words the row as Paper step 53 draws it', async () => {
    const out = await countsService.mine(attendant, query, now);
    expect(myCountsListSchema.parse(out)).toBeTruthy();
    expect(out.rows[0]).toEqual({
      id: 'c0000000-0000-4000-8000-000000000007',
      reference: 'CNT-2026-0007',
      status: 'SUBMITTED',
      statusText: 'Waiting for review',
      sectionsText: 'Samrat, Summer',
      itemCount: 35,
      signedAt: '2026-10-13T04:42:00.000Z',
      signedText: 'Today 07:42',
    });
  });

  it('asks the repository for the caller’s own counts only, whoever the caller is', async () => {
    for (const [actor, id] of [[attendant, 'u-linnet'], [manager, 'u-isabel'], [admin, 'u-admin']] as const) {
      await countsService.mine(actor, query, now);
      expect(countsRepository.mineList).toHaveBeenLastCalledWith(hubId, id, expect.anything(), expect.anything());
    }
  });

  it('a Director, who may read every count, still has no counts of their own to list through this door', async () => {
    // The route gate (counts.record) keeps the Director out; the service never widens a caller to other people's counts either way.
    await countsService.mine(director, query, now);
    expect(countsRepository.mineList).toHaveBeenCalledWith(hubId, 'u-grace', expect.anything(), expect.anything());
  });

  it('the default window is the last 30 Nairobi days: from the start of 14 Sep, no upper end', async () => {
    await countsService.mine(attendant, query, now);
    // 13 Oct minus 29 days is 14 Sep; Nairobi starts that day at 13 Sep 21:00 UTC.
    expect(countsRepository.mineList).toHaveBeenCalledWith(hubId, 'u-linnet', { status: 'all', signedFrom: new Date('2026-09-13T21:00:00Z') }, { page: 1, pageSize: 50 });
  });

  it('an explicit range replaces the default, both ends included', async () => {
    await countsService.mine(attendant, { ...query, from: '2026-10-01', to: '2026-10-05' }, now);
    expect(countsRepository.mineList).toHaveBeenCalledWith(
      hubId,
      'u-linnet',
      { status: 'all', signedFrom: new Date('2026-09-30T21:00:00Z'), signedBefore: new Date('2026-10-05T21:00:00Z') },
      { page: 1, pageSize: 50 },
    );
  });

  it('a lone To has no lower end (the default window is only for no range at all); a lone From has no upper end', async () => {
    await countsService.mine(attendant, { ...query, to: '2026-10-05' }, now);
    expect(countsRepository.mineList).toHaveBeenLastCalledWith(hubId, 'u-linnet', { status: 'all', signedBefore: new Date('2026-10-05T21:00:00Z') }, expect.anything());
    await countsService.mine(attendant, { ...query, from: '2026-10-01' }, now);
    expect(countsRepository.mineList).toHaveBeenLastCalledWith(hubId, 'u-linnet', { status: 'all', signedFrom: new Date('2026-09-30T21:00:00Z') }, expect.anything());
  });

  it('refuses a From after the To', async () => {
    await expect(countsService.mine(attendant, { ...query, from: '2026-10-05', to: '2026-10-01' }, now)).rejects.toMatchObject({ statusCode: 400 });
    expect(countsRepository.mineList).not.toHaveBeenCalled();
  });

  it('passes the status chip and the page through; the total comes back as page.total', async () => {
    vi.mocked(countsRepository.mineList).mockResolvedValue({ rows: [mineRow()], total: 12 });
    const out = await countsService.mine(attendant, { status: 'waiting', page: 2, pageSize: 25 }, now);
    expect(countsRepository.mineList).toHaveBeenCalledWith(hubId, 'u-linnet', expect.objectContaining({ status: 'waiting' }), { page: 2, pageSize: 25 });
    expect(out.page).toEqual({ page: 2, pageSize: 25, total: 12 });
  });

  it('an approved count reads "Approved", and a Manager’s own self-signed count reads "Signed"', async () => {
    vi.mocked(countsRepository.mineList).mockResolvedValue({
      rows: [mineRow({ status: 'APPROVED' }), mineRow({ id: 'c0000000-0000-4000-8000-000000000008', status: 'APPROVED', selfSigned: true, scopeNames: [], firstItemNames: ['Eggs', 'Milk'] })],
      total: 2,
    });
    const out = await countsService.mine(manager, query, now);
    expect(out.rows.map((r) => [r.status, r.statusText, r.sectionsText])).toEqual([['APPROVED', 'Approved', 'Samrat, Summer'], ['APPROVED', 'Signed', 'Eggs, Milk']]);
  });

  it('signed text says Today, Yesterday, then the weekday and date', async () => {
    vi.mocked(countsRepository.mineList).mockResolvedValue({
      rows: [mineRow({ signedAt: new Date('2026-10-12T13:10:00Z') }), mineRow({ signedAt: new Date('2026-10-05T13:10:00Z') })],
      total: 2,
    });
    expect((await countsService.mine(attendant, query, now)).rows.map((r) => r.signedText)).toEqual(['Yesterday 16:10', 'Mon 5 Oct 16:10']);
  });

  it('an empty history is an empty page, not an error', async () => {
    vi.mocked(countsRepository.mineList).mockResolvedValue({ rows: [], total: 0 });
    expect(await countsService.mine(attendant, query, now)).toEqual({ rows: [], page: { page: 1, pageSize: 50, total: 0 } });
  });

  it('carries no stock figure or difference key at any depth', async () => {
    for (const actor of [attendant, manager, admin]) expect(stockKeysIn(await countsService.mine(actor, query, now))).toEqual([]);
  });
});

describe('W3 GET /waste for the Attendant, with from and to', () => {
  const log = (): WasteLogRow =>
    ({
      id: 'd0000000-0000-4000-8000-000000000001',
      siteId: hubId,
      locationId: 'store',
      inventoryItemId: '10000000-0000-4000-8000-000000000060',
      quantity: new Prisma.Decimal(3),
      reason: 'EXPIRY',
      note: null,
      unitCost: new Prisma.Decimal(420),
      loggedById: 'u-linnet',
      createdAt: new Date('2026-10-13T08:00:00Z'),
      batchId: 'b1',
      reversedAt: null,
      reversedById: null,
      reversalReason: null,
      reversalNote: null,
      inventoryItem: { id: '10000000-0000-4000-8000-000000000060', name: 'Marinated chicken', usageUnit: 'kg' },
      loggedBy: { id: 'u-linnet', name: 'Linnet Wanjiru', role: 'STORE_ATTENDANT' },
      reversedBy: null,
    }) as unknown as WasteLogRow;
  const wasteQuery = { period: 'today' as const, scope: 'all' as const, page: 1, pageSize: 50 };

  beforeEach(() => {
    vi.mocked(entriesRepository.findPage).mockResolvedValue({ rows: [log()], total: 1 });
    vi.mocked(entriesRepository.chipCounts).mockResolvedValue({ today: 1, last7: 1, reversed: 0 });
    vi.mocked(entriesRepository.findLast7).mockResolvedValue([log()]);
    vi.mocked(entriesRepository.findReversedLast7).mockResolvedValue([]);
    vi.mocked(entriesRepository.latestBatchToday).mockResolvedValue({ at: new Date('2026-10-13T05:00:00Z'), count: 2 });
    vi.mocked(entriesRepository.loggers).mockResolvedValue([{ id: 'u-peter', name: 'Peter Kariuki' }]);
  });

  it('takes from and to, and returns only the Attendant’s own entries, even if they ask for someone else', async () => {
    await entriesService.list(attendant, { ...wasteQuery, from: '2026-10-01', to: '2026-10-13', loggedBy: 'u-peter', scope: 'all' }, now);
    const scope = vi.mocked(entriesRepository.findPage).mock.calls[0]![0];
    const narrow = vi.mocked(entriesRepository.findPage).mock.calls[0]![5];
    expect(scope.loggedById).toBe('u-linnet');
    expect(narrow).toMatchObject({ loggedFrom: new Date('2026-09-30T21:00:00Z'), loggedBefore: new Date('2026-10-13T21:00:00Z') });
    expect(vi.mocked(entriesRepository.chipCounts).mock.calls[0]![0].loggedById).toBe('u-linnet');
  });

  it('carries no stock figure or difference key at any depth, and no "Logged by" list or KPI strip', async () => {
    const out = await entriesService.list(attendant, { ...wasteQuery, from: '2026-10-01', to: '2026-10-13' }, now);
    expect(stockKeysIn(out)).toEqual([]);
    expect(out.kpis).toBeUndefined();
    expect(out.people).toBeUndefined();
  });
});
