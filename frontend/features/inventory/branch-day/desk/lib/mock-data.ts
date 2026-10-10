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
  CountLine,
  CountView,
  DayHead,
  DepartmentFigures,
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

function ensureWorld(): World {
  if (world) return world;
  const scenario = readScenario();
  world = { scenario, depts: buildDepts(scenario), drafts: {}, closed: null, closeKey: null, signKeys: {} };
  if (scenario === 'closed') world.closed = { at: at('19:48'), result: makeCloseResult(world, 'seed') };
  return world;
}

/** Test seam: start again from a chosen state. */
export function resetMockWorld(scenario: Scenario = 'blocked'): void {
  world = { scenario, depts: buildDepts(scenario), drafts: {}, closed: null, closeKey: null, signKeys: {} };
  if (scenario === 'closed') world.closed = { at: at('19:48'), result: makeCloseResult(world, 'seed') };
}

// --- Figures ---------------------------------------------------------------------------------------------------

const used = (r: Row): number => r[2] + r[3] - r[4] - r[5];
const money = (n: number): string => n.toFixed(2);
const usedValue = (d: MockDept): number => d.rows.reduce((s, r) => s + used(r) * r[6], 0);
const closingValue = (d: MockDept): number => d.rows.reduce((s, r) => s + r[5] * r[6], 0);
const deptNumber = (d: MockDept): number => Number(d.id.slice(-1));

const hasCosts = (): boolean => usePermissionsStore.getState().capabilities.includes('catalog.see_costs');
const can = (capability: string): boolean => (usePermissionsStore.getState().capabilities as readonly string[]).includes(capability);

const dayHead = (w: World): DayHead => ({ id: '70000000-0000-4000-8000-000000000044', reference: 'DAY-NYR-0044', date: nairobiToday(), status: w.closed ? 'CLOSED' : 'OPEN' });

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

  figures(_dayId: string, departmentId: string): Promise<DepartmentFigures> {
    const failed = failOnce('figures');
    if (failed) return failed;
    const w = ensureWorld();
    const d = w.depts.find((x) => x.id === departmentId) ?? w.depts[0];
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
      correction: null,
    }));
    const wasteEntries = d.rows.reduce((s, r) => s + (r[4] > 0 ? 1 : 0), 0);
    return wait({
      day: dayHead(w),
      branch: NYERI,
      rail: w.depts.map((x) => tile(x, withMoney)),
      ...(withMoney ? { branchUsedValueKes: money(w.depts.filter((x) => x.countedAt !== null).reduce((s, x) => s + usedValue(x), 0)) } : {}),
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
        can: { correct: false },
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
    return wait(w.closed.result, 500);
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

/** Who is reading, for the mock's role-dependent answers. */
export const mockRole = (): string | null => useAuthStore.getState().user?.role ?? null;
export const MOCK_PIN = PIN;
