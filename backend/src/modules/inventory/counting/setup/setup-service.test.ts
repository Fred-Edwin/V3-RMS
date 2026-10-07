import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { adoptNewItems } from '../_shared/count-sections';
import { setupRepository, type MoveRow, type SectionItemRow, type SectionRow } from './setup-repository';
import { setupService } from './setup-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({ marker: 'tx' }) } }));
vi.mock('../_shared/count-sections', () => ({ adoptNewItems: vi.fn() }));
vi.mock('./setup-repository', () => ({
  setupRepository: {
    listSections: vi.fn(),
    listPlacedItems: vi.fn(),
    unsectionedItems: vi.fn(),
    lockLayout: vi.fn(),
    lastVisit: vi.fn(),
    stampVisit: vi.fn(),
    movesSince: vi.fn(),
    latestMoveByItem: vi.fn(),
    findMove: vi.fn(),
    findSection: vi.fn(),
    nameTaken: vi.fn(),
    createSection: vi.fn(),
    liveItems: vi.fn(),
    placementsOf: vi.fn(),
    nextItemPosition: vi.fn(),
    insertPlacements: vi.fn(),
    deletePlacement: vi.fn(),
    rewritePlacements: vi.fn(),
    rewriteSectionPositions: vi.fn(),
    createMoves: vi.fn(),
    createMove: vi.fn(),
    markUndone: vi.fn(),
    lastCountedByItem: vi.fn(),
    listAddable: vi.fn(),
  },
}));

const HUB = 'hub-1';
const manager = { id: 'sm', role: 'STORE_MANAGER', siteId: HUB } as never;
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;
const branchManager = { id: 'bm', role: 'MANAGER', siteId: 'branch-1' } as never;
const now = new Date('2026-10-13T06:00:00Z');

const section = (id: string, name: string, position: number, kind: SectionRow['kind'] = 'SUPPLIER', itemCount = 0): SectionRow => ({
  id,
  name,
  kind,
  supplierId: kind === 'SUPPLIER' ? `sup-${id}` : null,
  supplierName: kind === 'SUPPLIER' ? `${name} Ltd` : null,
  position,
  itemCount,
});
const placed = (itemId: string, sectionId: string, sectionName: string, position: number): SectionItemRow => ({ itemId, name: `Item ${itemId}`, unit: 'kg', position, sectionId, sectionName });
const move = (over: Partial<MoveRow> = {}): MoveRow => ({
  id: 'm1',
  itemId: 'i1',
  itemName: 'Rice, 25 kg bag',
  fromSectionId: 's2',
  fromSectionName: 'Summer',
  toSectionId: 's3',
  toSectionName: 'Others',
  movedBy: { id: 'att', name: 'Linnet Wanjiru', role: 'STORE_ATTENDANT' },
  movedAt: new Date('2026-10-13T04:12:00Z'),
  undoneAt: null,
  ...over,
});

/** s1 Samrat [i1, i2], s2 Summer [i3], s3 Others [] and i4 in no section. */
const layout = () => {
  vi.mocked(setupRepository.listSections).mockResolvedValue([section('s1', 'Samrat', 0, 'SUPPLIER', 2), section('s2', 'Summer', 1, 'SUPPLIER', 1), section('s3', 'Others', 2, 'MANUAL', 0)]);
  vi.mocked(setupRepository.listPlacedItems).mockResolvedValue([placed('i1', 's1', 'Samrat', 0), placed('i2', 's1', 'Samrat', 1), placed('i3', 's2', 'Summer', 0)]);
  vi.mocked(setupRepository.unsectionedItems).mockResolvedValue([{ id: 'i4', name: 'Oat milk', unit: 'cartons' }]);
};
const version = async () => (await setupService.view(manager, now)).version;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(adoptNewItems).mockResolvedValue(0);
  layout();
  vi.mocked(setupRepository.lastVisit).mockResolvedValue(new Date('2026-10-12T06:00:00Z'));
  vi.mocked(setupRepository.movesSince).mockResolvedValue([]);
  vi.mocked(setupRepository.nameTaken).mockResolvedValue(false);
  vi.mocked(setupRepository.liveItems).mockImplementation(async (_s, ids) => ids.map((id) => ({ id, name: `Item ${id}`, unit: 'kg' })));
  vi.mocked(setupRepository.placementsOf).mockResolvedValue(new Map());
  vi.mocked(setupRepository.nextItemPosition).mockResolvedValue(0);
  vi.mocked(setupRepository.latestMoveByItem).mockResolvedValue(new Map());
  vi.mocked(setupRepository.lastCountedByItem).mockResolvedValue([]);
  vi.mocked(setupRepository.markUndone).mockResolvedValue(true);
});

describe('C15 view', () => {
  it('places new supplier items first, then reads, then stamps the visit', async () => {
    const calls: string[] = [];
    vi.mocked(adoptNewItems).mockImplementation(async () => (calls.push('adopt'), 0));
    vi.mocked(setupRepository.listSections).mockImplementation(async () => (calls.push('read'), [section('s1', 'Samrat', 0)]));
    vi.mocked(setupRepository.stampVisit).mockImplementation(async () => void calls.push('stamp'));
    await setupService.view(manager, now);
    expect(calls).toEqual(['adopt', 'read', 'stamp']);
    expect(setupRepository.stampVisit).toHaveBeenCalledWith(HUB, 'sm', now);
  });

  it('lists the sections in shelf order, the unsectioned count, and moves by others since the last visit', async () => {
    vi.mocked(setupRepository.movesSince).mockResolvedValue([move()]);
    const view = await setupService.view(manager, now);
    expect(view.sections.map((s) => [s.name, s.itemCount, s.kind, s.tagText])).toEqual([
      ['Samrat', 2, 'SUPPLIER', null],
      ['Summer', 1, 'SUPPLIER', null],
      ['Others', 0, 'MANUAL', 'manual section'],
    ]);
    expect(view.unsectioned).toEqual({ count: 1, text: '1 new item · never counted until placed' });
    expect(view.movedText).toBe('1 item moved by the Attendant since your last visit.');
    expect(view.movedSinceLastVisit[0]).toMatchObject({ text: 'Moved here from Summer by Linnet · 13 Oct 07:12', can: { undo: true }, undone: false });
    expect(setupRepository.movesSince).toHaveBeenCalledWith(HUB, new Date('2026-10-12T06:00:00Z'), 'sm');
    expect(view.can).toEqual({ edit: true });
  });

  it('a first visit looks back seven days', async () => {
    vi.mocked(setupRepository.lastVisit).mockResolvedValue(null);
    await setupService.view(manager, now);
    expect(setupRepository.movesSince).toHaveBeenCalledWith(HUB, new Date('2026-10-06T06:00:00Z'), 'sm');
  });

  it('a reader without the setup right sees it read-only, and cannot undo', async () => {
    vi.mocked(setupRepository.movesSince).mockResolvedValue([move()]);
    const view = await setupService.view(accountant, now);
    expect(view.can).toEqual({ edit: false });
    expect(view.movedSinceLastVisit[0]!.can.undo).toBe(false);
  });

  it('nothing unsectioned says so; several roles moving things says only how many', async () => {
    vi.mocked(setupRepository.unsectionedItems).mockResolvedValue([]);
    vi.mocked(setupRepository.movesSince).mockResolvedValue([move(), move({ id: 'm2', movedBy: { id: 'x', name: 'Ann Mutua', role: 'STORE_MANAGER' } })]);
    const view = await setupService.view(manager, now);
    expect(view.unsectioned.text).toBe('Every item is in a section');
    expect(view.movedText).toBe('2 items moved since your last visit.');
  });

  it('the version changes when an item moves', async () => {
    const before = await version();
    vi.mocked(setupRepository.listPlacedItems).mockResolvedValue([placed('i1', 's2', 'Summer', 0), placed('i2', 's1', 'Samrat', 1), placed('i3', 's2', 'Summer', 1)]);
    expect(await version()).not.toBe(before);
  });

  it('the Branch Manager reads the hub’s setup from their own branch (read-only), always the hub’s, never their own site’s', async () => {
    await expect(setupService.view(branchManager, now)).resolves.toMatchObject({ can: { edit: false } });
    expect(setupRepository.listSections).toHaveBeenLastCalledWith(HUB, expect.anything());
  });
});

describe('C16 one section’s items', () => {
  it('lists a section’s items with last counted, amber when five days or more, and the standing move', async () => {
    vi.mocked(setupRepository.findSection).mockResolvedValue({ id: 's3', name: 'Others', kind: 'MANUAL' });
    vi.mocked(setupRepository.listPlacedItems).mockResolvedValue([placed('i1', 's3', 'Others', 0), placed('i2', 's3', 'Others', 1), placed('i3', 's3', 'Others', 2)]);
    vi.mocked(setupRepository.lastCountedByItem).mockResolvedValue([
      { itemId: 'i1', at: new Date('2026-10-13T02:00:00Z'), reference: 'CNT-2026-0001' },
      { itemId: 'i2', at: new Date('2026-10-07T05:00:00Z'), reference: 'CNT-2026-0001' },
    ]);
    vi.mocked(setupRepository.latestMoveByItem).mockResolvedValue(new Map([['i1', move({ itemId: 'i1', toSectionId: 's3' })]]));
    const out = await setupService.sectionItems(manager, 's3', now);
    expect(out.section).toEqual({ id: 's3', name: 'Others', itemCount: 3 });
    expect(out.items.map((i) => [i.itemId, i.lastCountedText, i.stale])).toEqual([
      ['i1', 'Today', false],
      ['i2', '6 days ago', true],
      ['i3', 'Never counted', false],
    ]);
    expect(out.items[0]!.movedHere).toMatchObject({ id: 'm1', text: 'Moved here from Summer by Linnet · 13 Oct 07:12' });
    expect(out.items[1]!.movedHere).toBeNull();
  });

  it('does not show a move that was undone, that went to another section, or that is old', async () => {
    vi.mocked(setupRepository.findSection).mockResolvedValue({ id: 's3', name: 'Others', kind: 'MANUAL' });
    vi.mocked(setupRepository.listPlacedItems).mockResolvedValue([placed('i1', 's3', 'Others', 0), placed('i2', 's3', 'Others', 1), placed('i3', 's3', 'Others', 2)]);
    vi.mocked(setupRepository.latestMoveByItem).mockResolvedValue(
      new Map([
        ['i1', move({ itemId: 'i1', undoneAt: new Date('2026-10-13T05:00:00Z') })],
        ['i2', move({ itemId: 'i2', toSectionId: 's1' })],
        ['i3', move({ itemId: 'i3', movedAt: new Date('2026-09-01T04:12:00Z') })],
      ]),
    );
    const out = await setupService.sectionItems(manager, 's3', now);
    expect(out.items.map((i) => i.movedHere)).toEqual([null, null, null]);
  });

  it('"unsectioned" lists the items in no section', async () => {
    const out = await setupService.sectionItems(manager, 'unsectioned', now);
    expect(out.section).toEqual({ id: 'unsectioned', name: 'Not in any section', itemCount: 1 });
    expect(out.items[0]).toMatchObject({ itemId: 'i4', name: 'Oat milk', unit: 'cartons', lastCountedText: 'Never counted' });
  });

  it('an unknown section is 404', async () => {
    vi.mocked(setupRepository.findSection).mockResolvedValue(null);
    await expect(setupService.sectionItems(manager, 's9', now)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('C17 add a section', () => {
  it('adds a manual section under a lock', async () => {
    vi.mocked(setupRepository.createSection).mockResolvedValue({ id: 's9' });
    await setupService.addSection(manager, { name: ' Packaging ' }, now);
    expect(setupRepository.lockLayout).toHaveBeenCalledWith({ marker: 'tx' }, HUB);
    expect(setupRepository.createSection).toHaveBeenCalledWith({ marker: 'tx' }, HUB, ' Packaging ');
  });

  it('a name already in use is 409 SECTION_NAME_TAKEN, before and inside the lock', async () => {
    vi.mocked(setupRepository.nameTaken).mockResolvedValue(true);
    await expect(setupService.addSection(manager, { name: 'samrat' }, now)).rejects.toMatchObject({ statusCode: 409, code: 'SECTION_NAME_TAKEN' });
    vi.mocked(setupRepository.nameTaken).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(setupService.addSection(manager, { name: 'samrat' }, now)).rejects.toMatchObject({ code: 'SECTION_NAME_TAKEN' });
    expect(setupRepository.createSection).not.toHaveBeenCalled();
  });

  it('a caller who is not at the hub is refused', async () => {
    await expect(setupService.addSection(branchManager, { name: 'X' }, now)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('C18 save the layout', () => {
  const save = async (sections: { id: string; itemIds: string[] }[], version_?: string) =>
    setupService.saveLayout(manager, { version: version_ ?? (await version()), sections }, now);

  it('a stale version is 409 LAYOUT_CHANGED and writes nothing', async () => {
    await expect(save([], 'stale')).rejects.toMatchObject({ statusCode: 409, code: 'LAYOUT_CHANGED' });
    expect(setupRepository.rewriteSectionPositions).not.toHaveBeenCalled();
    expect(setupRepository.createMoves).not.toHaveBeenCalled();
  });

  it('reorders sections and items without logging a move', async () => {
    await save([
      { id: 's2', itemIds: ['i3'] },
      { id: 's1', itemIds: ['i2', 'i1'] },
      { id: 's3', itemIds: [] },
    ]);
    expect(setupRepository.rewriteSectionPositions).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [{ id: 's2', position: 0 }, { id: 's1', position: 1 }, { id: 's3', position: 2 }]);
    expect(setupRepository.rewritePlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [
      { itemId: 'i2', sectionId: 's1', position: 0 },
      { itemId: 'i1', sectionId: 's1', position: 1 },
    ]);
    expect(setupRepository.createMoves).toHaveBeenCalledWith({ marker: 'tx' }, HUB, []);
  });

  it('an item dragged to another section is rewritten and logged as the caller’s move; an unsectioned item placed is inserted and logged', async () => {
    await save([
      { id: 's1', itemIds: ['i1'] },
      { id: 's2', itemIds: ['i3', 'i2'] },
      { id: 's3', itemIds: ['i4'] },
      { id: 'unsectioned', itemIds: [] },
    ]);
    expect(setupRepository.rewritePlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [{ itemId: 'i2', sectionId: 's2', position: 1 }]);
    expect(setupRepository.insertPlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [{ itemId: 'i4', sectionId: 's3', position: 0, addedById: 'sm' }]);
    expect(setupRepository.createMoves).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [
      { itemId: 'i2', fromSectionId: 's1', toSectionId: 's2', movedById: 'sm', movedAt: now },
      { itemId: 'i4', fromSectionId: null, toSectionId: 's3', movedById: 'sm', movedAt: now },
    ]);
  });

  it('items left out of the payload keep their section, after the listed ones', async () => {
    await save([
      { id: 's1', itemIds: ['i2'] },
      { id: 's2', itemIds: [] },
      { id: 's3', itemIds: [] },
    ]);
    expect(setupRepository.rewritePlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [
      { itemId: 'i2', sectionId: 's1', position: 0 },
      { itemId: 'i1', sectionId: 's1', position: 1 },
    ]);
  });

  it('the layout must list every section exactly once', async () => {
    await expect(save([{ id: 's1', itemIds: [] }, { id: 's2', itemIds: [] }])).rejects.toMatchObject({ statusCode: 400 });
    await expect(save([{ id: 's1', itemIds: [] }, { id: 's1', itemIds: [] }, { id: 's2', itemIds: [] }])).rejects.toMatchObject({ statusCode: 400 });
    await expect(save([{ id: 's1', itemIds: [] }, { id: 's2', itemIds: [] }, { id: 's3', itemIds: [] }, { id: 's9', itemIds: [] }])).rejects.toMatchObject({ statusCode: 400 });
  });

  it('an item listed twice, a retired or foreign item, and an item pushed out into "Not in any section" are refused', async () => {
    const all = (extra: { id: string; itemIds: string[] }[]) => [{ id: 's1', itemIds: [] }, { id: 's2', itemIds: [] }, { id: 's3', itemIds: [] }, ...extra];
    await expect(save([{ id: 's1', itemIds: ['i1', 'i1'] }, { id: 's2', itemIds: [] }, { id: 's3', itemIds: [] }])).rejects.toMatchObject({ statusCode: 400 });
    await expect(save([{ id: 's1', itemIds: ['i1'] }, { id: 's2', itemIds: ['i1'] }, { id: 's3', itemIds: [] }])).rejects.toMatchObject({ statusCode: 400 });
    vi.mocked(setupRepository.liveItems).mockResolvedValue([]);
    await expect(save([{ id: 's1', itemIds: ['ghost'] }, { id: 's2', itemIds: [] }, { id: 's3', itemIds: [] }])).rejects.toMatchObject({ statusCode: 404, code: 'ITEM_NOT_IN_SETUP' });
    vi.mocked(setupRepository.liveItems).mockImplementation(async (_s, ids) => ids.map((id) => ({ id, name: id, unit: 'kg' })));
    await expect(save(all([{ id: 'unsectioned', itemIds: ['i1'] }]))).rejects.toMatchObject({ statusCode: 400 });
    expect(setupRepository.rewritePlacements).not.toHaveBeenCalled();
  });

  it('runs under the layout lock', async () => {
    await save([{ id: 's1', itemIds: ['i1', 'i2'] }, { id: 's2', itemIds: ['i3'] }, { id: 's3', itemIds: [] }]);
    expect(setupRepository.lockLayout).toHaveBeenCalledWith({ marker: 'tx' }, HUB);
  });
});

describe('C19 add-items list', () => {
  const row = (over: object = {}) => ({ itemId: 'i4', name: 'Oat milk 1 L', categoryName: 'Beverages', type: 'STOCKED' as const, unit: 'cartons', hasSupplier: false, section: null, ...over });
  const query = { sectionId: 's3', tab: 'unsectioned' as const, page: 1, pageSize: 50 };

  it('words each row: category · type · unit, "New, no supplier" or the section it would move from', async () => {
    vi.mocked(setupRepository.findSection).mockResolvedValue({ id: 's3', name: 'Others', kind: 'MANUAL' });
    vi.mocked(setupRepository.listAddable).mockResolvedValue({
      rows: [row(), row({ itemId: 'i5', name: 'Rolled oats 1 kg', type: 'STOCKED', unit: 'bags', section: { id: 's2', name: 'Summer' } })],
      total: 3,
      chips: { unsectioned: 3, otherSections: 138 },
    });
    const out = await setupService.addableItems(manager, { ...query, q: 'oat' });
    expect(out.rows.map((r) => [r.name, r.typeText, r.placement])).toEqual([
      ['Oat milk 1 L', 'Stocked', { kind: 'UNSECTIONED', note: 'New, no supplier' }],
      ['Rolled oats 1 kg', 'Stocked', { kind: 'IN_SECTION', sectionId: 's2', sectionName: 'Summer' }],
    ]);
    expect(out.matchText).toBe('3 matches for “oat” · all sections');
    expect(out.chips).toEqual({ unsectioned: 3, otherSections: 138 });
    expect(out.page).toEqual({ page: 1, pageSize: 50, total: 3 });
    expect(setupRepository.listAddable).toHaveBeenCalledWith(HUB, { sectionId: 's3', tab: 'unsectioned', q: 'oat' }, { page: 1, pageSize: 50 });
  });

  it('no search: no match text; an unsectioned item that has a supplier has no note', async () => {
    vi.mocked(setupRepository.findSection).mockResolvedValue({ id: 's3', name: 'Others', kind: 'MANUAL' });
    vi.mocked(setupRepository.listAddable).mockResolvedValue({ rows: [row({ hasSupplier: true })], total: 1, chips: { unsectioned: 1, otherSections: 0 } });
    const out = await setupService.addableItems(manager, query);
    expect(out.matchText).toBeNull();
    expect(out.rows[0]!.placement).toEqual({ kind: 'UNSECTIONED', note: null });
  });

  it('one match is "1 match"', async () => {
    vi.mocked(setupRepository.findSection).mockResolvedValue({ id: 's3', name: 'Others', kind: 'MANUAL' });
    vi.mocked(setupRepository.listAddable).mockResolvedValue({ rows: [row()], total: 1, chips: { unsectioned: 1, otherSections: 0 } });
    expect((await setupService.addableItems(manager, { ...query, q: 'oat' })).matchText).toBe('1 match for “oat” · all sections');
  });

  it('an unknown section is 404; an unknown type or department is 400', async () => {
    vi.mocked(setupRepository.findSection).mockResolvedValue(null);
    await expect(setupService.addableItems(manager, query)).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(setupRepository.findSection).mockResolvedValue({ id: 's3', name: 'Others', kind: 'MANUAL' });
    await expect(setupService.addableItems(manager, { ...query, type: 'WIDGET' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setupService.addableItems(manager, { ...query, departmentTag: 'GARDEN' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('C20 add items to a section', () => {
  beforeEach(() => {
    vi.mocked(setupRepository.findSection).mockResolvedValue({ id: 's3', name: 'Others', kind: 'MANUAL' });
    vi.mocked(setupRepository.nextItemPosition).mockResolvedValue(5);
  });

  it('adds new items at the end, moves items from other sections (logged), and skips one already there', async () => {
    vi.mocked(setupRepository.placementsOf).mockResolvedValue(
      new Map([
        ['i1', { itemId: 'i1', sectionId: 's1', sectionName: 'Samrat', position: 0 }],
        ['i2', { itemId: 'i2', sectionId: 's3', sectionName: 'Others', position: 1 }],
      ]),
    );
    await setupService.addItems(manager, 's3', { itemIds: ['i4', 'i1', 'i2'] }, now);
    expect(setupRepository.insertPlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [{ itemId: 'i4', sectionId: 's3', position: 5, addedById: 'sm' }]);
    expect(setupRepository.rewritePlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [{ itemId: 'i1', sectionId: 's3', position: 6 }]);
    expect(setupRepository.createMoves).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [
      { itemId: 'i4', fromSectionId: null, toSectionId: 's3', movedById: 'sm', movedAt: now },
      { itemId: 'i1', fromSectionId: 's1', toSectionId: 's3', movedById: 'sm', movedAt: now },
    ]);
  });

  it('an item that is not in the catalog (or retired) is 404 ITEM_NOT_IN_SETUP and nothing is written', async () => {
    vi.mocked(setupRepository.liveItems).mockResolvedValue([{ id: 'i4', name: 'x', unit: 'kg' }]);
    await expect(setupService.addItems(manager, 's3', { itemIds: ['i4', 'ghost'] }, now)).rejects.toMatchObject({ statusCode: 404, code: 'ITEM_NOT_IN_SETUP' });
    expect(setupRepository.insertPlacements).not.toHaveBeenCalled();
  });

  it('an unknown section is 404', async () => {
    vi.mocked(setupRepository.findSection).mockResolvedValue(null);
    await expect(setupService.addItems(manager, 's9', { itemIds: ['i4'] }, now)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('C21 move an item', () => {
  beforeEach(() => {
    vi.mocked(setupRepository.findSection).mockResolvedValue({ id: 's3', name: 'Others', kind: 'MANUAL' });
    vi.mocked(setupRepository.nextItemPosition).mockResolvedValue(4);
    vi.mocked(setupRepository.createMove).mockResolvedValue(move());
  });

  it('the Attendant moves an item to another section: applied at once and logged', async () => {
    vi.mocked(setupRepository.placementsOf).mockResolvedValue(new Map([['i1', { itemId: 'i1', sectionId: 's2', sectionName: 'Summer', position: 0 }]]));
    const out = await setupService.moveItem(attendant, 'i1', { toSectionId: 's3' }, now);
    expect(setupRepository.rewritePlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [{ itemId: 'i1', sectionId: 's3', position: 4 }]);
    expect(setupRepository.createMove).toHaveBeenCalledWith({ marker: 'tx' }, HUB, { itemId: 'i1', fromSectionId: 's2', toSectionId: 's3', movedById: 'att', movedAt: now });
    expect(out).toMatchObject({ id: 'm1', text: 'Moved here from Summer by Linnet · 13 Oct 07:12', can: { undo: false } }); // the Attendant cannot undo
  });

  it('an item in no section is placed (inserted) and logged with no from', async () => {
    await setupService.moveItem(manager, 'i4', { toSectionId: 's3' }, now);
    expect(setupRepository.insertPlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [{ itemId: 'i4', sectionId: 's3', position: 4, addedById: 'sm' }]);
    expect(setupRepository.createMove).toHaveBeenCalledWith({ marker: 'tx' }, HUB, expect.objectContaining({ fromSectionId: null }));
  });

  it('the Manager can undo what she just moved', async () => {
    expect((await setupService.moveItem(manager, 'i4', { toSectionId: 's3' }, now)).can.undo).toBe(true);
  });

  it('the same section is refused; an unknown item or section is 404', async () => {
    vi.mocked(setupRepository.placementsOf).mockResolvedValue(new Map([['i1', { itemId: 'i1', sectionId: 's3', sectionName: 'Others', position: 0 }]]));
    await expect(setupService.moveItem(attendant, 'i1', { toSectionId: 's3' }, now)).rejects.toMatchObject({ statusCode: 400 });
    vi.mocked(setupRepository.liveItems).mockResolvedValue([]);
    await expect(setupService.moveItem(attendant, 'ghost', { toSectionId: 's3' }, now)).rejects.toMatchObject({ statusCode: 404, code: 'ITEM_NOT_IN_SETUP' });
    vi.mocked(setupRepository.liveItems).mockImplementation(async (_s, ids) => ids.map((id) => ({ id, name: id, unit: 'kg' })));
    vi.mocked(setupRepository.findSection).mockResolvedValue(null);
    await expect(setupService.moveItem(attendant, 'i1', { toSectionId: 's9' }, now)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a caller who is not at the hub is refused', async () => {
    await expect(setupService.moveItem(branchManager, 'i1', { toSectionId: 's3' }, now)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('C22 undo a move', () => {
  it('puts the item back at the end of the section it came from, and stamps the undo', async () => {
    vi.mocked(setupRepository.findMove).mockResolvedValue(move());
    vi.mocked(setupRepository.placementsOf).mockResolvedValue(new Map([['i1', { itemId: 'i1', sectionId: 's3', sectionName: 'Others', position: 0 }]]));
    vi.mocked(setupRepository.nextItemPosition).mockResolvedValue(7);
    await setupService.undoMove(manager, 'm1', now);
    expect(setupRepository.rewritePlacements).toHaveBeenCalledWith({ marker: 'tx' }, HUB, [{ itemId: 'i1', sectionId: 's2', position: 7 }]);
    expect(setupRepository.markUndone).toHaveBeenCalledWith({ marker: 'tx' }, HUB, 'm1', 'sm', now);
  });

  it('a move out of "Not in any section" is undone by removing the placement', async () => {
    vi.mocked(setupRepository.findMove).mockResolvedValue(move({ fromSectionId: null, fromSectionName: null }));
    vi.mocked(setupRepository.placementsOf).mockResolvedValue(new Map([['i1', { itemId: 'i1', sectionId: 's3', sectionName: 'Others', position: 0 }]]));
    await setupService.undoMove(manager, 'm1', now);
    expect(setupRepository.deletePlacement).toHaveBeenCalledWith({ marker: 'tx' }, HUB, 'i1');
  });

  it('a move already undone is 409 MOVE_ALREADY_UNDONE', async () => {
    vi.mocked(setupRepository.findMove).mockResolvedValue(move({ undoneAt: new Date('2026-10-13T05:00:00Z') }));
    await expect(setupService.undoMove(manager, 'm1', now)).rejects.toMatchObject({ statusCode: 409, code: 'MOVE_ALREADY_UNDONE' });
    expect(setupRepository.rewritePlacements).not.toHaveBeenCalled();
  });

  it('two people undoing at once: the second loses with 409 MOVE_ALREADY_UNDONE', async () => {
    vi.mocked(setupRepository.findMove).mockResolvedValue(move());
    vi.mocked(setupRepository.placementsOf).mockResolvedValue(new Map([['i1', { itemId: 'i1', sectionId: 's3', sectionName: 'Others', position: 0 }]]));
    vi.mocked(setupRepository.markUndone).mockResolvedValue(false);
    await expect(setupService.undoMove(manager, 'm1', now)).rejects.toMatchObject({ code: 'MOVE_ALREADY_UNDONE' });
  });

  it('an item that has moved again is 409 LAYOUT_CHANGED and nothing is touched', async () => {
    vi.mocked(setupRepository.findMove).mockResolvedValue(move());
    vi.mocked(setupRepository.placementsOf).mockResolvedValue(new Map([['i1', { itemId: 'i1', sectionId: 's1', sectionName: 'Samrat', position: 0 }]]));
    await expect(setupService.undoMove(manager, 'm1', now)).rejects.toMatchObject({ statusCode: 409, code: 'LAYOUT_CHANGED' });
    expect(setupRepository.markUndone).not.toHaveBeenCalled();
  });

  it('an unknown move is 404', async () => {
    vi.mocked(setupRepository.findMove).mockResolvedValue(null);
    await expect(setupService.undoMove(manager, 'nope', now)).rejects.toMatchObject({ statusCode: 404 });
  });
});
