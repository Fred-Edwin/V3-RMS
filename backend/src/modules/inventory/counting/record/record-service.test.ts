import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { readCountDetail, readLiveFigures } from '../_shared/count-detail-reader';
import { countNotify } from '../_shared/count-notify';
import { nextCountReference } from '../_shared/count-numbers';
import { countPin } from '../_shared/count-pin';
import { countSettingsRepository } from '../_shared/count-settings-repository';
import { adoptNewItems } from '../_shared/count-sections';
import { settingsInForce } from '../_shared/count-settings';
import { D, count, frozen, hubId, itemIdOf, line, lineIdOf, sectionId1, signedLine, storeId } from '../_shared/count-fixtures';
import { countError } from '../_shared/count-errors';
import { recordRepository } from './record-repository';
import { recordService } from './record-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({ marker: 'tx' }) } }));
vi.mock('../../stock/ledger/ledger-door', () => ({ postStockMovement: vi.fn() }));
vi.mock('../_shared/count-detail-reader', () => ({ readCountDetail: vi.fn(), readLiveFigures: vi.fn() }));
vi.mock('../_shared/count-notify', () => ({ countNotify: { submitted: vi.fn(), directorAlert: vi.fn() } }));
vi.mock('../_shared/count-pin', () => ({ countPin: { verifyOwn: vi.fn() } }));
vi.mock('../_shared/count-settings-repository', () => ({ countSettingsRepository: { find: vi.fn() } }));
vi.mock('../_shared/count-sections', () => ({ adoptNewItems: vi.fn() }));
vi.mock('../_shared/count-numbers', () => ({ nextCountReference: vi.fn() }));
vi.mock('./record-repository', () => ({
  recordRepository: {
    findById: vi.fn(),
    findByStartKey: vi.fn(),
    findOpenOf: vi.fn(),
    findLine: vi.fn(),
    findCentralStore: vi.fn(),
    listSections: vi.fn(),
    listSectionItems: vi.fn(),
    sectionLastCounts: vi.fn(),
    busySections: vi.fn(),
    unsectionedCount: vi.fn(),
    findDayOrder: vi.fn(),
    saveDayOrder: vi.fn(),
    sectionsByIds: vi.fn(),
    scopeItemsById: vi.fn(),
    lockSections: vi.fn(),
    lockCount: vi.fn(),
    busyLines: vi.fn(),
    createCount: vi.fn(),
    onHandAsOf: vi.fn(),
    recentDifferencesByItem: vi.fn(),
    freezeLine: vi.fn(),
    markSigned: vi.fn(),
    saveLine: vi.fn(),
    touchCount: vi.fn(),
    markRecheckOffered: vi.fn(),
  },
}));

const HUB = hubId;
const attendantA = { id: 'u-linnet', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const attendantB = { id: 'u-peter', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const manager = { id: 'u-isabel', role: 'STORE_MANAGER', siteId: HUB } as never;
const branchManager = { id: 'u-bm', role: 'MANAGER', siteId: 'branch-1' } as never;
const now = new Date('2026-10-13T04:42:00Z');
const TX = { marker: 'tx' };
const detail = { id: 'detail' } as never;

const sec = (id: string, name: string, position: number, itemCount = 2) => ({ id, name, kind: 'SUPPLIER' as const, supplierId: `sup-${id}`, supplierName: `${name} Ltd`, position, itemCount });
const placed = (itemId: string, sectionId: string, sectionName: string, position = 0) => ({ itemId, name: `Item ${itemId}`, unit: 'kg', position, sectionId, sectionName });

const key = 'idem-key-0001';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(readCountDetail).mockResolvedValue(detail);
  vi.mocked(adoptNewItems).mockResolvedValue(0);
  vi.mocked(nextCountReference).mockResolvedValue('CNT-2026-0007');
  vi.mocked(recordRepository.findCentralStore).mockResolvedValue({ id: storeId, siteId: HUB });
  vi.mocked(recordRepository.findByStartKey).mockResolvedValue(null);
  vi.mocked(recordRepository.findOpenOf).mockResolvedValue(null);
  vi.mocked(recordRepository.busyLines).mockResolvedValue([]);
  vi.mocked(recordRepository.listSections).mockResolvedValue([sec('s1', 'Samrat', 0), sec('s2', 'Summer', 1), sec('s3', 'Others', 2)]);
  vi.mocked(recordRepository.listSectionItems).mockResolvedValue([placed('i1', 's1', 'Samrat', 0), placed('i2', 's1', 'Samrat', 1), placed('i3', 's2', 'Summer', 0)]);
  vi.mocked(recordRepository.findDayOrder).mockResolvedValue(null);
  vi.mocked(recordRepository.createCount).mockResolvedValue({ id: 'new-count' });
  vi.mocked(recordRepository.findById).mockResolvedValue(count([line(1)]));
  vi.mocked(recordRepository.unsectionedCount).mockResolvedValue(0);
  vi.mocked(recordRepository.sectionLastCounts).mockResolvedValue([]);
  vi.mocked(recordRepository.busySections).mockResolvedValue([]);
  vi.mocked(countSettingsRepository.find).mockResolvedValue(null);
  vi.mocked(countPin.verifyOwn).mockImplementation(async (a) => ({ id: (a as { id: string }).id, name: (a as { id: string }).id === 'u-isabel' ? 'Isabel Njoki' : 'Linnet Wanjiru', role: 'STORE_ATTENDANT', pinHash: 'h' }));
  vi.mocked(recordRepository.onHandAsOf).mockResolvedValue(new Map());
  vi.mocked(recordRepository.recentDifferencesByItem).mockResolvedValue(new Map());
});

describe('C8 start options', () => {
  it('lists the sections in the Manager’s order, with last counted, who, the longest-since tag and who is busy', async () => {
    vi.mocked(recordRepository.sectionLastCounts).mockResolvedValue([
      { sectionId: 's1', at: new Date('2026-10-12T05:30:00Z'), counterName: 'Linnet Wanjiru' },
      { sectionId: 's2', at: new Date('2026-10-07T05:30:00Z'), counterName: 'Peter Kariuki' },
    ]);
    vi.mocked(recordRepository.busySections).mockResolvedValue([{ sectionId: 's3', countId: 'c9', reference: 'CNT-2026-0014', counterName: 'Peter Kariuki' }]);
    const out = await recordService.startOptions(attendantA, {}, now);
    expect(adoptNewItems).toHaveBeenCalledWith(HUB);
    expect(out.sections.map((s) => [s.name, s.lastCountedText, s.lastCountedBy, s.longestSinceCount, s.busy?.counterName ?? null])).toEqual([
      ['Samrat', 'Yesterday', 'Linnet', false, null],
      ['Summer', '6 days ago', 'Peter', false, null],
      ['Others', 'Never', null, true, 'Peter Kariuki'], // never counted is the longest
    ]);
    expect(out.order).toEqual({ mode: 'SHELF', appliesTo: '2026-10-13' });
    expect(out.can).toEqual({ start: true });
    expect(out.openCount).toBeNull();
  });

  it('uses this person’s own order for today when they set one', async () => {
    vi.mocked(recordRepository.findDayOrder).mockResolvedValue(['s3', 's1']);
    const out = await recordService.startOptions(attendantA, {}, now);
    expect(out.sections.map((s) => s.id)).toEqual(['s3', 's1', 's2']);
    expect(out.order.mode).toBe('TODAY');
    expect(recordRepository.findDayOrder).toHaveBeenCalledWith(HUB, 'u-linnet', '2026-10-13');
  });

  it('shows their open count so the screen can resume it, and refuses a new start', async () => {
    vi.mocked(recordRepository.findOpenOf).mockResolvedValue(count([line(1, { countedQty: D(3) }), line(2)]));
    const out = await recordService.startOptions(attendantA, {}, now);
    expect(out.openCount).toEqual({ id: expect.any(String), reference: 'CNT-2026-0007', sectionsText: 'Samrat', progressText: '1 of 2 counted' });
    expect(out.can.start).toBe(false);
  });

  it('only the longest section is tagged, and an empty section never is', async () => {
    vi.mocked(recordRepository.listSections).mockResolvedValue([sec('s1', 'Samrat', 0, 0), sec('s2', 'Summer', 1)]);
    const out = await recordService.startOptions(attendantA, {}, now);
    expect(out.sections.map((s) => s.longestSinceCount)).toEqual([false, true]);
  });

  it('with a recount line it adds the recount banner', async () => {
    vi.mocked(recordRepository.findLine).mockResolvedValue({
      id: lineIdOf(1),
      sectionName: 'Samrat',
      result: 'EXCEEDS',
      inventoryItem: { id: itemIdOf(1), name: 'Eggs', usageUnit: 'trays' },
      count: { id: 'c-old', reference: 'CNT-2026-0012', status: 'SUBMITTED', counterId: 'u-peter' },
    } as never);
    const out = await recordService.startOptions(manager, { recountLineId: lineIdOf(1) }, now);
    expect(out.recount).toEqual({ lineId: lineIdOf(1), countId: 'c-old', countReference: 'CNT-2026-0012', itemId: itemIdOf(1), itemName: 'Eggs', unit: 'trays', sectionName: 'Samrat' });
  });

  it('RECOUNT_NOT_ALLOWED for a line that is not outside the range, or whose count is still open', async () => {
    const base = { id: lineIdOf(1), sectionName: 'Samrat', inventoryItem: { id: itemIdOf(1), name: 'Eggs', usageUnit: 'trays' } };
    vi.mocked(recordRepository.findLine).mockResolvedValue({ ...base, result: 'WITHIN_RANGE', count: { status: 'SUBMITTED' } } as never);
    await expect(recordService.startOptions(manager, { recountLineId: lineIdOf(1) }, now)).rejects.toMatchObject({ statusCode: 422, code: 'RECOUNT_NOT_ALLOWED' });
    vi.mocked(recordRepository.findLine).mockResolvedValue({ ...base, result: 'EXCEEDS', count: { status: 'OPEN' } } as never);
    await expect(recordService.startOptions(manager, { recountLineId: lineIdOf(1) }, now)).rejects.toMatchObject({ code: 'RECOUNT_NOT_ALLOWED' });
    vi.mocked(recordRepository.findLine).mockResolvedValue(null);
    await expect(recordService.startOptions(manager, { recountLineId: lineIdOf(1) }, now)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a caller who is not at the hub', async () => {
    await expect(recordService.startOptions(branchManager, {}, now)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('C9 start a count', () => {
  const start = (input: object = { sectionIds: ['s1'] }) => recordService.start(attendantA, { idempotencyKey: key, ...input } as never, now);

  it('copies one line per item of the picked section in shelf order, under a section lock, and numbers it', async () => {
    const out = await start();
    expect(out).toEqual({ detail, replayed: false });
    expect(recordRepository.lockSections).toHaveBeenCalledWith(TX, HUB, ['s1']);
    expect(recordRepository.createCount).toHaveBeenCalledWith(TX, {
      siteId: HUB,
      locationId: storeId,
      reference: 'CNT-2026-0007',
      counterId: 'u-linnet',
      startedAt: now,
      recountOfLineId: null,
      idempotencyKey: key,
      scopeSections: [{ sectionId: 's1', sectionName: 'Samrat' }],
      lines: [
        { itemId: 'i1', sectionId: 's1', sectionName: 'Samrat' },
        { itemId: 'i2', sectionId: 's1', sectionName: 'Samrat' },
      ],
    });
    expect(adoptNewItems).toHaveBeenCalledWith(HUB);
  });

  it('several sections are counted in this person’s order for today', async () => {
    vi.mocked(recordRepository.findDayOrder).mockResolvedValue(['s2', 's1']);
    await start({ sectionIds: ['s1', 's2'] });
    const data = vi.mocked(recordRepository.createCount).mock.calls[0]![1];
    expect(data.scopeSections.map((s) => s.sectionName)).toEqual(['Summer', 'Samrat']);
    expect(data.lines.map((l) => l.itemId)).toEqual(['i3', 'i1', 'i2']);
  });

  it('an item-scoped count (a recount) is one line per picked item, with no section scope', async () => {
    vi.mocked(recordRepository.scopeItemsById).mockResolvedValue([{ id: 'i1', name: 'Eggs', unit: 'trays', sectionId: 's1', sectionName: 'Samrat' }]);
    await start({ itemIds: ['i1'], sectionIds: undefined });
    const data = vi.mocked(recordRepository.createCount).mock.calls[0]![1];
    expect(data.scopeSections).toEqual([]);
    expect(data.lines).toEqual([{ itemId: 'i1', sectionId: 's1', sectionName: 'Samrat' }]);
  });

  it('a recount line links the new count back, counts that item first and adds sections below', async () => {
    vi.mocked(recordRepository.findLine).mockResolvedValue({ id: lineIdOf(5), result: 'EXCEEDS', inventoryItem: { id: 'i3', name: 'Eggs', usageUnit: 'trays' }, count: { status: 'APPROVED' } } as never);
    vi.mocked(recordRepository.scopeItemsById).mockResolvedValue([{ id: 'i3', name: 'Eggs', unit: 'trays', sectionId: 's2', sectionName: 'Summer' }]);
    await start({ recountOfLineId: lineIdOf(5), sectionIds: ['s1'] });
    const data = vi.mocked(recordRepository.createCount).mock.calls[0]![1];
    expect(data.recountOfLineId).toBe(lineIdOf(5));
    expect(data.lines.map((l) => l.itemId)).toEqual(['i3', 'i1', 'i2']);
    expect(data.scopeSections.map((s) => s.sectionName)).toEqual(['Samrat']);
  });

  it('a repeated idempotency key returns the same count (replayed) and starts nothing', async () => {
    vi.mocked(recordRepository.findByStartKey).mockResolvedValue(count([line(1)]));
    expect(await start()).toEqual({ detail, replayed: true });
    expect(recordRepository.createCount).not.toHaveBeenCalled();
    expect(adoptNewItems).not.toHaveBeenCalled();
  });

  it('YOU_HAVE_OPEN_COUNT when the caller already has one open, and nothing is created', async () => {
    vi.mocked(recordRepository.findOpenOf).mockResolvedValue(count([line(1)]));
    await expect(start()).rejects.toMatchObject({ statusCode: 409, code: 'YOU_HAVE_OPEN_COUNT', details: { reference: 'CNT-2026-0007' } });
    expect(recordRepository.createCount).not.toHaveBeenCalled();
  });

  it('SECTION_BUSY when an item is in someone else’s open count, naming who', async () => {
    vi.mocked(recordRepository.busyLines).mockResolvedValue([{ itemId: 'i2', countId: 'c9', reference: 'CNT-2026-0014', counterName: 'Peter Kariuki' }]);
    await expect(start()).rejects.toMatchObject({
      statusCode: 409,
      code: 'SECTION_BUSY',
      message: 'Peter is counting Samrat right now.',
      details: { countId: 'c9', reference: 'CNT-2026-0014', counterName: 'Peter Kariuki' },
    });
    expect(recordRepository.createCount).not.toHaveBeenCalled();
  });

  it('NOTHING_TO_COUNT when the picked sections hold no items', async () => {
    vi.mocked(recordRepository.listSectionItems).mockResolvedValue([]);
    await expect(start()).rejects.toMatchObject({ statusCode: 422, code: 'NOTHING_TO_COUNT' });
  });

  it('an unknown section is 404, and a retired item is ITEM_NOT_IN_SETUP', async () => {
    await expect(start({ sectionIds: ['s9'] })).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(recordRepository.scopeItemsById).mockResolvedValue([]);
    await expect(start({ itemIds: ['gone'], sectionIds: undefined })).rejects.toMatchObject({ statusCode: 404, code: 'ITEM_NOT_IN_SETUP' });
  });

  it('RECOUNT_NOT_ALLOWED for a recount line that is not outside the range', async () => {
    vi.mocked(recordRepository.findLine).mockResolvedValue({ id: lineIdOf(5), result: 'MATCHES', inventoryItem: { id: 'i3', name: 'x', usageUnit: 'kg' }, count: { status: 'APPROVED' } } as never);
    await expect(start({ recountOfLineId: lineIdOf(5) })).rejects.toMatchObject({ statusCode: 422, code: 'RECOUNT_NOT_ALLOWED' });
  });

  it('a unique-index race: the one who lost is answered as if we had checked (open count, busy section, same key)', async () => {
    const p2002 = (target: string) => new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x', meta: { target } });

    vi.mocked(recordRepository.createCount).mockRejectedValueOnce(p2002('count_open_per_counter_key'));
    vi.mocked(recordRepository.findOpenOf).mockResolvedValueOnce(null).mockResolvedValueOnce(count([line(1)]));
    await expect(start()).rejects.toMatchObject({ code: 'YOU_HAVE_OPEN_COUNT' });

    vi.mocked(recordRepository.createCount).mockRejectedValueOnce(p2002('count_line_open_item_key'));
    vi.mocked(recordRepository.busyLines).mockResolvedValueOnce([]).mockResolvedValueOnce([{ itemId: 'i1', countId: 'c9', reference: 'CNT-2026-0014', counterName: 'Peter Kariuki' }]);
    await expect(start()).rejects.toMatchObject({ code: 'SECTION_BUSY' });

    vi.mocked(recordRepository.createCount).mockRejectedValueOnce(p2002('counts_organization_id_counter_id_idempotency_key_key'));
    vi.mocked(recordRepository.findByStartKey).mockResolvedValueOnce(null).mockResolvedValueOnce(count([line(1)]));
    expect(await start()).toEqual({ detail, replayed: true });
  });

  it('an unrelated database error is not swallowed', async () => {
    vi.mocked(recordRepository.createCount).mockRejectedValueOnce(new Error('connection lost'));
    await expect(start()).rejects.toThrow('connection lost');
  });

  it('a caller who is not at the hub is refused', async () => {
    await expect(recordService.start(branchManager, { idempotencyKey: key, sectionIds: ['s1'] } as never, now)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('who may touch a count (C10 to C13)', () => {
  it('someone else’s count: 403 NOT_YOUR_COUNT for a caller who reads counts, 404 for one who does not', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count([line(1)])); // counted by u-linnet
    await expect(recordService.saveLines(manager, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '1', skipped: false }] }, now)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_COUNT' });
    await expect(recordService.saveLines(attendantB, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '1', skipped: false }] }, now)).rejects.toMatchObject({ statusCode: 404 });
    await expect(recordService.check(attendantB, 'c', {})).rejects.toMatchObject({ statusCode: 404 });
    await expect(recordService.signPreview(attendantB, 'c')).rejects.toMatchObject({ statusCode: 404 });
    await expect(recordService.sign(attendantB, 'c', { pin: '1234', idempotencyKey: key }, now)).rejects.toMatchObject({ statusCode: 404 });
    await expect(recordService.sign(manager, 'c', { pin: '1234', idempotencyKey: key }, now)).rejects.toMatchObject({ code: 'NOT_YOUR_COUNT' });
  });

  it('a count that does not exist is 404', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(null);
    await expect(recordService.signPreview(attendantA, 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a signed count cannot be saved, checked or previewed: COUNT_NOT_OPEN', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count([signedLine(1, 3, 5, 'EXCEEDS')], { status: 'SUBMITTED' }));
    await expect(recordService.saveLines(attendantA, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '1', skipped: false }] }, now)).rejects.toMatchObject({ statusCode: 409, code: 'COUNT_NOT_OPEN' });
    await expect(recordService.check(attendantA, 'c', {})).rejects.toMatchObject({ code: 'COUNT_NOT_OPEN' });
    await expect(recordService.signPreview(attendantA, 'c')).rejects.toMatchObject({ code: 'COUNT_NOT_OPEN' });
    expect(recordRepository.saveLine).not.toHaveBeenCalled();
  });
});

describe('C10 save numbers', () => {
  const open = () => count([line(1), line(2, { countedQty: D(5) }), line(3, { skipped: true })]);

  it('saves each line under the count lock, in one transaction, and stamps the save time', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(open());
    vi.mocked(readLiveFigures).mockResolvedValue({ expected: new Map(), settings: settingsInForce(null) });
    const result = await recordService.saveLines(
      attendantA,
      'c',
      { lines: [{ lineId: lineIdOf(1), countedQty: '4', skipped: false }, { lineId: lineIdOf(2), countedQty: null, skipped: true }, { lineId: lineIdOf(3), countedQty: '0', skipped: false }] },
      now,
    );
    expect(recordRepository.lockCount).toHaveBeenCalledWith(TX, HUB, 'c');
    expect(vi.mocked(recordRepository.saveLine).mock.calls.map(([, id, data]) => [id, data.countedQty?.toString() ?? null, data.skipped])).toEqual([
      [lineIdOf(1), '4', false],
      [lineIdOf(2), null, true],
      [lineIdOf(3), '0', false],
    ]);
    expect(recordRepository.touchCount).toHaveBeenCalledWith(TX, 'c', now);
    expect(result.savedAt).toBe(now.toISOString());
  });

  it('the Attendant gets progress only and the service never reads live figures for them', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(open());
    const result = await recordService.saveLines(attendantA, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '4', skipped: false }] }, now);
    expect(result.lines).toBeUndefined();
    expect(readLiveFigures).not.toHaveBeenCalled();
  });

  it('a line sent twice: the last one wins', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(open());
    await recordService.saveLines(attendantA, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '4', skipped: false }, { lineId: lineIdOf(1), countedQty: '9', skipped: false }] }, now);
    expect(recordRepository.saveLine).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordRepository.saveLine).mock.calls[0]![2].countedQty?.toString()).toBe('9');
  });

  it('a line that is not in this count is refused and nothing is saved', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(open());
    await expect(recordService.saveLines(attendantA, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '1', skipped: false }, { lineId: lineIdOf(9), countedQty: '1', skipped: false }] }, now)).rejects.toMatchObject({ statusCode: 400 });
    expect(recordRepository.saveLine).not.toHaveBeenCalled();
  });

  it('the recheck answers an offered line once: the first number is kept', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count([line(1, { countedQty: D(162), recheckOffered: true })]));
    await recordService.saveLines(attendantA, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '164', skipped: false, recheck: 'RECOUNTED' }] }, now);
    expect(vi.mocked(recordRepository.saveLine).mock.calls[0]![2]).toMatchObject({ countedQty: D(164), recheck: 'RECOUNTED', firstCountedQty: D(162) });
  });

  it('a recheck for a line that was never offered is refused', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count([line(1, { countedQty: D(162) })]));
    await expect(recordService.saveLines(attendantA, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '164', skipped: false, recheck: 'RECOUNTED' }] }, now)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('the counting Manager also gets the live result of the lines she saved (Paper step 13)', async () => {
    const own = count([line(1, { countedQty: D(164), currentCost: 183 })], { counterId: 'u-isabel' });
    vi.mocked(recordRepository.findById).mockResolvedValue(own);
    vi.mocked(readLiveFigures).mockResolvedValue({ expected: new Map([[itemIdOf(1), D(180)]]), settings: settingsInForce(null) });
    const result = await recordService.saveLines(manager, 'c', { lines: [{ lineId: lineIdOf(1), countedQty: '164', skipped: false }] }, now);
    expect(result.lines).toEqual([{ lineId: lineIdOf(1), result: 'EXCEEDS', difference: '-16', differenceValueKes: '-2928.00' }]);
  });
});

describe('C11 the section-end check', () => {
  // Sugar 164 of 180 at KES 183 exceeds; Rice 99 of 100 is within; Tea has no number.
  const lines = () => [line(1, { name: 'Sugar, white', currentCost: 183, countedQty: D(164) }), line(2, { name: 'Rice', countedQty: D(99) }), line(3, { name: 'Tea' })];
  beforeEach(() => {
    vi.mocked(readLiveFigures).mockResolvedValue({ expected: new Map([[itemIdOf(1), D(180)], [itemIdOf(2), D(100)], [itemIdOf(3), D(9)]]), settings: settingsInForce(null) });
  });

  it('returns the exceeding lines by name and typed number only, and marks them offered', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count(lines()));
    const out = await recordService.check(attendantA, 'c', { sectionId: sectionId1 });
    expect(out).toEqual({
      items: [{ lineId: lineIdOf(1), itemName: 'Sugar, white', unit: 'kg', sectionName: 'Samrat', counted: '164' }],
      text: 'Samrat done. Check 1 item again?',
    });
    expect(recordRepository.markRecheckOffered).toHaveBeenCalledWith(HUB, [lineIdOf(1)]);
  });

  it('offers a line once: one already offered or answered is not returned again', async () => {
    const done = count([line(1, { countedQty: D(164), currentCost: 183, recheckOffered: true }), line(2, { countedQty: D(1), recheck: 'KEPT', recheckOffered: true })]);
    vi.mocked(recordRepository.findById).mockResolvedValue(done);
    expect(await recordService.check(attendantA, 'c', {})).toEqual({ items: [], text: 'Nothing to check again. Carry on.' });
    expect(recordRepository.markRecheckOffered).toHaveBeenCalledWith(HUB, []);
  });

  it('a caller who sees stock figures (the counting Manager) gets none and nothing is marked', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count(lines(), { counterId: 'u-isabel' }));
    expect(await recordService.check(manager, 'c', {})).toEqual({ items: [], text: 'Nothing to check again. Carry on.' });
    expect(recordRepository.markRecheckOffered).not.toHaveBeenCalled();
    expect(readLiveFigures).not.toHaveBeenCalled();
  });

  it('judged against the settings in force NOW: a tighter range offers the within-range line too', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count(lines()));
    vi.mocked(readLiveFigures).mockResolvedValue({ expected: new Map([[itemIdOf(1), D(180)], [itemIdOf(2), D(100)]]), settings: { ...settingsInForce(null), rangeKes: 50 } });
    const out = await recordService.check(attendantA, 'c', {});
    expect(out.items.map((i) => i.itemName)).toEqual(['Sugar, white', 'Rice']);
  });

  it('only the asked section is checked, and a section that is not in this count is refused', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count([line(1, { countedQty: D(164), currentCost: 183, sectionId: 's1', sectionName: 'Samrat' }), line(2, { countedQty: D(1), currentCost: 1000, sectionId: 's2', sectionName: 'Summer' })]));
    vi.mocked(readLiveFigures).mockResolvedValue({ expected: new Map([[itemIdOf(1), D(180)], [itemIdOf(2), D(50)]]), settings: settingsInForce(null) });
    expect((await recordService.check(attendantA, 'c', { sectionId: 's2' })).items.map((i) => i.itemName)).toEqual(['Item 2']);
    await expect(recordService.check(attendantA, 'c', { sectionId: 'nope' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('C12 sign preview', () => {
  it('an Attendant gets items, zeros and skips', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count([line(1, { countedQty: D(0) }), line(2, { countedQty: D(4) }), line(3, { skipped: true })]));
    expect(await recordService.signPreview(attendantA, 'c')).toEqual({ itemCount: 3, zero: 1, skipped: 1 });
    expect(readLiveFigures).not.toHaveBeenCalled();
  });

  it('a Manager counting her own also gets what applies and the causes still needed', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count([line(1, { countedQty: D(164), currentCost: 183 })], { counterId: 'u-isabel' }));
    vi.mocked(readLiveFigures).mockResolvedValue({ expected: new Map([[itemIdOf(1), D(180)]]), settings: settingsInForce(null) });
    const preview = await recordService.signPreview(manager, 'c');
    expect(preview.figures?.causesNeeded).toEqual([lineIdOf(1)]);
  });
});

describe('C13 sign', () => {
  const sign = (actor: never, over: object = {}) => recordService.sign(actor, 'c', { pin: '1234', idempotencyKey: 'sign-key-0001', ...over } as never, now);

  // Sugar 164 of 180 at KES 183 (outside), Rice 99 of 100 (within), Oil 40 of 40 (matches), Tea skipped.
  const lines = () => [
    line(1, { name: 'Sugar, white', currentCost: 183, countedQty: D(164) }),
    line(2, { name: 'Rice', countedQty: D(99) }),
    line(3, { name: 'Oil', countedQty: D(40) }),
    line(4, { name: 'Tea', skipped: true }),
  ];
  const stock = new Map([[itemIdOf(1), D(180)], [itemIdOf(2), D(100)], [itemIdOf(3), D(40)], [itemIdOf(4), D(7)]]);
  const signed = (over = {}) => count([signedLine(1, 164, 180, 'EXCEEDS')], { status: 'SUBMITTED', signedAt: now, ...frozen, ...over });

  beforeEach(() => {
    vi.mocked(recordRepository.onHandAsOf).mockResolvedValue(stock);
    vi.mocked(recordRepository.markSigned).mockResolvedValue(undefined);
  });

  describe('an Attendant', () => {
    beforeEach(() => {
      vi.mocked(recordRepository.findById).mockResolvedValueOnce(count(lines())).mockResolvedValueOnce(count(lines())).mockResolvedValue(signed());
    });

    it('freezes every line, freezes the settings on the count, and makes it SUBMITTED', async () => {
      const out = await sign(attendantA);
      expect(out).toEqual({ detail, replayed: false });
      expect(countPin.verifyOwn).toHaveBeenCalledWith(attendantA, '1234');
      expect(recordRepository.lockCount).toHaveBeenCalledWith(TX, HUB, 'c');
      expect(recordRepository.onHandAsOf).toHaveBeenCalledWith(HUB, storeId, [itemIdOf(1), itemIdOf(2), itemIdOf(3), itemIdOf(4)], now, TX);
      expect(vi.mocked(recordRepository.freezeLine).mock.calls.map(([, id, f]) => [id, f.expectedQty.toString(), f.result])).toEqual([
        [lineIdOf(1), '180', 'EXCEEDS'],
        [lineIdOf(2), '100', 'WITHIN_RANGE'],
        [lineIdOf(3), '40', 'MATCHES'],
        [lineIdOf(4), '7', 'NOT_COUNTED'],
      ]);
      expect(recordRepository.markSigned).toHaveBeenCalledWith(TX, 'c', expect.objectContaining({
        status: 'SUBMITTED',
        signedAt: now,
        selfSigned: false,
        approverId: null,
        approvedAt: null,
        idempotencyKey: 'idem-key-0001|sign-key-0001', // the start key, then the sign key
      }));
    });

    it('writes nothing to the ledger and tells the Store Manager', async () => {
      await sign(attendantA);
      expect(postStockMovement).not.toHaveBeenCalled();
      expect(countNotify.submitted).toHaveBeenCalledWith(HUB, { countId: 'c', reference: 'CNT-2026-0007', counterName: 'Linnet Wanjiru', itemsCounted: 3 });
      expect(countNotify.directorAlert).not.toHaveBeenCalled();
    });
  });

  it('the settings in force are frozen on the count', async () => {
    vi.mocked(countSettingsRepository.find).mockResolvedValue({ reasonRequiredKes: 300, rangePercent: D('8.5'), flagRepeatShortfalls: false, directorAlertKes: 1500 } as never);
    vi.mocked(recordRepository.findById).mockResolvedValueOnce(count(lines())).mockResolvedValueOnce(count(lines())).mockResolvedValue(signed());
    await sign(attendantA);
    expect(recordRepository.markSigned).toHaveBeenCalledWith(TX, 'c', expect.objectContaining({ rangeKes: 300, rangePercent: D('8.5'), directorAlertKes: 1500, flagRepeat: false }));
    expect(recordRepository.recentDifferencesByItem).not.toHaveBeenCalled(); // the streak is off, so the history is not read
  });

  it('keeps the last-saved time as the count’s updatedAt (Counted at 07:41, not the sign time)', async () => {
    const c = count(lines());
    vi.mocked(recordRepository.findById).mockResolvedValueOnce(c).mockResolvedValueOnce(c).mockResolvedValue(signed());
    await sign(attendantA);
    expect(vi.mocked(recordRepository.markSigned).mock.calls[0]![2].lastSavedAt).toEqual(c.updatedAt);
  });

  describe('a Manager signing her own count', () => {
    const causes = [{ lineId: lineIdOf(1), cause: 'PREP_NOT_LOGGED' as const }];
    const own = () => count(lines(), { counterId: 'u-isabel' });
    beforeEach(() => {
      vi.mocked(recordRepository.findById).mockResolvedValueOnce(own()).mockResolvedValueOnce(own()).mockResolvedValue(signed({ status: 'APPROVED' }));
    });

    it('applies every non-zero line through the ledger door, in the same transaction, with the count line as the link', async () => {
      await sign(manager, { causes });
      expect(vi.mocked(postStockMovement).mock.calls.map(([tx, input]) => [tx, input.type, input.inventoryItemId, input.quantity.toString(), input.unitCost.toString(), input.reason, input.userId, input.links])).toEqual([
        [TX, 'ADJUSTMENT', itemIdOf(1), '-16', '183', 'Prep use not logged', 'u-isabel', { countLineId: lineIdOf(1) }],
        [TX, 'ADJUSTMENT', itemIdOf(2), '-1', '100', 'Within range · accepted', 'u-isabel', { countLineId: lineIdOf(2) }],
      ]);
      for (const [, input] of vi.mocked(postStockMovement).mock.calls) expect(input.locationId).toBe(storeId);
    });

    it('is APPROVED and self-signed on the spot, with her as the approver', async () => {
      await sign(manager, { causes });
      expect(recordRepository.markSigned).toHaveBeenCalledWith(TX, 'c', expect.objectContaining({ status: 'APPROVED', selfSigned: true, approverId: 'u-isabel', approvedAt: now, signedAt: now }));
    });

    it('flags the outside-range line to the Director on the line itself, and tells the Directors only when a line reaches the alert amount', async () => {
      await sign(manager, { causes });
      expect(vi.mocked(recordRepository.freezeLine).mock.calls[0]![2]).toMatchObject({ decision: 'WRITE_OFF', cause: 'PREP_NOT_LOGGED', directorFlagged: true });
      expect(countNotify.directorAlert).toHaveBeenCalledWith({ countId: 'c', reference: 'CNT-2026-0007', signerName: 'Isabel Njoki', alertKes: 5000, lines: [] }, now);
      expect(countNotify.submitted).not.toHaveBeenCalled();
    });

    it('a line at or above the alert amount goes in the alert push', async () => {
      vi.mocked(countSettingsRepository.find).mockResolvedValue({ reasonRequiredKes: 500, rangePercent: D(5), flagRepeatShortfalls: true, directorAlertKes: 2928 } as never);
      await sign(manager, { causes });
      expect(countNotify.directorAlert).toHaveBeenCalledWith(expect.objectContaining({ alertKes: 2928, lines: [{ itemName: 'Sugar, white', valueKes: -2928 }] }), now);
    });

    it('CAUSE_REQUIRED (with the lines) when an outside-range line has no cause; nothing is posted or signed', async () => {
      await expect(sign(manager)).rejects.toMatchObject({ statusCode: 422, code: 'CAUSE_REQUIRED', details: { lineIds: [lineIdOf(1)] } });
      expect(postStockMovement).not.toHaveBeenCalled();
      expect(recordRepository.freezeLine).not.toHaveBeenCalled();
      expect(recordRepository.markSigned).not.toHaveBeenCalled();
    });

    it('a failure in the door rolls the whole sign back: the count is never marked signed and no push goes out', async () => {
      vi.mocked(postStockMovement).mockRejectedValueOnce(new Error('door rejected'));
      await expect(sign(manager, { causes })).rejects.toThrow('door rejected');
      expect(recordRepository.markSigned).not.toHaveBeenCalled();
      expect(countNotify.directorAlert).not.toHaveBeenCalled();
    });
  });

  it('INVALID_PIN for a wrong, missing or someone else’s PIN, and nothing is written', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(count(lines()));
    vi.mocked(countPin.verifyOwn).mockRejectedValue(countError('INVALID_PIN', 'That PIN is not right.'));
    await expect(sign(attendantA)).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_PIN' });
    expect(recordRepository.lockCount).not.toHaveBeenCalled();
    expect(recordRepository.freezeLine).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
    expect(countNotify.submitted).not.toHaveBeenCalled();
  });

  it('NOTHING_COUNTED when every line is skipped or untouched', async () => {
    const empty = () => count([line(1), line(2, { skipped: true })]);
    vi.mocked(recordRepository.findById).mockResolvedValueOnce(empty()).mockResolvedValueOnce(empty());
    await expect(sign(attendantA)).rejects.toMatchObject({ statusCode: 422, code: 'NOTHING_COUNTED' });
    expect(recordRepository.markSigned).not.toHaveBeenCalled();
  });

  it('COUNT_NOT_OPEN for a count already signed with another key', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(signed({ idempotencyKey: 'idem-key-0001|some-other-key' }));
    await expect(sign(attendantA)).rejects.toMatchObject({ statusCode: 409, code: 'COUNT_NOT_OPEN' });
    expect(countPin.verifyOwn).not.toHaveBeenCalled();
  });

  it('a retried sign (the same key) returns the signed count again (replayed) and writes nothing', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValue(signed({ idempotencyKey: 'idem-key-0001|sign-key-0001' }));
    expect(await sign(attendantA)).toEqual({ detail, replayed: true });
    expect(countPin.verifyOwn).not.toHaveBeenCalled();
    expect(recordRepository.freezeLine).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
    expect(countNotify.submitted).not.toHaveBeenCalled();
  });

  it('two taps at once: the second finds the count signed under the lock and is answered as a replay', async () => {
    const open = count(lines());
    vi.mocked(recordRepository.findById).mockResolvedValueOnce(open).mockResolvedValueOnce(signed({ idempotencyKey: 'idem-key-0001|sign-key-0001' }));
    expect(await sign(attendantA)).toEqual({ detail, replayed: true });
    expect(recordRepository.freezeLine).not.toHaveBeenCalled();
    expect(countNotify.submitted).not.toHaveBeenCalled();
  });

  it('a pushed failure never fails the sign', async () => {
    vi.mocked(recordRepository.findById).mockResolvedValueOnce(count(lines())).mockResolvedValueOnce(count(lines())).mockResolvedValue(signed());
    vi.mocked(countNotify.submitted).mockRejectedValue(new Error('fcm down'));
    await expect(sign(attendantA)).resolves.toMatchObject({ replayed: false });
  });

  it('a caller who is not at the hub is refused', async () => {
    await expect(recordService.sign(branchManager, 'c', { pin: '1234', idempotencyKey: 'sign-key-0001' } as never, now)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('C14 section order for today', () => {
  it('saves this person’s order for today and answers with the day it applies to', async () => {
    vi.mocked(recordRepository.sectionsByIds).mockResolvedValue([{ id: 's2', name: 'Summer' }, { id: 's1', name: 'Samrat' }]);
    expect(await recordService.setSectionOrder(attendantA, { sectionIds: ['s2', 's1', 's2'] }, now)).toEqual({ sectionIds: ['s2', 's1'], appliesTo: '2026-10-13' });
    expect(recordRepository.saveDayOrder).toHaveBeenCalledWith(HUB, 'u-linnet', '2026-10-13', ['s2', 's1']);
  });

  it('the day is the Nairobi day: 23:30 UTC is already tomorrow', async () => {
    vi.mocked(recordRepository.sectionsByIds).mockResolvedValue([{ id: 's1', name: 'Samrat' }]);
    const late = new Date('2026-10-13T21:30:00Z');
    expect((await recordService.setSectionOrder(attendantA, { sectionIds: ['s1'] }, late)).appliesTo).toBe('2026-10-14');
  });

  it('an unknown section is 404 and nothing is saved', async () => {
    vi.mocked(recordRepository.sectionsByIds).mockResolvedValue([{ id: 's1', name: 'Samrat' }]);
    await expect(recordService.setSectionOrder(attendantA, { sectionIds: ['s1', 's9'] }, now)).rejects.toMatchObject({ statusCode: 404 });
    expect(recordRepository.saveDayOrder).not.toHaveBeenCalled();
  });
});
