/**
 * Branch day: the response builders, the figures and the day sheet, with no database (contract §4, §5, §15). The blind rule and the
 * money rule are pinned here by key name, so they stay enforced in the default test run.
 */
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_COUNT_BLIND_KEYS, DAY_MONEY_KEYS, daySheetSchema, SHEET_ROWS_PER_PAGE } from './_shared/branch-day-contract';
import { departmentFigures, usedValueOf } from './branch-day-figures';
import { branchDayRepository as repo, type DayRecord, type DepartmentRow, type LineRow } from './branch-day-repository';
import { buildSheet } from './branch-day-sheet';
import { describeCorrectionDetail, describeCountCorrected, describeCountSigned, describeDayClosed, describeOpeningRecounted, kesText } from './branch-day-sentences';
import { countViewOf, dayStatusOf, deliveryFactOf, figureLineOf, ledgerEntryOf, lineCorrectionOf, openingDifferencesOf, tileOf } from './branch-day-view';

vi.mock('./branch-day-repository', () => ({
  branchDayRepository: { previousClosing: vi.fn(), positions: vi.fn(), received: vi.fn(), waste: vi.fn(), latestInboundCosts: vi.fn(), usedOn: vi.fn() },
}));

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const keysOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(keysOf) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : [];
const moneyKeys = (value: unknown): string[] => keysOf(value).filter((k) => (DAY_MONEY_KEYS as readonly string[]).includes(k));
const blindKeys = (value: unknown): string[] => keysOf(value).filter((k) => (DAY_COUNT_BLIND_KEYS as readonly string[]).includes(k));

const grace = { id: 'u-grace', name: 'Grace Wanjiru', role: 'BARISTA' };
const mercy = { id: 'u-mercy', name: 'Mercy Njeri', role: 'MANAGER' };
const sam = { id: 'u-sam', name: 'Sam Otieno', role: 'MANAGER' };

const BD = '2026-10-10T00:00:00.000Z';
let seq = 0;
const line = (name: string, over: Partial<Record<string, unknown>> = {}, category: { name: string; parent?: string } | null = { name: 'Milk', parent: 'Dairy' }): LineRow => {
  seq += 1;
  const id = `item-${name}`;
  return {
    id: `line-${seq}`,
    branchDayDepartmentId: 'row-1',
    inventoryItemId: id,
    countedQty: null,
    expectedQty: null,
    unitCost: D(40),
    reason: null,
    reasonNote: null,
    reasonRequired: false,
    openingQty: null,
    receivedQty: null,
    wasteQty: null,
    usedQty: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    inventoryItem: { id, name, usageUnit: 'kg', currentCost: D(40), categoryId: category ? 'cat' : null, category: category ? { id: 'cat', name: category.name, parentCategoryId: category.parent ? 'parent' : null } : null },
    corrections: [],
    ...over,
  } as unknown as LineRow;
};

const dept = (name: string, lines: LineRow[], over: Partial<Record<string, unknown>> = {}): DepartmentRow =>
  ({
    id: `row-${name}`,
    branchDayId: 'day-1',
    departmentTag: null,
    locationId: `loc-${name}`,
    status: 'NOT_STARTED',
    countedById: null,
    countedAt: null,
    departmentId: `dept-${name}`,
    onBehalf: false,
    countIdempotencyKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: { id: `dept-${name}`, name, status: 'ACTIVE', position: 1 },
    location: { id: `loc-${name}` },
    countedBy: null,
    lines,
    ...over,
  }) as unknown as DepartmentRow;

const day = (departments: DepartmentRow[], over: Partial<Record<string, unknown>> = {}): DayRecord =>
  ({
    id: 'day-1',
    siteId: 'site-1',
    businessDate: new Date(BD),
    status: 'OPEN',
    reference: 'DAY-NYR-0044',
    closedById: null,
    closedAt: null,
    reopenCount: 0,
    usedValue: null,
    closingValue: null,
    closeIdempotencyKey: null,
    site: { id: 'site-1', name: 'Nyeri Town', code: 'NYR', address: 'Kimathi Way', phone: '0700' },
    closedBy: null,
    departments,
    openings: [],
    ...over,
  }) as unknown as DayRecord;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.previousClosing).mockResolvedValue(new Map());
  vi.mocked(repo.positions).mockResolvedValue(new Map());
  vi.mocked(repo.received).mockResolvedValue(new Map());
  vi.mocked(repo.waste).mockResolvedValue(new Map());
  vi.mocked(repo.latestInboundCosts).mockResolvedValue(new Map());
  vi.mocked(repo.usedOn).mockResolvedValue(new Map());
});

describe('the blind count (BD6 to BD8): nothing to count against, no money', () => {
  const barista = dept('Barista', [
    line('Milk 1L', { countedQty: D(9) }),
    line('Cream', { countedQty: null }, { name: 'Cream', parent: 'Dairy' }),
    line('Syrup', {}, { name: 'Syrups' }),
    line('Cup lids', {}, null),
  ]);
  const view = countViewOf(day([barista]), barista, false, new Map([['parent', 'Dairy']]));

  it('carries none of the figure keys and no money, by name', () => {
    expect(blindKeys(view)).toEqual([]);
    expect(moneyKeys(view)).toEqual([]);
  });
  it('lists the lines by category then name with what was typed, and the receipt groups', () => {
    // by category path, then name; an item with no category goes last, under "Other"
    expect(view.lines.map((l) => [l.itemName, l.categoryPath, l.countedQty])).toEqual([
      ['Cream', ['Dairy', 'Cream'], null],
      ['Milk 1L', ['Dairy', 'Milk'], '9'],
      ['Syrup', ['Syrups'], null],
      ['Cup lids', [], null],
    ]);
    expect(view.summary).toMatchObject({ itemCount: 4, filledCount: 1, blankCount: 3 });
    expect(view.summary.groups.reduce((n, g) => n + g.itemCount, 0)).toBe(4);
    expect(view.summary.groups.find((g) => g.name === 'Dairy')?.itemCount).toBe(2);
    expect(view.summary.groups.find((g) => g.name === 'Other')?.itemCount).toBe(1);
  });
  it('cannot be signed until every line is filled, and not on a closed day', () => {
    expect(view.canSign).toBe(false);
    const full = dept('Barista', [line('Milk', { countedQty: D(0) }), line('Cream', { countedQty: D(2) })]);
    expect(countViewOf(day([full]), full, false, new Map()).canSign).toBe(true);
    expect(countViewOf(day([full], { status: 'CLOSED' }), full, false, new Map()).canSign).toBe(false);
    const signed = dept('Barista', full.lines, { status: 'COUNTED', countedAt: new Date('2026-10-10T16:00:00Z'), countedBy: grace });
    const signedView = countViewOf(day([signed]), signed, false, new Map());
    expect(signedView).toMatchObject({ state: 'COUNTED', canSign: false, signedAt: '2026-10-10T16:00:00.000Z', signedBy: { id: 'u-grace', name: 'Grace Wanjiru' } });
  });
  it('says when the Branch Manager is counting for the department', () => {
    expect(countViewOf(day([barista]), barista, true, new Map()).onBehalfOfDepartment).toBe(true);
  });
  it('a department with no items reads Counted by rule, with nobody who signed', () => {
    const service = dept('Service', []);
    expect(countViewOf(day([service]), service, false, new Map())).toMatchObject({ state: 'COUNTED', canSign: false, signedAt: null, signedBy: null });
  });
});

describe('money by capability: ABSENT, never null, unless the caller may see costs', () => {
  const f = {
    line: line('Milk 1L', { countedQty: D(9) }),
    opening: D(7),
    received: D(5),
    waste: D(1),
    closing: D(9),
    used: D(2),
    unitCost: D('44.005'),
    yesterday: D(3),
    lastNight: D(7),
    accepted: null,
    legacy: false,
  };
  it('a head or member gets no money key on a figure line', () => {
    const wire = figureLineOf(f, false);
    expect(moneyKeys(wire)).toEqual([]);
    expect(wire).not.toHaveProperty('unitCostKes');
    expect(wire).toMatchObject({ openingQty: '7', receivedQty: '5', wasteQty: '1', closingQty: '9', usedQty: '2', yesterdayUsedQty: '3' });
  });
  it('a holder of the capability gets the values, two decimals, half up', () => {
    expect(figureLineOf(f, true)).toMatchObject({ unitCostKes: '44.01', usedValueKes: '88.01', closingValueKes: '396.05' });
  });
  it('a tile carries its Used value only with the capability, and null until the department has counted', () => {
    const d = dept('Barista', [line('Milk', { countedQty: D(9) })]);
    const figures = { dept: d, lines: [f] };
    expect(moneyKeys(tileOf(day([d]), figures, d, null, false))).toEqual([]);
    expect(tileOf(day([d]), figures, d, null, true)).not.toHaveProperty('usedValueKes', expect.anything());
    expect(tileOf(day([d]), figures, d, null, true).usedValueKes).toBeNull(); // NOT_STARTED: nothing counted yet
    const counted = dept('Barista', d.lines, { status: 'COUNTED' });
    expect(tileOf(day([counted]), { dept: counted, lines: [f] }, counted, grace, true)).toMatchObject({ usedValueKes: '88.01', head: { id: 'u-grace', initials: 'GW' } });
  });
});

describe('the department figures, live (§5.2 to §5.5)', () => {
  const lines = [line('Milk 1L', { countedQty: D(9) }), line('Cream', { countedQty: D(5) }), line('Oats', { countedQty: null })];
  const d = dept('Barista', lines);

  it('opening is last night’s signed figure when nothing was accepted; received and waste are the day’s; Used today follows', async () => {
    vi.mocked(repo.previousClosing).mockResolvedValue(new Map([['item-Milk 1L', { qty: D(8), closedAt: null }]]));
    vi.mocked(repo.positions).mockResolvedValue(new Map([['item-Milk 1L', D(99)], ['item-Cream', D(5)]]));
    vi.mocked(repo.received).mockResolvedValue(new Map([['item-Milk 1L', D(5)]]));
    vi.mocked(repo.waste).mockResolvedValue(new Map([['item-Milk 1L', D(1)]]));
    vi.mocked(repo.latestInboundCosts).mockResolvedValue(new Map([['item-Milk 1L', D(44)]]));
    vi.mocked(repo.usedOn).mockResolvedValue(new Map([['item-Milk 1L', D(3)]]));
    const figures = await departmentFigures(day([d]), d, { withYesterday: true });
    const by = Object.fromEntries(figures.lines.map((l) => [l.line.inventoryItem.name, l]));
    // Milk: last night's signed figure (8), not the ledger (99); 8 + 5 − 1 − 9 = 3.
    expect(by['Milk 1L']).toMatchObject({ lastNight: D(8), yesterday: D(3), unitCost: D(44) });
    expect(by['Milk 1L']?.opening.toString()).toBe('8');
    expect(by['Milk 1L']?.used?.toString()).toBe('3');
    // Cream: no earlier close, so the ledger position at the start of the day; a zero-use item reads 0; the item's own cost when nothing came in.
    expect(by['Cream']?.opening.toString()).toBe('5');
    expect(by['Cream']?.used?.toString()).toBe('0');
    expect(by['Cream']?.unitCost.toString()).toBe('40');
    // Oats: not counted yet, so no closing and no Used today.
    expect(by['Oats']).toMatchObject({ closing: null, used: null });
    expect(repo.positions).toHaveBeenCalledWith('site-1', 'loc-Barista', expect.any(Array), new Date('2026-10-09T21:00:00.000Z'), undefined);
  });

  it('an accepted opening beats last night: the head recounted 7', async () => {
    vi.mocked(repo.previousClosing).mockResolvedValue(new Map([['item-Milk 1L', { qty: D(8), closedAt: null }]]));
    const withOpening = day([d], { openings: [{ id: 'o1', departmentId: 'dept-Barista', departmentTag: null, kind: 'RECOUNTED', acceptedAt: new Date(), acceptedBy: grace, onBehalf: false, lines: [{ inventoryItemId: 'item-Milk 1L', acceptedQty: D(7), prefilledQty: D(8), overnightVariance: D(-1) }] }] });
    const figures = await departmentFigures(withOpening, d, { withYesterday: false });
    const milk = figures.lines.find((l) => l.line.inventoryItem.name === 'Milk 1L');
    expect(milk?.opening.toString()).toBe('7');
    expect(milk?.lastNight.toString()).toBe('8');
    expect(milk?.accepted?.toString()).toBe('7');
    expect(repo.usedOn).not.toHaveBeenCalled();
  });

  it('a department’s Used value is null until it has counted', async () => {
    const figures = await departmentFigures(day([d]), d, { withYesterday: false });
    expect(usedValueOf(figures)).toBeNull();
  });
});

describe('the department figures, frozen at the close', () => {
  const frozen = dept('Barista', [line('Milk 1L', { countedQty: D(9), openingQty: D(7), receivedQty: D(5), wasteQty: D(1), usedQty: D(2), unitCost: D(44) })], { status: 'COUNTED' });
  const closed = day([frozen], { status: 'CLOSED', closedAt: new Date('2026-10-10T16:30:00Z'), closedBy: mercy });

  it('reads the stored figures and asks the ledger nothing', async () => {
    const figures = await departmentFigures(closed, frozen, { withYesterday: false });
    expect(figures.lines[0]).toMatchObject({ legacy: false, unitCost: D(44) });
    expect(figures.lines[0]?.used?.toString()).toBe('2');
    expect(repo.positions).not.toHaveBeenCalled();
    expect(repo.received).not.toHaveBeenCalled();
    expect(usedValueOf(figures)?.toString()).toBe('88');
  });

  it('a day closed under the old flow has closing figures only: no Used today, no value, marked legacy', async () => {
    const old = dept('Kitchen', [line('Oil', { countedQty: D(4), unitCost: D(120) })], { status: 'COUNTED' });
    const figures = await departmentFigures(day([old], { status: 'CLOSED', closedAt: new Date(), closedBy: mercy }), old, { withYesterday: false });
    expect(figures.lines[0]).toMatchObject({ legacy: true, used: null });
    expect(figures.lines[0]?.closing?.toString()).toBe('4');
    expect(usedValueOf(figures)).toBeNull();
  });
});

describe('the day’s status and the correction on a line', () => {
  it('Open, Closed, and Corrected (derived: closed with at least one correction)', () => {
    expect(dayStatusOf({ status: 'OPEN' }, false)).toBe('OPEN');
    expect(dayStatusOf({ status: 'CLOSED' }, false)).toBe('CLOSED');
    expect(dayStatusOf({ status: 'CLOSED' }, true)).toBe('CORRECTED');
  });
  const correction = (id: string, from: number, to: number, usedFrom: number, usedTo: number, at: string, extra: Record<string, unknown> = {}) => ({
    id,
    correctedAt: new Date(at),
    correctedBy: sam,
    fromClosingQty: D(from),
    toClosingQty: D(to),
    fromUsedQty: D(usedFrom),
    toUsedQty: D(usedTo),
    reason: 'COUNTED_WRONGLY',
    note: null,
    transactionId: `tx-${id}`,
    ...extra,
  });
  it('shows the figure as signed (the first correction’s from) and as corrected (the last to), with the latest reason', () => {
    const l = line('Flour', { corrections: [correction('c1', 1, 2, 5, 4, '2026-10-11T06:00:00Z'), correction('c2', 2, 3, 4, 3, '2026-10-11T07:00:00Z', { reason: 'OTHER', note: 'Recounted' })] });
    expect(lineCorrectionOf(l)).toEqual({
      id: 'c2',
      at: '2026-10-11T07:00:00.000Z',
      by: { id: 'u-sam', name: 'Sam Otieno', initials: 'SO', roleLabel: 'Branch Manager' },
      fromClosingQty: '1',
      toClosingQty: '3',
      fromUsedQty: '5',
      toUsedQty: '3',
      reason: 'OTHER',
      note: 'Recounted',
    });
    expect(lineCorrectionOf(line('Flour'))).toBeNull();
  });
});

describe('the opening differences, deliveries and entries', () => {
  it('differences are counted minus last night, never zero, by item name', () => {
    const d = dept('Kitchen', [line('Oil'), line('Flour'), line('Salt')]);
    const withOpening = day([d], {
      openings: [{ id: 'o1', departmentId: 'dept-Kitchen', departmentTag: null, kind: 'RECOUNTED', acceptedAt: new Date(), acceptedBy: grace, onBehalf: false, lines: [
        { inventoryItemId: 'item-Oil', prefilledQty: D(3), acceptedQty: D(3), overnightVariance: D(0) },
        { inventoryItemId: 'item-Salt', prefilledQty: D(2), acceptedQty: D(3), overnightVariance: D(1) },
        { inventoryItemId: 'item-Flour', prefilledQty: D(20), acceptedQty: D(18), overnightVariance: D(-2) },
      ] }],
    });
    expect(openingDifferencesOf(withOpening, d).map((x) => [x.itemName, x.lastNightQty, x.countedQty, x.difference])).toEqual([['Flour', '20', '18', '-2'], ['Salt', '2', '3', '1']]);
  });

  const row = (over: Record<string, unknown>) => ({ id: 'x', reference: 'DSP-NYR-0231', status: 'ON_THE_WAY', departmentId: 'dept-Barista', countedAt: null, discrepancies: [], ...over });
  it('a delivery fact: none, waiting, or confirmed with the gaps and whether one is open', () => {
    expect(deliveryFactOf('dept-Barista', [])).toEqual({ state: 'NONE', dispatches: [], confirmedAt: null, gapCount: 0, gapOpen: false });
    expect(deliveryFactOf('dept-Barista', [row({ departmentId: 'other' })] as never).state).toBe('NONE');
    expect(deliveryFactOf('dept-Barista', [row({})] as never)).toMatchObject({ state: 'WAITING', confirmedAt: null, gapCount: 0, dispatches: [{ id: 'x', reference: 'DSP-NYR-0231' }] });
    const confirmed = deliveryFactOf('dept-Barista', [
      row({ id: 'a', status: 'CONFIRMED', countedAt: new Date('2026-10-10T12:00:00Z'), discrepancies: [{ id: 'q1', status: 'OPEN' }, { id: 'q2', status: 'RECORDED' }] }),
      row({ id: 'b', reference: 'DSP-NYR-0232', status: 'CLOSED', countedAt: new Date('2026-10-10T13:00:00Z') }),
    ] as never);
    expect(confirmed).toMatchObject({ state: 'CONFIRMED', confirmedAt: '2026-10-10T13:00:00.000Z', gapCount: 2, gapOpen: true });
    // one still waiting beside a confirmed one: waiting, no confirmation time, no gap counted yet
    expect(deliveryFactOf('dept-Barista', [row({ id: 'a', status: 'CONFIRMED', countedAt: new Date(), discrepancies: [{ id: 'q', status: 'OPEN' }] }), row({ id: 'b' })] as never)).toMatchObject({ state: 'WAITING', confirmedAt: null, gapCount: 0 });
  });

  it('a ledger entry carries the day number, the department and its kind', () => {
    const entry = ledgerEntryOf(
      { id: 'e1', createdAt: new Date('2026-10-10T16:31:00Z'), quantity: D(-3), reference: null, inventoryItem: { name: 'Milk', usageUnit: 'kg' }, branchDayLine: { department: { department: { id: 'dept-Barista', name: 'Barista' } } } },
      'USAGE',
      'DAY-NYR-0044',
    );
    expect(entry).toEqual({ id: 'e1', at: '2026-10-10T16:31:00.000Z', itemName: 'Milk', unit: 'kg', department: { id: 'dept-Barista', name: 'Barista' }, quantity: '-3', reference: 'DAY-NYR-0044', kind: 'USAGE' });
  });
});

describe('the sentences (contract §9)', () => {
  it('the opening, the count and the close', () => {
    expect(describeOpeningRecounted('Kitchen', [{ itemName: 'Milk 1L', lastNightQty: '8', countedQty: '7' }])).toBe('Recorded the opening: Milk 1L, 1 less than last night (8 → 7)');
    expect(describeOpeningRecounted('Kitchen', [{ itemName: 'Milk 1L', lastNightQty: '8', countedQty: '10' }])).toBe('Recorded the opening: Milk 1L, 2 more than last night (8 → 10)');
    expect(describeOpeningRecounted('Kitchen', [])).toBe('Recorded the opening: Kitchen, same as last night');
    expect(describeCountSigned('Housekeeping', 6, false)).toBe('Counted and signed: Housekeeping, 6 items');
    expect(describeCountSigned('Pastry', 1, true)).toBe('Counted and signed on behalf of Pastry: 1 item');
    expect(describeDayClosed('KES 50,060')).toBe('Closed the day · Used today KES 50,060');
    expect(describeDayClosed(null)).toBe('Closed the day');
    expect(describeCountCorrected('Flour 25kg', 'Pastry', '1', '2')).toBe('Corrected a count: Flour 25kg (Pastry), closing stock 1 → 2');
  });
  it('a correction’s detail, with and without a note, with and without "Signed with PIN"', () => {
    expect(describeCorrectionDetail('COUNTED_WRONGLY', 'Wrong shelf', true)).toBe('Reason: counted wrongly. Note: Wrong shelf Signed with PIN.');
    expect(describeCorrectionDetail('ITEM_WAS_MISSED', null, false)).toBe('Reason: item was missed.');
  });
  it('money text: whole shillings with thousands, cents only when there are any', () => {
    expect(kesText('50060.00')).toBe('KES 50,060');
    expect(kesText('1234567.50')).toBe('KES 1,234,567.50');
    expect(kesText('0.00')).toBe('KES 0');
    expect(kesText('999.00')).toBe('KES 999');
  });
  it('the old words never appear: counted (for the closing figure), consumption, gap, unusual, reopen', () => {
    const all = [
      describeOpeningRecounted('Kitchen', [{ itemName: 'Milk', lastNightQty: '8', countedQty: '7' }]),
      describeCountSigned('Kitchen', 3, true),
      describeDayClosed('KES 1'),
      describeCountCorrected('Milk', 'Kitchen', '1', '2'),
      describeCorrectionDetail('OTHER', 'x', true),
    ].join(' ');
    expect(all).not.toMatch(/consumption|\bgap\b|unusual|reopen/i);
  });
});

describe('the day sheet (§5.12)', () => {
  const bigLines = Array.from({ length: SHEET_ROWS_PER_PAGE + 1 }, (_, i) => line(`Item ${String(i).padStart(2, '0')}`, { countedQty: D(2), openingQty: D(5), receivedQty: D(0), wasteQty: D(0), usedQty: D(3), unitCost: D(10) }));
  const small = [line('Flour 25kg', { countedQty: D(2), openingQty: D(5), receivedQty: D(0), wasteQty: D(1), usedQty: D(2), unitCost: D(60), corrections: [{ id: 'c1', correctedAt: new Date('2026-10-11T06:14:00Z'), correctedBy: sam, fromClosingQty: D(1), toClosingQty: D(2), fromUsedQty: D(3), toUsedQty: D(2), reason: 'COUNTED_WRONGLY', note: null, transactionId: 'tx1' }] })];
  const pastry = dept('Pastry', small, { status: 'COUNTED', countedAt: new Date('2026-10-10T16:00:00Z'), countedBy: grace });
  const kitchen = dept('Kitchen', bigLines, { status: 'COUNTED', countedAt: new Date('2026-10-10T16:10:00Z'), countedBy: mercy, onBehalf: true });
  const service = dept('Service', [], { status: 'NOT_STARTED' });
  const closed = day([kitchen, pastry, service], { status: 'CLOSED', closedAt: new Date('2026-10-10T16:30:00Z'), closedBy: mercy, usedValue: D(0), closingValue: D(0) });

  const build = async (over: Partial<Parameters<typeof buildSheet>[0]> = {}) => {
    const figures = await Promise.all(closed.departments.map((d) => departmentFigures(closed, d, { withYesterday: false })));
    return buildSheet({
      day: closed,
      branch: { id: 'site-1', name: 'Nyeri Town', code: 'NYR', address: 'Kimathi Way', phone: '0700' },
      figures,
      heads: new Map([['dept-Pastry', grace]]),
      deliveries: [],
      openDiscrepancies: [{ reference: 'DSC-NYR-0007', departmentId: 'dept-Kitchen', itemName: 'Oil' }],
      kind: 'AT_THE_CLOSE',
      version: 1,
      madeAt: new Date('2026-10-10T16:30:00Z'),
      qrUrl: 'https://app.example/app/branch/day/history/day-1',
      ...over,
    });
  };

  it('is the contract’s shape, with the cover as page 1 and a department on each following page, 16 rows to a page', async () => {
    const sheet = await build();
    // (the shape is parsed against `daySheetSchema` on real rows in branch-day.db.test.ts; these ids are not uuids)
    expect(Object.keys(sheet).sort()).toEqual(Object.keys(daySheetSchema.shape).sort());
    expect(sheet.departments.map((d) => [d.department.name, d.page, d.itemCount])).toEqual([['Kitchen', 2, 17], ['Pastry', 4, 1], ['Service', 5, 0]]);
    expect(sheet.pageCount).toBe(5);
    expect(sheet.reference).toBe('DAY-NYR-0044');
    expect(sheet.qrUrl).toBe('https://app.example/app/branch/day/history/day-1');
  });

  it('a corrected line carries the figure as signed and as corrected, and the version lists the correction', async () => {
    const sheet = await build({ kind: 'AFTER_CORRECTION', version: 2 });
    const flour = sheet.departments.find((d) => d.department.name === 'Pastry')?.lines[0];
    expect(flour).toMatchObject({ closingQty: '2', usedQty: '2', usedValueKes: '120.00', correction: { fromClosingQty: '1', toClosingQty: '2' } });
    expect(sheet.departments.find((d) => d.department.name === 'Pastry')?.corrected).toBe(true);
    expect(sheet.corrections).toEqual([expect.objectContaining({ departmentName: 'Pastry', itemName: 'Flour 25kg', fromClosingQty: '1', toClosingQty: '2', reason: 'COUNTED_WRONGLY' })]);
    expect(sheet.correctedAt).toBe('2026-10-11T06:14:00.000Z');
    expect((await build()).correctedAt).toBeNull();
  });

  it('adds up the totals from the lines drawn', async () => {
    const sheet = await build();
    // Kitchen: 17 lines, used 3 and closing 2 at 10 each: 510 used, 340 closing. Pastry: used 2 and closing 2 at 60: 120 each.
    expect(sheet.totals).toEqual({ itemCount: 18, usedValueKes: '630.00', closingValueKes: '460.00' });
  });

  it('names who counted: the head, the Branch Manager on behalf, and the closer stands in for a department with no items', async () => {
    const sheet = await build();
    const by = Object.fromEntries(sheet.departments.map((d) => [d.department.name, d]));
    expect(by['Kitchen']).toMatchObject({ onBehalf: true, countedBy: { id: 'u-mercy' }, head: null });
    expect(by['Pastry']).toMatchObject({ countedBy: { id: 'u-grace' }, head: { id: 'u-grace' } });
    expect(by['Service']).toMatchObject({ countedBy: { id: 'u-mercy' }, countedAt: '2026-10-10T16:30:00.000Z', itemCount: 0 });
  });

  it('the notes say which openings were not checked and what was open; a stored note wins after a correction', async () => {
    const sheet = await build();
    expect(sheet.notes.openingNotChecked).toEqual(['Kitchen', 'Pastry']);
    expect(sheet.notes.openDiscrepancies).toEqual([{ reference: 'DSC-NYR-0007', departmentName: 'Kitchen', itemName: 'Oil' }]);
    const kept = await build({ notes: { openingNotChecked: ['Barista'], openDiscrepancies: [] } });
    expect(kept.notes).toEqual({ openingNotChecked: ['Barista'], openDiscrepancies: [] });
  });

  it('is only made from a closed day', async () => {
    const figures = await Promise.all(closed.departments.map((d) => departmentFigures(closed, d, { withYesterday: false })));
    expect(() => buildSheet({ day: { ...closed, closedBy: null, closedAt: null } as never, branch: { id: 's', name: 'n', code: null, address: null, phone: null }, figures, heads: new Map(), deliveries: [], openDiscrepancies: [], kind: 'AT_THE_CLOSE', version: 1, madeAt: new Date(), qrUrl: 'x' })).toThrow();
  });
});
