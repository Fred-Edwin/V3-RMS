import { ApiError } from '@/types/api';
import { nairobiToday } from '@/components/ui2/data-table/table-dates';
import { useAuthStore } from '@/store/authStore';
import type { Person } from '../../../_shared/types/wire';
import { usePermissionsStore } from '../../../_shared/hooks/use-permissions';
import type {
  Blocker,
  BranchRef,
  CloseDayInput,
  CloseDayResult,
  CloseSummary,
  CorrectCountInput,
  CorrectCountResult,
  CorrectionReason,
  CountLine,
  CountView,
  DayActivity,
  DayActivityEntry,
  DayDocument,
  DayDocuments,
  DayFile,
  DayHead,
  DaySheet,
  DayStatus,
  DepartmentFigures,
  History,
  HistoryQuery,
  HistoryRow,
  LineCorrection,
  SheetDepartment,
  SheetLine,
  DepartmentTile,
  FigureLine,
  LedgerEntry,
  OpeningCheck,
  SaveCountInput,
  SaveCountResult,
  SignCountInput,
  SignCountResult,
  Today,
  TodayQuery,
} from '../../_shared/types/branch-day-contract';
import { SHEET_ROWS_PER_PAGE } from '../../_shared/types/branch-day-contract';

/**
 * Branch day desktop, fixtures first (Block 4). Served only while `BRANCH_DAY_MOCK` is on (see `branch-day-desk-api.ts`); once
 * feat/block4-be is merged the flag is off and none of this runs. The Pastry and Housekeeping rows are Paper's own (steps 6 and 13c to
 * 13d); Kitchen, Barista and Service are made up and balanced to the department totals Paper draws (24,380 / 11,940 / 3,120), so the
 * branch total is Paper's 50,060. The PIN is 1234. `?mock=blocked|delivery|ready|closed` picks the day's starting state.
 *
 * The state lives in this module (one browser tab): counting for Housekeeping turns the day ready, closing it closes the day.
 */

const NYERI: BranchRef = { id: '10000000-0000-4000-8000-000000000001', name: 'Nyeri Town', code: 'NYR' };
const KARATINA: BranchRef = { id: '10000000-0000-4000-8000-000000000002', name: 'Karatina', code: 'KRT' };
const PIN = '1234';

const person = (id: string, name: string, roleLabel: string): Person => ({ id, name, initials: name.split(' ').map((w) => w[0] ?? '').join(''), roleLabel });
const P = {
  grace: person('20000000-0000-4000-8000-000000000001', 'Grace W.', 'Kitchen Department Head'),
  david: person('20000000-0000-4000-8000-000000000002', 'David M.', 'Barista Department Head'),
  ann: person('20000000-0000-4000-8000-000000000003', 'Ann K.', 'Pastry Department Head'),
  john: person('20000000-0000-4000-8000-000000000004', 'John M.', 'Service Department Head'),
  mary: person('20000000-0000-4000-8000-000000000005', 'Mary N.', 'Housekeeping Department Head'),
  peter: person('20000000-0000-4000-8000-000000000010', 'Peter Njoroge', 'Branch Manager'),
};

type Row = readonly [name: string, unit: string, opening: number, received: number, waste: number, closing: number, cost: number, yesterday: number];

interface MockDept {
  id: string;
  name: string;
  head: Person;
  rows: readonly Row[];
  /** Counted at (UTC ISO), or null while the department has not counted. */
  countedAt: string | null;
  onBehalf: boolean;
  opening: OpeningCheck;
  deliveryAt: string | null;
  deliveryLabel: string;
  wasteNote: string | null;
}

const at = (clock: string): string => new Date(`${nairobiToday()}T${clock}:00+03:00`).toISOString();

const KITCHEN: readonly Row[] = [
  ['Cooking oil 10L', 'Cans', 6, 0, 0, 4, 2200, 2],
  ['Tomatoes', 'kg', 30, 10, 2, 32, 160, 5],
  ['Marinated chicken', 'kg', 18, 10, 0, 21, 520, 4],
  ['Beef', 'kg', 14, 12, 0, 17, 640, 9],
  ['Pilau rice 25kg', 'Bags', 5, 0, 0, 4, 3100, 1],
  ['Onions', 'kg', 25, 0, 1, 19, 110, 4],
  ['Potatoes', 'kg', 40, 20, 2, 52, 70, 10],
  ['Eggs', 'Trays', 8, 4, 1, 9, 480, 2],
  ['Spices mix', 'Tins', 6, 0, 0, 5, 490, 1],
  ['Cabbage', 'Heads', 12, 0, 0, 10, 120, 2],
  ['Fries portions', 'Packs', 30, 40, 5, 43, 140, 18],
  ['Kachumbari mix', 'Tubs', 5, 6, 2, 6, 260, 3],
];
const BARISTA: readonly Row[] = [
  ['Coffee beans 1kg', 'Bags', 12, 0, 0, 9, 2050, 2],
  ['Milk 1L', 'Packets', 7, 22, 0, 14, 130, 14],
  ['Sugar 2kg', 'Packs', 6, 0, 0, 5, 300, 1],
  ['Cocoa powder 1kg', 'Tins', 3, 0, 0, 2, 650, 1],
  ['Vanilla syrup 750ml', 'Bottles', 4, 0, 0, 3, 1100, 1],
  ['Paper cups 12oz', 'Sleeves', 10, 0, 0, 7, 400, 3],
  ['Coffee filters', 'Boxes', 3, 0, 0, 2, 350, 1],
  ['Napkins', 'Packs', 8, 0, 0, 6, 120, 2],
];
const PASTRY: readonly Row[] = [
  ['Flour 25kg', 'Bags', 4, 0, 0, 1, 2000, 1],
  ['Butter 500g', 'Blocks', 6, 4, 0, 8, 620, 2],
  ['Eggs', 'Trays', 4, 3, 1, 5, 480, 1],
  ['Caster sugar 2kg', 'Packs', 5, 0, 0, 4, 340, 1],
  ['Baking powder 500g', 'Tins', 3, 0, 0, 3, 400, 0],
  ['Vanilla essence', 'Bottles', 2, 0, 0, 2, 700, 0],
  ['Icing sugar 1kg', 'Packs', 4, 0, 0, 3, 280, 1],
  ['Cream cheese', 'Tubs', 3, 2, 0, 4, 420, 1],
];
const SERVICE: readonly Row[] = [
  ['Napkins', 'Packs', 20, 0, 0, 17, 220, 2],
  ['Straws', 'Boxes', 6, 0, 0, 5, 310, 1],
  ['Takeaway boxes', 'Packs', 15, 0, 0, 13, 380, 1],
  ['Gloves', 'Boxes', 4, 0, 0, 3, 520, 1],
  ['Aprons', 'Pcs', 10, 0, 0, 10, 450, 0],
  ['Menu cards', 'Sets', 8, 0, 0, 8, 200, 0],
  ['Salt shakers', 'Pcs', 12, 0, 0, 12, 90, 0],
  ['Table candles', 'Packs', 9, 0, 0, 8, 330, 1],
  ['Toothpicks', 'Boxes', 7, 0, 0, 6, 540, 1],
];
const HOUSEKEEPING: readonly Row[] = [
  ['Floor cleaner 5L', 'Cans', 7, 0, 0, 6, 950, 1],
  ['Dish soap 5L', 'Cans', 8, 0, 0, 8, 820, 0],
  ['Toilet paper 10pk', 'Packs', 15, 0, 0, 14, 480, 1],
  ['Bin liners', 'Rolls', 22, 0, 0, 20, 150, 2],
  ['Sponges', 'Packs', 11, 0, 0, 10, 130, 1],
  ['Hand towels', 'Packs', 11, 0, 0, 11, 320, 0],
];

const noOpeningDifference = (state: 'ACCEPTED' | 'NOT_CHECKED', checkedAt: string | null, by: Person | null): OpeningCheck => ({ state, checkedAt, checkedBy: by, onBehalf: false, differences: [] });

const deptId = (n: number): string => `30000000-0000-4000-8000-00000000000${n}`;
const itemId = (d: number, i: number): string => `80000000-0000-4000-8000-0000000${d}${String(i).padStart(4, '0')}`;

type Scenario = 'blocked' | 'delivery' | 'ready' | 'closed';

interface World {
  scenario: Scenario;
  depts: MockDept[];
  /** Typed figures of a department the Branch Manager is counting (item id → figure). */
  drafts: Record<string, Record<string, string>>;
  closed: { at: string; result: CloseDayResult } | null;
  closeKey: string | null;
  signKeys: Record<string, SignCountResult>;
  /** Corrections posted on this day, oldest first (Part 2). */
  corrections: MockCorrection[];
  correctKeys: Record<string, CorrectCountResult>;
  /** Sheet versions: version 1 at the close, one more after every correction. */
  sheets: DayDocument[];
  /** `?window=passed`: tomorrow's opening has been accepted, so no correction is allowed (gap G13). */
  windowPassed: boolean;
  /** The day's Used value as it was frozen at the close (a correction changes the live total, not this). */
  closedUsedValue: number | null;
}

interface MockCorrection {
  id: string;
  at: string;
  departmentId: string;
  departmentName: string;
  itemId: string;
  itemName: string;
  unit: string;
  fromClosing: number;
  toClosing: number;
  fromUsed: number;
  toUsed: number;
  reason: CorrectionReason;
  note: string | null;
}

const buildDepts = (scenario: Scenario): MockDept[] => {
  const housekeepingCounted = scenario !== 'blocked';
  return [
    { id: deptId(1), name: 'Kitchen', head: P.grace, rows: KITCHEN, countedAt: at('18:20'), onBehalf: false, opening: noOpeningDifference('ACCEPTED', at('07:10'), P.grace), deliveryAt: scenario === 'delivery' ? null : at('15:12'), deliveryLabel: 'Kitchen', wasteNote: null },
    {
      id: deptId(2),
      name: 'Barista',
      head: P.david,
      rows: BARISTA,
      countedAt: at('18:52'),
      onBehalf: false,
      opening: {
        state: 'RECOUNTED',
        checkedAt: at('07:17'),
        checkedBy: P.david,
        onBehalf: false,
        differences: [{ itemId: itemId(2, 2), itemName: 'Milk 1L', unit: 'Packets', lastNightQty: '8', countedQty: '7', difference: '-1' }],
      },
      deliveryAt: at('15:35'),
      deliveryLabel: 'Barista',
      wasteNote: null,
    },
    { id: deptId(3), name: 'Pastry', head: P.ann, rows: PASTRY, countedAt: at('18:35'), onBehalf: false, opening: noOpeningDifference('ACCEPTED', at('07:14'), P.ann), deliveryAt: at('15:20'), deliveryLabel: 'Pastry', wasteNote: 'Eggs, broken' },
    { id: deptId(4), name: 'Service', head: P.john, rows: SERVICE, countedAt: at('18:41'), onBehalf: false, opening: noOpeningDifference('NOT_CHECKED', null, null), deliveryAt: at('15:30'), deliveryLabel: 'Service', wasteNote: null },
    { id: deptId(5), name: 'Housekeeping', head: P.mary, rows: HOUSEKEEPING, countedAt: housekeepingCounted ? at('19:24') : null, onBehalf: false, opening: noOpeningDifference('ACCEPTED', at('07:12'), P.mary), deliveryAt: null, deliveryLabel: 'Housekeeping', wasteNote: null },
  ];
};

const readScenario = (): Scenario => {
  if (typeof window === 'undefined') return 'blocked';
  const raw = new URLSearchParams(window.location.search).get('mock');
  return raw === 'delivery' || raw === 'ready' || raw === 'closed' || raw === 'blocked' ? raw : 'blocked';
};

let world: World | null = null;

const freshWorld = (scenario: Scenario, windowPassed: boolean): World => {
  const w: World = { scenario, depts: buildDepts(scenario), drafts: {}, closed: null, closeKey: null, signKeys: {}, corrections: [], correctKeys: {}, sheets: [], windowPassed, closedUsedValue: null };
  if (scenario === 'closed') {
    w.closed = { at: at('19:48'), result: makeCloseResult(w, 'seed') };
    w.sheets = [w.closed.result.document];
    w.closedUsedValue = w.depts.reduce((s, d) => s + usedValue(d), 0);
  }
  return w;
};

function ensureWorld(): World {
  if (world) return world;
  const windowPassed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('window') === 'passed';
  world = freshWorld(readScenario(), windowPassed);
  // `?corrected=1` starts a closed day with Paper's correction already posted (Flour 25kg, Pastry, 1 → 2), for the printed sheet.
  if (world.closed && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('corrected') === '1') {
    void mockBranchDay.correct(TODAY_ID, { departmentId: deptId(3), itemId: itemId(3, 1), closingQty: '2', reason: 'COUNTED_WRONGLY', note: 'A bag was in the dry store, not on the shelf.', pin: PIN, idempotencyKey: 'seed-correction' });
  }
  return world;
}

/** Test seam: start again from a chosen state. */
export function resetMockWorld(scenario: Scenario = 'blocked'): void {
  world = freshWorld(scenario, false);
}

// --- Figures ---------------------------------------------------------------------------------------------------

const used = (r: Row): number => r[2] + r[3] - r[4] - r[5];
const money = (n: number): string => n.toFixed(2);
const usedValue = (d: MockDept): number => d.rows.reduce((s, r) => s + used(r) * r[6], 0);
const closingValue = (d: MockDept): number => d.rows.reduce((s, r) => s + r[5] * r[6], 0);
const deptNumber = (d: MockDept): number => Number(d.id.slice(-1));

const hasCosts = (): boolean => usePermissionsStore.getState().capabilities.includes('catalog.see_costs');
const can = (capability: string): boolean => (usePermissionsStore.getState().capabilities as readonly string[]).includes(capability);

const TODAY_ID = '70000000-0000-4000-8000-000000000044';
const dayHead = (w: World): DayHead => ({ id: TODAY_ID, reference: 'DAY-NYR-0044', date: nairobiToday(), status: w.closed ? (w.corrections.length > 0 ? 'CORRECTED' : 'CLOSED') : 'OPEN' });

function tile(d: MockDept, withMoney: boolean): DepartmentTile {
  const counted = d.countedAt !== null;
  return {
    departmentId: d.id,
    name: d.name,
    head: d.head,
    state: counted ? 'COUNTED' : 'NOT_COUNTED',
    countedAt: d.countedAt,
    countedBy: counted ? (d.onBehalf ? P.peter : d.head) : null,
    onBehalf: d.onBehalf,
    itemCount: d.rows.length,
    opening: { state: d.opening.state, differences: d.opening.differences },
    ...(withMoney ? { usedValueKes: counted ? money(usedValue(d)) : null } : {}),
  };
}

function blockersOf(w: World): Blocker[] {
  const none: Pick<Blocker, 'discrepancies' | 'at' | 'lastDepartment'> = { discrepancies: [], at: null, lastDepartment: null };
  const out: Blocker[] = [];
  const waiting = w.depts.filter((d) => d.deliveryAt === null && d.deliveryLabel === 'Kitchen');
  for (const d of waiting) {
    out.push({ kind: 'DELIVERY_NOT_CONFIRMED', severity: 'BLOCKS', department: { id: d.id, name: d.name }, dispatch: { id: '50000000-0000-4000-8000-000000000231', reference: 'DSP-NYR-0231', signedAt: at('15:05') }, ...none, discrepancies: [{ id: '90000000-0000-4000-8000-000000000007', reference: 'DSC-NYR-0007' }] });
  }
  if (waiting.length === 0) {
    out.push({ kind: 'DELIVERIES_CONFIRMED', severity: 'OK', department: null, dispatch: null, discrepancies: [{ id: '90000000-0000-4000-8000-000000000007', reference: 'DSC-NYR-0007' }], at: null, lastDepartment: null });
  }
  const uncounted = w.depts.filter((d) => d.countedAt === null);
  for (const d of uncounted) out.push({ kind: 'DEPARTMENT_NOT_COUNTED', severity: 'BLOCKS', department: { id: d.id, name: d.name }, dispatch: null, ...none });
  if (uncounted.length === 0) {
    const last = [...w.depts].sort((a, b) => (a.countedAt ?? '').localeCompare(b.countedAt ?? '')).at(-1);
    out.push({ kind: 'ALL_COUNTED', severity: 'OK', department: null, dispatch: null, discrepancies: [], at: last?.countedAt ?? null, lastDepartment: last ? { id: last.id, name: last.name } : null });
  }
  for (const d of w.depts) {
    if (d.countedAt !== null && d.opening.state === 'NOT_CHECKED') out.push({ kind: 'OPENING_NOT_CHECKED', severity: 'INFO', department: { id: d.id, name: d.name }, dispatch: null, ...none });
  }
  return out;
}

const usageEntries = (w: World, closedAt: string): LedgerEntry[] =>
  w.depts.flatMap((d) =>
    d.rows
      .filter((r) => used(r) !== 0)
      .map((r, i) => ({
        id: `a0000000-0000-4000-8000-${deptNumber(d)}${String(i).padStart(11, '0')}`,
        at: closedAt,
        itemName: r[0],
        unit: r[1],
        department: { id: d.id, name: d.name },
        quantity: String(-used(r)),
        reference: dayHead(w).reference,
        kind: 'USAGE' as const,
      })),
  );

/** B9's five rows: Paper draws Pastry, Barista, Barista, Kitchen, Kitchen. */
const firstFive = (all: LedgerEntry[]): LedgerEntry[] => {
  const pick = (name: string, dept: string): LedgerEntry | undefined => all.find((e) => e.itemName === name && e.department.name === dept);
  const wanted = [pick('Flour 25kg', 'Pastry'), pick('Milk 1L', 'Barista'), pick('Cocoa powder 1kg', 'Barista'), pick('Cooking oil 10L', 'Kitchen'), pick('Tomatoes', 'Kitchen')];
  return wanted.filter((e): e is LedgerEntry => e !== undefined);
};

function makeCloseResult(w: World, key: string): CloseDayResult {
  const closedAt = w.closed?.at ?? at('19:48');
  const entries = usageEntries(w, closedAt);
  return {
    day: { ...dayHead(w), status: 'CLOSED' },
    closedAt,
    closedBy: P.peter,
    usedValueKes: money(w.depts.reduce((s, d) => s + usedValue(d), 0)),
    entryCount: entries.length,
    entries: firstFive(entries),
    document: { id: 'c0000000-0000-4000-8000-000000000001', version: 1, kind: 'AT_THE_CLOSE', latest: true, reference: dayHead(w).reference, pages: 6, madeAt: closedAt },
    replayed: key === 'replay',
  };
}

// --- The calls -----------------------------------------------------------------------------------------------------

const wait = <T,>(value: T, ms = 220): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

/** `?fail=today` (or `figures`) makes the first call of that kind fail once, so the error panel and its Retry can be walked. */
const failStarted = new Map<string, number>();
function failOnce(kind: 'today' | 'figures'): Promise<never> | null {
  if (typeof window === 'undefined') return null;
  if (new URLSearchParams(window.location.search).get('fail') !== kind) return null;
  // Every call in the first 1.5 s fails (a development double render makes two calls at once); a Retry after that succeeds.
  const started = failStarted.get(kind) ?? Date.now();
  failStarted.set(kind, started);
  if (Date.now() - started > 1500) return null;
  return wait(null, 250).then(() => Promise.reject(new ApiError('Could not reach the server.', 503, 'UNAVAILABLE')));
}

export const mockBranchDay = {
  today(query: TodayQuery): Promise<Today> {
    const failed = failOnce('today');
    if (failed) return failed;
    const w = ensureWorld();
    const hub = can('branch_day.read_any_branch');
    const branches = hub ? [KARATINA, NYERI] : undefined;
    const branch = hub && query.branchId === KARATINA.id ? KARATINA : NYERI;
    const view = { close: can('branch_day.close'), countOnBehalf: can('branch_day.count_on_behalf') };
    if (branch.id === KARATINA.id) return wait({ branch, ...(branches ? { branches } : {}), day: null, can: { close: false, countOnBehalf: false } });
    const withMoney = hasCosts();
    const blockers = blockersOf(w);
    const todo = blockers.filter((b) => b.severity === 'BLOCKS').length;
    const toKnow = blockers.filter((b) => b.severity === 'INFO').length;
    const totalUsed = w.depts.every((d) => d.countedAt !== null) ? money(w.depts.reduce((s, d) => s + usedValue(d), 0)) : null;
    const closed = w.closed ? { at: w.closed.at, by: P.peter, entryCount: w.closed.result.entryCount, entries: w.closed.result.entries } : null;
    return wait({
      branch,
      ...(branches ? { branches } : {}),
      day: {
        head: dayHead(w),
        departments: w.depts.map((d) => tile(d, withMoney)),
        blockers,
        summary: { todo, toKnow },
        canClose: !w.closed && todo === 0,
        ...(withMoney ? { usedValueKes: totalUsed } : {}),
        closed,
      },
      can: view,
    });
  },

  figures(dayId: string, departmentId: string): Promise<DepartmentFigures> {
    const failed = failOnce('figures');
    if (failed) return failed;
    const w = ensureWorld();
    const isToday = dayId === TODAY_ID;
    const depts = isToday ? w.depts : pastDepts();
    const head = isToday ? dayHead(w) : pastHead(dayId);
    const d = depts.find((x) => x.id === departmentId) ?? depts[0];
    if (!d) return Promise.reject(new ApiError('This department is not on the day.', 404, 'ITEM_NOT_IN_DAY'));
    const withMoney = hasCosts();
    const counted = d.countedAt !== null;
    const lines: FigureLine[] = d.rows.map((r, i) => ({
      itemId: itemId(deptNumber(d), i + 1),
      itemName: r[0],
      unit: r[1],
      openingQty: String(r[2]),
      receivedQty: String(r[3]),
      wasteQty: String(r[4]),
      closingQty: counted ? String(r[5]) : null,
      usedQty: counted ? String(used(r)) : null,
      yesterdayUsedQty: String(r[7]),
      ...(withMoney ? { unitCostKes: money(r[6]), usedValueKes: counted ? money(used(r) * r[6]) : null, closingValueKes: counted ? money(r[5] * r[6]) : null } : {}),
      correction: isToday ? lineCorrection(w, itemId(deptNumber(d), i + 1)) : null,
    }));
    const wasteEntries = d.rows.reduce((s, r) => s + (r[4] > 0 ? 1 : 0), 0);
    return wait({
      day: head,
      branch: NYERI,
      rail: depts.map((x) => tile(x, withMoney)),
      ...(withMoney ? { branchUsedValueKes: money(depts.filter((x) => x.countedAt !== null).reduce((s, x) => s + usedValue(x), 0)) } : {}),
      department: {
        id: d.id,
        name: d.name,
        state: counted ? 'COUNTED' : 'NOT_COUNTED',
        countedAt: d.countedAt,
        countedBy: counted ? (d.onBehalf ? P.peter : d.head) : null,
        onBehalf: d.onBehalf,
        opening: d.opening,
        delivery:
          d.deliveryAt !== null
            ? { state: 'CONFIRMED', dispatches: [], confirmedAt: d.deliveryAt, gapCount: d.name === 'Barista' ? 1 : 0, gapOpen: d.name === 'Barista' }
            : d.name === 'Kitchen'
              ? { state: 'WAITING', dispatches: [{ id: '50000000-0000-4000-8000-000000000231', reference: 'DSP-NYR-0231' }], confirmedAt: null, gapCount: 0, gapOpen: false }
              : { state: 'NONE', dispatches: [], confirmedAt: null, gapCount: 0, gapOpen: false },
        lines,
        waste: { entryCount: wasteEntries, items: d.wasteNote ? [{ itemName: d.wasteNote.split(',')[0] ?? '', reasonText: (d.wasteNote.split(',')[1] ?? '').trim() }] : [] },
        ...(withMoney ? { totals: { usedValueKes: counted ? money(usedValue(d)) : null, closingValueKes: counted ? money(closingValue(d)) : null } } : {}),
        can: { correct: isToday && w.closed !== null && !w.windowPassed && can('branch_day.correct') },
      },
    });
  },

  closeSummary(): Promise<CloseSummary> {
    const w = ensureWorld();
    const blockers = blockersOf(w);
    const entryCount = usageEntries(w, at('19:48')).length;
    return wait({
      day: dayHead(w),
      branch: NYERI,
      usedValueKes: money(w.depts.reduce((s, d) => s + usedValue(d), 0)),
      departments: w.depts.map((d) => ({ departmentId: d.id, name: d.name, itemCount: d.rows.length, usedValueKes: money(usedValue(d)) })),
      entryCount,
      canClose: !w.closed && blockers.every((b) => b.severity !== 'BLOCKS'),
      blockers,
    });
  },

  close(_dayId: string, input: CloseDayInput): Promise<CloseDayResult> {
    const w = ensureWorld();
    if (w.closed) {
      if (w.closeKey === input.idempotencyKey) return wait({ ...w.closed.result, replayed: true });
      return Promise.reject(new ApiError('This day is already closed.', 409, 'DAY_ALREADY_CLOSED'));
    }
    if (input.pin !== PIN) return wait(null, 300).then(() => Promise.reject(new ApiError('That PIN is not right.', 403, 'INVALID_PIN')));
    const blockers = blockersOf(w).filter((b) => b.severity === 'BLOCKS');
    if (blockers.length > 0) return Promise.reject(new ApiError('The day is not ready to close.', 409, 'DAY_NOT_READY', { blockers }));
    // Fixed at Paper's 7:48 pm so the banner and the entries agree whatever the clock says.
    w.closed = { at: at('19:48'), result: makeCloseResult(w, input.idempotencyKey) };
    w.closeKey = input.idempotencyKey;
    w.closed.result = { ...w.closed.result, closedAt: w.closed.at };
    w.sheets = [w.closed.result.document];
    w.closedUsedValue = w.depts.reduce((s, d) => s + usedValue(d), 0);
    return wait(w.closed.result, 500);
  },

  // --- Part 2: History, the day file, Correct a count, the day sheet ----------------------------------------------------

  /** BD15 */
  history(query: HistoryQuery): Promise<History> {
    const failed = failOnce('today');
    if (failed) return failed;
    const w = ensureWorld();
    const hub = can('branch_day.read_any_branch');
    const q = (query.q ?? '').trim().toLowerCase();
    let rows = historyRows(w, hasCosts()).filter((r) => (hub ? (query.branchId ? r.branch.id === query.branchId : true) : r.branch.id === NYERI.id));
    if (q) rows = rows.filter((r) => r.reference.toLowerCase().includes(q) || r.date.includes(q));
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    if (query.from) rows = rows.filter((r) => r.date >= (query.from ?? ''));
    if (query.to) rows = rows.filter((r) => r.date <= (query.to ?? ''));
    rows.sort((a, b) => b.date.localeCompare(a.date) || a.branch.name.localeCompare(b.branch.name));
    const pageSize = query.pageSize ?? 25;
    const page = query.page ?? 1;
    return wait({ rows: rows.slice((page - 1) * pageSize, page * pageSize), ...(hub ? { branches: [KARATINA, NYERI] } : {}), page: { page, pageSize, total: rows.length } });
  },

  /** BD16 */
  dayFile(dayId: string): Promise<DayFile> {
    const failed = failOnce('figures');
    if (failed) return failed;
    const w = ensureWorld();
    const isToday = dayId === TODAY_ID;
    const depts = isToday ? w.depts : pastDepts();
    const head = isToday ? dayHead(w) : pastHead(dayId);
    const withMoney = hasCosts();
    const checked = depts.filter((d) => d.opening.state !== 'NOT_CHECKED').length;
    const last = [...depts].sort((a, b) => (a.countedAt ?? '').localeCompare(b.countedAt ?? '')).at(-1);
    const closedAt = isToday ? (w.closed?.at ?? null) : pastClosedAt(head.date);
    const latest = w.corrections.at(-1);
    const correctable = isToday && w.closed !== null && !w.windowPassed && can('branch_day.correct');
    return wait({
      day: head,
      branch: NYERI,
      tracker: {
        openingsChecked: { checked, total: depts.length },
        counted: { counted: depts.filter((d) => d.countedAt !== null).length, total: depts.length, lastAt: last?.countedAt ?? null },
        closed: { at: closedAt, by: closedAt ? P.peter : null },
      },
      rail: depts.map((d) => tile(d, withMoney)),
      tabCounts: { documents: isToday ? w.sheets.length : 1, activity: activityOf(w, depts, isToday, head).length },
      ...(withMoney ? { usedValueKes: money(depts.reduce((s, d) => s + usedValue(d), 0)) } : {}),
      lastCorrection: isToday && latest ? { at: latest.at, itemName: latest.itemName, departmentName: latest.departmentName, fromClosingQty: String(latest.fromClosing), toClosingQty: String(latest.toClosing) } : null,
      can: { correct: correctable, print: true },
    });
  },

  /** BD17: newest first. `limit` caps the list; `total` is every entry. */
  activity(dayId: string, limit = 5): Promise<DayActivity> {
    const w = ensureWorld();
    const isToday = dayId === TODAY_ID;
    const all = activityOf(w, isToday ? w.depts : pastDepts(), isToday, isToday ? dayHead(w) : pastHead(dayId));
    return wait({ entries: all.slice(0, limit), total: all.length });
  },

  /** BD18 */
  documents(dayId: string): Promise<DayDocuments> {
    const w = ensureWorld();
    if (dayId !== TODAY_ID) return wait({ documents: [pastDocument(dayId)] });
    return wait({ documents: [...w.sheets].reverse().map((s) => ({ ...s, latest: s.version === w.sheets.length })) });
  },

  /** BD20: one linked entry, both figures kept, the totals and a new sheet version. */
  correct(dayId: string, input: CorrectCountInput): Promise<CorrectCountResult> {
    const w = ensureWorld();
    const earlier = w.correctKeys[input.idempotencyKey];
    if (earlier) return wait({ ...earlier, replayed: true });
    if (input.pin !== PIN) return wait(null, 300).then(() => Promise.reject(new ApiError('That PIN is not right.', 403, 'INVALID_PIN')));
    if (dayId !== TODAY_ID || !w.closed) return Promise.reject(new ApiError('This day has not been closed yet.', 409, 'DAY_NOT_CLOSED'));
    const d = w.depts.find((x) => x.id === input.departmentId);
    if (!d || d.countedAt === null) return Promise.reject(new ApiError('This department did not count.', 409, 'DEPARTMENT_NOT_COUNTED'));
    const index = d.rows.findIndex((_, i) => itemId(deptNumber(d), i + 1) === input.itemId);
    const row = d.rows[index];
    if (!row) return Promise.reject(new ApiError('That item is not on this department’s day.', 404, 'ITEM_NOT_IN_DAY'));
    if (w.windowPassed) return Promise.reject(new ApiError('The next opening was accepted.', 409, 'CORRECTION_WINDOW_PASSED'));
    const to = Number(input.closingQty);
    if (!Number.isFinite(to) || to < 0 || to === row[5]) return Promise.reject(new ApiError('That is the figure already on the day.', 409, 'CORRECTION_NO_CHANGE'));
    const fromUsed = used(row);
    const next: Row = [row[0], row[1], row[2], row[3], row[4], to, row[6], row[7]];
    w.depts = w.depts.map((x) => (x.id === d.id ? { ...x, rows: x.rows.map((r, i) => (i === index ? next : r)) } : x));
    const correction: MockCorrection = {
      id: `d0000000-0000-4000-8000-${String(w.corrections.length + 1).padStart(12, '0')}`,
      // Paper: corrected the next morning at 9:14 am (a minute later for each further correction), so it follows the close.
      at: new Date(Date.parse(`${addDays(nairobiToday(), 1)}T09:14:00+03:00`) + w.corrections.length * 60_000).toISOString(),
      departmentId: d.id,
      departmentName: d.name,
      itemId: input.itemId,
      itemName: row[0],
      unit: row[1],
      fromClosing: row[5],
      toClosing: to,
      fromUsed,
      toUsed: used(next),
      reason: input.reason,
      note: input.note?.trim() ? input.note.trim() : null,
    };
    w.corrections.push(correction);
    const document: DayDocument = { id: `c0000000-0000-4000-8000-00000000000${w.sheets.length + 1}`, version: w.sheets.length + 1, kind: 'AFTER_CORRECTION', latest: true, reference: dayHead(w).reference, pages: 6, madeAt: new Date(Date.parse(correction.at) + 60_000).toISOString() };
    w.sheets.push(document);
    const result: CorrectCountResult = {
      day: dayHead(w),
      line: figureLine(w, d, index),
      entry: { id: `a1000000-0000-4000-8000-${String(w.corrections.length).padStart(12, '0')}`, at: correction.at, itemName: row[0], unit: row[1], department: { id: d.id, name: d.name }, quantity: String(to - row[5]), reference: dayHead(w).reference, kind: 'CORRECTION' },
      document,
      usedValueKes: money(w.depts.reduce((s, x) => s + usedValue(x), 0)),
      replayed: false,
    };
    w.correctKeys[input.idempotencyKey] = result;
    return wait(result, 450);
  },

  /** BD21 */
  sheet(dayId: string, version?: number): Promise<DaySheet> {
    const w = ensureWorld();
    if (dayId !== TODAY_ID || !w.closed) return Promise.reject(new ApiError('This day has not been closed yet.', 409, 'DAY_NOT_CLOSED'));
    const v = version ?? w.sheets.length;
    const doc = w.sheets[v - 1];
    if (!doc) return Promise.reject(new ApiError('That version does not exist.', 404, 'DAY_NOT_CLOSED'));
    return wait(buildSheet(w, doc), 150);
  },

  // The Branch Manager's blind count for a department that has not counted (B15).
  count(departmentId: string): Promise<CountView> {
    const w = ensureWorld();
    return wait(countView(w, departmentId));
  },

  saveCount(departmentId: string, input: SaveCountInput): Promise<SaveCountResult> {
    const w = ensureWorld();
    const draft = (w.drafts[departmentId] ??= {});
    for (const l of input.lines) {
      if (l.countedQty === null) delete draft[l.itemId];
      else draft[l.itemId] = l.countedQty;
    }
    return wait({ savedAt: new Date().toISOString(), view: countView(w, departmentId) }, 120);
  },

  signCount(departmentId: string, input: SignCountInput): Promise<SignCountResult> {
    const w = ensureWorld();
    const earlier = w.signKeys[input.idempotencyKey];
    if (earlier) return wait({ ...earlier, replayed: true });
    const d = w.depts.find((x) => x.id === departmentId);
    if (!d) return Promise.reject(new ApiError('That department is not on the day.', 404, 'NOT_YOUR_DEPARTMENT'));
    if (d.countedAt !== null) return Promise.reject(new ApiError('This department has already signed its count.', 409, 'ALREADY_COUNTED'));
    if (input.pin !== PIN) return wait(null, 300).then(() => Promise.reject(new ApiError('That PIN is not right.', 403, 'INVALID_PIN')));
    const view = countView(w, departmentId);
    if (view.summary.blankCount > 0) return Promise.reject(new ApiError('Count every item before you sign.', 409, 'COUNT_INCOMPLETE'));
    // The typed figures become the closing stock of the day (rows are readonly tuples, so rebuild).
    const draft = w.drafts[departmentId] ?? {};
    const rows = d.rows.map((r, i): Row => {
      const typed = draft[itemId(deptNumber(d), i + 1)];
      return typed === undefined ? r : [r[0], r[1], r[2], r[3], r[4], Number(typed), r[6], r[7]];
    });
    // Fixed at Paper's 7:24 pm so the story reads the same whatever the clock says.
    const signedAt = at('19:24');
    w.depts = w.depts.map((x) => (x.id === d.id ? { ...x, rows, countedAt: signedAt, onBehalf: true } : x));
    const result: SignCountResult = { view: countView(w, departmentId), signedAt, onBehalf: true, replayed: false };
    w.signKeys[input.idempotencyKey] = result;
    return wait(result, 450);
  },
};

function countView(w: World, departmentId: string): CountView {
  const d = w.depts.find((x) => x.id === departmentId) ?? w.depts[4];
  if (!d) throw new ApiError('That department is not on the day.', 404, 'NOT_YOUR_DEPARTMENT');
  const draft = w.drafts[d.id] ?? {};
  const counted = d.countedAt !== null;
  const lines: CountLine[] = d.rows.map((r, i) => {
    const id = itemId(deptNumber(d), i + 1);
    return { itemId: id, itemName: r[0], unit: r[1], categoryPath: [d.name], countedQty: counted ? String(r[5]) : (draft[id] ?? null) };
  });
  const filled = lines.filter((l) => l.countedQty !== null).length;
  return {
    day: dayHead(w),
    department: { id: d.id, name: d.name },
    onBehalfOfDepartment: true,
    state: counted ? 'COUNTED' : 'NOT_COUNTED',
    lines,
    summary: { itemCount: lines.length, filledCount: filled, blankCount: lines.length - filled, groups: [{ name: d.name, itemCount: lines.length }] },
    canSign: filled === lines.length && !counted,
    signedAt: d.countedAt,
    signedBy: counted ? P.peter : null,
  };
}

// --- Part 2 helpers: past days, activity, the sheet --------------------------------------------------------------------

const LUCY = person('20000000-0000-4000-8000-000000000020', 'Lucy Wanjiku', 'Branch Manager');
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const rebase = (iso: string, date: string): string => `${date}${iso.slice(10)}`;

/** Nyeri's earlier closed days (Paper B10): number, used value, closing stock value. */
const PAST_NYR: readonly (readonly [number, number, number])[] = [
  [43, 47310, 219850],
  [42, 52940, 221400],
  [41, 38120, 224780],
  [40, 61480, 218950],
  [39, 49870, 230100],
  [38, 44210, 226300],
];
const PAST_KRT: readonly (readonly [number, number, number])[] = [
  [30, 31480, 128900],
  [29, 29870, 131250],
  [28, 33020, 127600],
];
const pastId = (n: number, prefix = '70'): string => `${prefix}000000-0000-4000-8000-0000000000${n}`;

/** A fixed, fully counted copy of the day for every earlier closed day. */
function pastDepts(): MockDept[] {
  return buildDepts('ready');
}

function pastHead(dayId: string): DayHead {
  const n = Number(dayId.slice(-2));
  const krt = dayId.startsWith('71');
  const k = krt ? PAST_KRT.findIndex((p) => p[0] === n) : PAST_NYR.findIndex((p) => p[0] === n);
  return { id: dayId, reference: `DAY-${krt ? 'KRT' : 'NYR'}-00${n}`, date: addDays(nairobiToday(), -(Math.max(k, 0) + 1)), status: 'CLOSED' };
}

const pastClosedAt = (date: string): string => new Date(`${date}T19:48:00+03:00`).toISOString();

function pastDocument(dayId: string): DayDocument {
  const head = pastHead(dayId);
  return { id: `c1000000-0000-4000-8000-0000000000${dayId.slice(-2)}`, version: 1, kind: 'AT_THE_CLOSE', latest: true, reference: head.reference, pages: 6, madeAt: pastClosedAt(head.date) };
}

function historyRows(w: World, withMoney: boolean): HistoryRow[] {
  const today = dayHead(w);
  const rows: HistoryRow[] = [];
  rows.push({
    id: today.id,
    reference: today.reference,
    date: today.date,
    branch: NYERI,
    departmentsCounted: w.depts.filter((d) => d.countedAt !== null).length,
    departmentsTotal: w.depts.length,
    status: today.status,
    closedBy: w.closed ? P.peter : null,
    closedAt: w.closed?.at ?? null,
    ...(withMoney ? { usedValueKes: w.closed ? money(w.depts.reduce((s, d) => s + usedValue(d), 0)) : null, closingValueKes: w.closed ? money(w.depts.reduce((s, d) => s + closingValue(d), 0)) : null } : {}),
  });
  PAST_NYR.forEach(([n, usedV, closingV], k) => {
    const date = addDays(nairobiToday(), -(k + 1));
    rows.push({ id: pastId(n), reference: `DAY-NYR-00${n}`, date, branch: NYERI, departmentsCounted: 5, departmentsTotal: 5, status: 'CLOSED', closedBy: P.peter, closedAt: pastClosedAt(date), ...(withMoney ? { usedValueKes: usedV.toFixed(2), closingValueKes: closingV.toFixed(2) } : {}) });
  });
  rows.push({ id: pastId(31, '71'), reference: 'DAY-KRT-0031', date: today.date, branch: KARATINA, departmentsCounted: 0, departmentsTotal: 4, status: 'OPEN', closedBy: null, closedAt: null, ...(withMoney ? { usedValueKes: null, closingValueKes: null } : {}) });
  PAST_KRT.forEach(([n, usedV, closingV], k) => {
    const date = addDays(nairobiToday(), -(k + 1));
    rows.push({ id: pastId(n, '71'), reference: `DAY-KRT-00${n}`, date, branch: KARATINA, departmentsCounted: 4, departmentsTotal: 4, status: 'CLOSED', closedBy: LUCY, closedAt: pastClosedAt(date), ...(withMoney ? { usedValueKes: usedV.toFixed(2), closingValueKes: closingV.toFixed(2) } : {}) });
  });
  return rows;
}

function lineCorrection(w: World, itemIdValue: string): LineCorrection | null {
  const all = w.corrections.filter((c) => c.itemId === itemIdValue);
  const first = all[0];
  const last = all.at(-1);
  if (!first || !last) return null;
  return { id: last.id, at: last.at, by: P.peter, fromClosingQty: String(first.fromClosing), toClosingQty: String(last.toClosing), fromUsedQty: String(first.fromUsed), toUsedQty: String(last.toUsed), reason: last.reason, note: last.note };
}

function figureLine(w: World, d: MockDept, index: number): FigureLine {
  const r = d.rows[index];
  if (!r) throw new ApiError('That item is not on this department’s day.', 404, 'ITEM_NOT_IN_DAY');
  const id = itemId(deptNumber(d), index + 1);
  return {
    itemId: id,
    itemName: r[0],
    unit: r[1],
    openingQty: String(r[2]),
    receivedQty: String(r[3]),
    wasteQty: String(r[4]),
    closingQty: String(r[5]),
    usedQty: String(used(r)),
    yesterdayUsedQty: String(r[7]),
    ...(hasCosts() ? { unitCostKes: money(r[6]), usedValueKes: money(used(r) * r[6]), closingValueKes: money(r[5] * r[6]) } : {}),
    correction: lineCorrection(w, id),
  };
}

const pluralItems = (n: number): string => `${n} ${n === 1 ? 'item' : 'items'}`;
const REASON_WORDS: Record<CorrectionReason, string> = { COUNTED_WRONGLY: 'counted wrongly', ITEM_WAS_MISSED: 'item was missed', OTHER: 'other' };

/** BD17's rows, newest first (contract §9): openings, counts, the close and every correction, with Paper's sentences. */
function activityOf(w: World, depts: MockDept[], isToday: boolean, head: DayHead): DayActivityEntry[] {
  const out: DayActivityEntry[] = [];
  const closedAt = isToday ? (w.closed?.at ?? null) : pastClosedAt(head.date);
  let n = 0;
  const push = (entry: Omit<DayActivityEntry, 'id'>): void => {
    n += 1;
    out.push({ id: `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, ...entry });
  };
  for (const d of depts) {
    if (d.opening.state === 'ACCEPTED' && d.opening.checkedAt && d.opening.checkedBy) {
      push({ at: rebase(d.opening.checkedAt, head.date), actor: d.opening.checkedBy, type: 'OPENING_ACCEPTED', sentence: `Checked the opening: ${d.name}, same as last night`, detail: null, link: null });
    }
    if (d.opening.state === 'RECOUNTED' && d.opening.checkedAt && d.opening.checkedBy) {
      const diff = d.opening.differences[0];
      const sentence =
        d.opening.differences.length === 1 && diff
          ? `Recorded the opening: ${diff.itemName}, ${Math.abs(Number(diff.difference))} ${Number(diff.difference) < 0 ? 'less' : 'more'} than last night (${diff.lastNightQty} → ${diff.countedQty})`
          : `Recorded the opening: ${d.name}, ${d.opening.differences.length} differences`;
      push({ at: rebase(d.opening.checkedAt, head.date), actor: d.opening.checkedBy, type: 'OPENING_RECOUNTED', sentence, detail: null, link: null });
    }
    if (d.countedAt) {
      push({
        at: rebase(d.countedAt, head.date),
        actor: d.onBehalf ? P.peter : d.head,
        type: d.onBehalf ? 'COUNT_SIGNED_ON_BEHALF' : 'COUNT_SIGNED',
        sentence: d.onBehalf ? `Counted and signed on behalf of ${d.name}, ${pluralItems(d.rows.length)}` : `Counted and signed: ${d.name}, ${pluralItems(d.rows.length)}`,
        detail: null,
        link: null,
      });
    }
  }
  if (closedAt) {
    const entryCount = depts.flatMap((d) => d.rows.filter((r) => used(r) !== 0)).length;
    push({
      at: closedAt,
      actor: P.peter,
      type: 'DAY_CLOSED',
      sentence: `Closed the day · Used today KES ${Math.round(isToday && w.closedUsedValue !== null ? w.closedUsedValue : depts.reduce((s, d) => s + usedValue(d), 0)).toLocaleString('en-KE')}`,
      detail: `${entryCount} usage entries written to the stock ledger. Signed with PIN.`,
      link: { kind: 'DAY', id: head.id, reference: head.reference },
    });
  }
  if (isToday) {
    for (const c of w.corrections) {
      push({
        at: c.at,
        actor: P.peter,
        type: 'COUNT_CORRECTED',
        sentence: `Corrected a count: ${c.itemName} (${c.departmentName}), closing stock ${c.fromClosing} → ${c.toClosing}`,
        detail: `Reason: ${REASON_WORDS[c.reason]}.${c.note ? ` Note: ${c.note}` : ''} Signed with PIN.`,
        link: { kind: 'LEDGER_ENTRY', id: c.id, reference: null },
      });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** The stored day sheet of one version (BD21): version n includes the first n − 1 corrections. */
function buildSheet(w: World, doc: DayDocument): DaySheet {
  const included = w.corrections.slice(0, doc.version - 1);
  let page = 2;
  const departments: SheetDepartment[] = w.depts.map((d, di) => {
    const lines: SheetLine[] = d.rows.map((r, i) => {
      const id = itemId(deptNumber(d), i + 1);
      const mine = included.filter((c) => c.itemId === id);
      const everyone = w.corrections.filter((c) => c.itemId === id);
      const original = everyone[0] ? everyone[0].fromClosing : r[5];
      const firstMine = mine[0];
      const lastMine = mine.at(-1);
      const closing = lastMine ? lastMine.toClosing : original;
      const usedQty = r[2] + r[3] - r[4] - closing;
      const correction: LineCorrection | null =
        firstMine && lastMine
          ? { id: lastMine.id, at: lastMine.at, by: P.peter, fromClosingQty: String(firstMine.fromClosing), toClosingQty: String(lastMine.toClosing), fromUsedQty: String(firstMine.fromUsed), toUsedQty: String(lastMine.toUsed), reason: lastMine.reason, note: lastMine.note }
          : null;
      return { position: i + 1, itemName: r[0], unit: r[1], openingQty: String(r[2]), receivedQty: String(r[3]), wasteQty: String(r[4]), closingQty: String(closing), usedQty: String(usedQty), usedValueKes: money(usedQty * r[6]), closingValueKes: money(closing * r[6]), correction };
    });
    const pages = Math.max(1, Math.ceil(d.rows.length / SHEET_ROWS_PER_PAGE));
    const startPage = page;
    page += pages;
    return {
      position: di + 1,
      department: { id: d.id, name: d.name },
      head: d.head,
      itemCount: d.rows.length,
      usedValueKes: money(lines.reduce((s, l) => s + Number(l.usedValueKes), 0)),
      closingValueKes: money(lines.reduce((s, l) => s + Number(l.closingValueKes), 0)),
      page: startPage,
      corrected: lines.some((l) => l.correction !== null),
      countedAt: d.countedAt ?? doc.madeAt,
      countedBy: d.onBehalf ? P.peter : d.head,
      onBehalf: d.onBehalf,
      opening: { state: d.opening.state, checkedAt: d.opening.checkedAt, differenceCount: d.opening.differences.length },
      delivery: d.deliveryAt !== null ? { state: 'CONFIRMED', dispatches: [] } : { state: 'NONE', dispatches: [] },
      lines,
    };
  });
  const lastCorrection = included.at(-1);
  const head = dayHead(w);
  return {
    reference: head.reference,
    date: head.date,
    branch: { id: NYERI.id, name: NYERI.name, code: NYERI.code, address: 'Kimathi Way, Nyeri', phone: '+254 700 000 000' },
    version: doc.version,
    kind: doc.kind,
    closedAt: w.closed?.at ?? doc.madeAt,
    closedBy: P.peter,
    correctedAt: lastCorrection?.at ?? null,
    printedAt: new Date().toISOString(),
    totals: {
      itemCount: departments.reduce((s, d) => s + d.itemCount, 0),
      usedValueKes: money(departments.reduce((s, d) => s + Number(d.usedValueKes), 0)),
      closingValueKes: money(departments.reduce((s, d) => s + Number(d.closingValueKes), 0)),
    },
    pageCount: page - 1,
    departments,
    corrections: included.map((c) => ({ at: c.at, by: P.peter, departmentName: c.departmentName, itemName: c.itemName, fromClosingQty: String(c.fromClosing), toClosingQty: String(c.toClosing), reason: c.reason })),
    notes: {
      openingNotChecked: w.depts.filter((d) => d.opening.state === 'NOT_CHECKED').map((d) => d.name),
      openDiscrepancies: [{ reference: 'DSC-NYR-0007', departmentName: 'Barista', itemName: 'Milk 1L' }],
    },
    qrUrl: `${typeof window === 'undefined' ? '' : window.location.origin}/app/branch/day/file/${head.id}`,
  };
}

/** Who is reading, for the mock's role-dependent answers. */
export const mockRole = (): string | null => useAuthStore.getState().user?.role ?? null;
export const MOCK_PIN = PIN;
