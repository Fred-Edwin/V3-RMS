import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { readCountDetail } from '../_shared/count-detail-reader';
import { longestWithoutCount } from '../_shared/count-reads';
import { COUNT_STOCK_FIGURE_KEYS, countsListSchema, countsSummarySchema, flaggedListSchema, repeatShortfallListSchema } from '../_shared/counting-contract';
import { count, hubId, line } from '../_shared/count-fixtures';
import { countsRepository, type CountListRow, type SummaryFacts } from './counts-repository';
import { countsService } from './counts-service';
import { differencesText } from './counts-view';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../_shared/count-detail-reader', () => ({ readCountDetail: vi.fn() }));
vi.mock('../_shared/count-reads', () => ({ longestWithoutCount: vi.fn() }));
vi.mock('./counts-repository', () => ({
  countsRepository: { list: vi.fn(), chipCounts: vi.fn(), unsectionedCount: vi.fn(), summaryFacts: vi.fn(), flagged: vi.fn(), repeatItems: vi.fn(), lastCountsOf: vi.fn(), findById: vi.fn() },
}));

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const person = (id: string, name: string, role: 'STORE_ATTENDANT' | 'STORE_MANAGER') => ({ id, name, role });
const manager = { id: 'u-isabel', role: 'STORE_MANAGER', siteId: hubId } as never;
const admin = { id: 'u-admin', role: 'SYSTEM_ADMIN', siteId: null } as never;
const director = { id: 'u-grace', role: 'DIRECTOR', siteId: hubId } as never;
const accountant = { id: 'u-acc', role: 'ACCOUNTANT', siteId: hubId } as never;
const attendant = { id: 'u-linnet', role: 'STORE_ATTENDANT', siteId: hubId } as never;
const other = { id: 'u-peter', role: 'STORE_ATTENDANT', siteId: hubId } as never;
const now = new Date('2026-10-13T06:00:00Z');

const facts = (over: Partial<SummaryFacts> = {}): SummaryFacts => ({
  waiting: { count: 1, latest: { sectionsText: 'Samrat', signedAt: new Date('2026-10-13T04:42:00Z') } },
  inProgress: { count: 1, first: { sectionsText: 'Summer', counterName: 'Peter Kariuki', counted: 14, total: 28 } },
  exceeded: { lines: 7, netKes: D('-7940') },
  flaggedUnseen: 3,
  repeatShortfalls: 2,
  ...over,
});
const longest = { kind: 'SECTION' as const, refId: 's', name: 'Others', itemCount: 40, sectionName: null, lastCountedAt: new Date('2026-10-07T05:30:00Z') };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubId } as never);
  vi.mocked(countsRepository.summaryFacts).mockResolvedValue(facts());
  vi.mocked(longestWithoutCount).mockResolvedValue([longest]);
  vi.mocked(countsRepository.chipCounts).mockResolvedValue({ all: 5, waiting: 1, inProgress: 1, approved: 3 });
  vi.mocked(countsRepository.unsectionedCount).mockResolvedValue(3);
});

describe('C1 summary', () => {
  it('the Manager’s strip, in the words of Paper step 8', async () => {
    const out = await countsService.summary(manager, {}, now);
    expect(countsSummarySchema.parse(out)).toBeTruthy();
    expect(out.audience).toBe('manager');
    expect(out.kpis).toEqual([
      { key: 'waiting', label: 'WAITING FOR YOU', value: '1', caption: 'Samrat · signed 07:42', tone: 'WARN', filter: 'waiting' },
      { key: 'inProgress', label: 'IN PROGRESS', value: '1', caption: 'Summer · Peter, 14 of 28', tone: 'NEUTRAL', filter: 'inProgress' },
      { key: 'exceeded7d', label: 'EXCEEDED THE RANGE · 7 DAYS', value: '7 lines', caption: 'Net difference −KES 7,940', tone: 'ALERT' },
      { key: 'longest', label: 'LONGEST WITHOUT A COUNT', value: '6 days', caption: 'Others section', tone: 'WARN' },
    ]);
  });

  it('asks for the last seven days', async () => {
    await countsService.summary(manager, {}, now);
    expect(countsRepository.summaryFacts).toHaveBeenCalledWith(hubId, new Date('2026-10-06T06:00:00Z'));
  });

  it('quiet counts read plainly: nothing waiting, nobody counting, nothing exceeded, never counted', async () => {
    vi.mocked(countsRepository.summaryFacts).mockResolvedValue(facts({ waiting: { count: 0, latest: null }, inProgress: { count: 0, first: null }, exceeded: { lines: 0, netKes: D(0) } }));
    vi.mocked(longestWithoutCount).mockResolvedValue([{ ...longest, lastCountedAt: null }]);
    const kpis = (await countsService.summary(manager, {}, now)).kpis;
    expect(kpis.map((k) => [k.value, k.caption, k.tone])).toEqual([
      ['0', 'Nothing waiting', 'NEUTRAL'],
      ['0', 'Nobody is counting', 'NEUTRAL'],
      ['0 lines', 'Net difference KES 0', 'NEUTRAL'],
      ['Never', 'Others section', 'WARN'],
    ]);
  });

  it('the Director gets their own strip by capability, whatever audience they ask for', async () => {
    const out = await countsService.summary(director, { audience: 'manager' }, now);
    expect(out.audience).toBe('director');
    expect(out.kpis.map((k) => [k.key, k.value])).toEqual([['flagged', '3'], ['net7d', '−KES 7,940'], ['repeat', '2 items'], ['longest', '6 days']]);
    expect(out.kpis[0]).toMatchObject({ label: 'FLAGGED TO YOU · NOT SEEN', filter: 'flagged' });
  });

  it('the Accountant and the Branch Manager see the Manager’s strip', async () => {
    expect((await countsService.summary(accountant, {}, now)).audience).toBe('manager');
  });

  it('the System Admin picks: manager by default, director when asked', async () => {
    expect((await countsService.summary(admin, {}, now)).audience).toBe('manager');
    expect((await countsService.summary(admin, { audience: 'director' }, now)).audience).toBe('director');
  });

  it('a caller who is not at the hub and may not read from anywhere is refused', async () => {
    await expect(countsService.summary({ id: 'x', role: 'WAITER', siteId: 'b1' } as never, {}, now)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('C2 list', () => {
  const row = (over: Partial<CountListRow> = {}): CountListRow => ({
    id: 'c1',
    reference: 'CNT-2026-1013',
    status: 'SUBMITTED',
    selfSigned: false,
    counter: person('u-linnet', 'Linnet Wanjiru', 'STORE_ATTENDANT'),
    counterId: 'u-linnet',
    startedAt: new Date('2026-10-13T04:05:00Z'),
    signedAt: new Date('2026-10-13T04:42:00Z'),
    scopeNames: ['Samrat'],
    firstItemNames: [],
    itemsCounted: 36,
    itemsTotal: 37,
    exceeds: 4,
    within: 32,
    recountOf: null,
    ...over,
  });
  const rows = () => [
    row(),
    row({ id: 'c2', reference: 'CNT-2026-1014', status: 'OPEN', signedAt: null, scopeNames: [], firstItemNames: ['Eggs'], itemsCounted: 0, itemsTotal: 1, exceeds: 0, within: 0, counter: person('u-peter', 'Peter Kariuki', 'STORE_ATTENDANT'), counterId: 'u-peter', startedAt: new Date('2026-10-13T06:10:00Z'), recountOf: { id: 'c0', reference: 'CNT-2026-1012' } }),
    row({ id: 'c3', status: 'APPROVED', exceeds: 0, within: 12, selfSigned: true }),
  ];
  const query = { status: 'all' as const, page: 1, pageSize: 50 };

  it('words each row as the table draws it, and validates against the contract', async () => {
    vi.mocked(countsRepository.list).mockResolvedValue({ rows: rows(), total: 3 });
    const out = await countsService.list(manager, query, now);
    expect(countsListSchema.parse({ ...out, rows: out.rows.map((r) => ({ ...r, id: 'c0000000-0000-4000-8000-000000000001', recountOf: r.recountOf ? { ...r.recountOf, id: 'c0000000-0000-4000-8000-000000000002' } : null })) })).toBeTruthy();
    expect(out.rows.map((r) => [r.statusText, r.sectionsText, r.signedText, r.itemsText, r.differencesText])).toEqual([
      ['Waiting for you', 'Samrat', 'Today 07:42', '36', '4 exceed · 32 within'],
      ['In progress', 'Eggs', 'Started 09:10', '0 of 1', 'Not signed yet'],
      ['Signed', 'Samrat', 'Today 07:42', '36', 'All within range'],
    ]);
    expect(out.rows[1]).toMatchObject({ recountOf: { reference: 'CNT-2026-1012' }, mine: false, can: { review: false } });
    expect(out.rows[0]).toMatchObject({ can: { review: true } });
    expect(out.chips).toEqual({ all: 5, waiting: 1, inProgress: 1, approved: 3, unsectioned: 3 });
    expect(out.page).toEqual({ page: 1, pageSize: 50, total: 3 });
  });

  it('only a caller with Review rights gets the Review button; the Director and the Accountant read only', async () => {
    vi.mocked(countsRepository.list).mockResolvedValue({ rows: [row()], total: 1 });
    expect((await countsService.list(director, query, now)).rows[0]!.can.review).toBe(false);
    expect((await countsService.list(accountant, query, now)).rows[0]!.statusText).toBe('Submitted');
  });

  it('passes the status chip, the search and the page through', async () => {
    vi.mocked(countsRepository.list).mockResolvedValue({ rows: [], total: 0 });
    await countsService.list(manager, { status: 'waiting', search: 'samrat', page: 3, pageSize: 25 }, now);
    expect(countsRepository.list).toHaveBeenCalledWith(hubId, { status: 'waiting', search: 'samrat' }, { page: 3, pageSize: 25 });
  });

  it('cuts the list and the chip counts to the Nairobi days asked for, both ends included', async () => {
    vi.mocked(countsRepository.list).mockResolvedValue({ rows: [], total: 0 });
    await countsService.list(manager, { ...query, from: '2026-10-01', to: '2026-10-05' }, now);
    // Nairobi is UTC+3: 1 Oct starts at 30 Sep 21:00 UTC; the cut after 5 Oct is 5 Oct 21:00 UTC.
    const range = { startedFrom: new Date('2026-09-30T21:00:00Z'), startedBefore: new Date('2026-10-05T21:00:00Z') };
    expect(countsRepository.list).toHaveBeenCalledWith(hubId, { status: 'all', ...range }, { page: 1, pageSize: 50 });
    expect(countsRepository.chipCounts).toHaveBeenCalledWith(hubId, undefined, range);
  });

  it('takes a lone From or a lone To', async () => {
    vi.mocked(countsRepository.list).mockResolvedValue({ rows: [], total: 0 });
    await countsService.list(manager, { ...query, from: '2026-10-01' }, now);
    expect(countsRepository.list).toHaveBeenLastCalledWith(hubId, { status: 'all', startedFrom: new Date('2026-09-30T21:00:00Z') }, { page: 1, pageSize: 50 });
    await countsService.list(manager, { ...query, to: '2026-10-01' }, now);
    expect(countsRepository.list).toHaveBeenLastCalledWith(hubId, { status: 'all', startedBefore: new Date('2026-10-01T21:00:00Z') }, { page: 1, pageSize: 50 });
  });

  it('refuses a From after the To instead of answering with an empty list', async () => {
    await expect(countsService.list(manager, { ...query, from: '2026-10-05', to: '2026-10-01' }, now)).rejects.toMatchObject({ statusCode: 400 });
    expect(countsRepository.list).not.toHaveBeenCalled();
  });

  it('differencesText covers every case', () => {
    expect(differencesText({ status: 'OPEN', exceeds: 0, within: 0 })).toBe('Not signed yet');
    expect(differencesText({ status: 'SUBMITTED', exceeds: 2, within: 0 })).toBe('2 exceed · 0 within');
    expect(differencesText({ status: 'APPROVED', exceeds: 0, within: 5 })).toBe('All within range');
    expect(differencesText({ status: 'APPROVED', exceeds: 0, within: 0 })).toBe('No differences');
  });

  it('a row marks the caller’s own count', async () => {
    vi.mocked(countsRepository.list).mockResolvedValue({ rows: [row()], total: 1 });
    expect((await countsService.list({ id: 'u-linnet', role: 'STORE_MANAGER', siteId: hubId } as never, query, now)).rows[0]!.mine).toBe(true);
  });
});

describe('C3 flagged and C4 repeat shortfalls', () => {
  beforeEach(() => {
    vi.mocked(countsRepository.summaryFacts).mockResolvedValue(facts());
  });

  it('flagged lines: difference, value, cause words, who counted, and Mark seen only for those who may and only while unseen', async () => {
    vi.mocked(countsRepository.flagged).mockResolvedValue({
      total: 2,
      rows: [
        { countId: 'c1', countReference: 'CNT-2026-1015', lineId: 'l1', itemName: 'Eggs', unit: 'trays', countedQty: D(3), expectedQty: D(5), unitCost: D(520), cause: 'MISCOUNT', countedBy: person('u-isabel', 'Isabel Njoki', 'STORE_MANAGER'), alert: false, seenAt: null, seenBy: null },
        { countId: 'c1', countReference: 'CNT-2026-1015', lineId: 'l2', itemName: 'Oil', unit: 'L', countedQty: D(1), expectedQty: D(9), unitCost: D(700), cause: null, countedBy: person('u-isabel', 'Isabel Njoki', 'STORE_MANAGER'), alert: true, seenAt: new Date('2026-10-13T05:00:00Z'), seenBy: person('u-grace', 'Grace Wambui', 'STORE_MANAGER') },
      ],
    });
    const out = await countsService.flagged(director, { page: 1, pageSize: 50 });
    expect(flaggedListSchema.shape.chips.parse(out.chips)).toEqual({ flaggedToMe: 3, allCounts: 5, repeatShortfalls: 2 });
    expect(out.rows[0]).toMatchObject({ difference: '-2', differenceValueKes: '-1040.00', cause: 'MISCOUNT', causeText: 'Miscount', can: { markSeen: true }, seenAt: null });
    expect(out.rows[1]).toMatchObject({ difference: '-8', differenceValueKes: '-5600.00', causeText: 'No cause given', alert: true, can: { markSeen: false } });
    expect((await countsService.flagged(accountant, { page: 1, pageSize: 50 })).rows[0]!.can.markSeen).toBe(false);
    expect(out.page).toEqual({ page: 1, pageSize: 50, total: 2 });
  });

  it('repeat shortfalls: the item, its section and its last three counts', async () => {
    vi.mocked(countsRepository.repeatItems).mockResolvedValue({ total: 2, rows: [{ itemId: 'i1', itemName: 'Sugar, white', unit: 'kg', sectionName: 'Samrat', shortRuns: 3 }] });
    vi.mocked(countsRepository.lastCountsOf).mockResolvedValue([
      { itemId: 'i1', countReference: 'CNT-2026-1013', difference: D(-16), at: new Date('2026-10-13T04:42:00Z') },
      { itemId: 'i1', countReference: 'CNT-2026-1011', difference: D(-2), at: new Date('2026-10-11T04:30:00Z') },
      { itemId: 'i2', countReference: 'CNT-X', difference: D(-1), at: new Date('2026-10-11T04:30:00Z') },
    ]);
    const out = await countsService.repeatShortfalls(manager, { page: 2, pageSize: 25 });
    expect(countsRepository.repeatItems).toHaveBeenCalledWith(hubId, { skip: 25, take: 25 });
    expect(out.rows[0]).toMatchObject({ itemName: 'Sugar, white', shortRuns: 3, lastCounts: [{ countReference: 'CNT-2026-1013', difference: '-16' }, { countReference: 'CNT-2026-1011', difference: '-2' }] });
    expect(out.rows[0]!.lastCounts).toHaveLength(2);
    expect(out.chips.repeatShortfalls).toBe(2);
    void repeatShortfallListSchema;
  });
});

describe('C5 one count', () => {
  const found = () => count([line(1)]); // counted by u-linnet
  beforeEach(() => {
    vi.mocked(countsRepository.findById).mockResolvedValue(found());
    vi.mocked(readCountDetail).mockResolvedValue({ id: 'detail' } as never);
  });

  it('every reader may open any count', async () => {
    for (const actor of [manager, admin, director, accountant, { id: 'bm', role: 'MANAGER', siteId: 'b1' }]) {
      expect(await countsService.detail(actor as never, 'c')).toEqual({ id: 'detail' });
    }
  });

  it('the Attendant opens their OWN count', async () => {
    expect(await countsService.detail(attendant, 'c')).toEqual({ id: 'detail' });
    expect(readCountDetail).toHaveBeenCalledWith(attendant, hubId, expect.anything(), expect.any(Date));
  });

  it('another Attendant is told it does not exist: 404, not 403', async () => {
    await expect(countsService.detail(other, 'c')).rejects.toMatchObject({ statusCode: 404 });
    expect(readCountDetail).not.toHaveBeenCalled();
  });

  it('a missing count is 404', async () => {
    vi.mocked(countsRepository.findById).mockResolvedValue(null);
    await expect(countsService.detail(manager, 'c')).rejects.toMatchObject({ statusCode: 404 });
  });
});

void COUNT_STOCK_FIGURE_KEYS;
