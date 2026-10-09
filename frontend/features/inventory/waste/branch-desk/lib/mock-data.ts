import { ApiError } from '@/types/api';
import { nairobiToday } from '@/components/ui2/data-table/table-dates';
import type { KpiCell, Person } from '../../../_shared/types/wire';
import {
  WASTE_REASON_TEXT,
  WASTE_REVERSAL_TEXT,
  type AllBranchesWasteQuery,
  type BranchWasteDepartment,
  type BranchWasteDetail,
  type BranchWasteEntry,
  type BranchWasteList,
  type BranchWasteListQuery,
  type ReverseBranchWasteInput,
  type WasteReason,
} from '../../_shared/types/waste-contract';

/**
 * Branch waste, desktop screens, fixtures first (Block 3). Served only while `BRANCH_WASTE_MOCK` is on (see `branch-waste-desk-api.ts`);
 * once feat/block3-be lands the flag is off and none of this runs. The first nine rows of "today" are Paper W6's own example data; the
 * rest are generated so the Date filter, the pager and the filters have something to work on. The server decides every word of a KPI
 * caption; here they are the contract's samples.
 */

const NYERI = { id: '20000000-0000-4000-8000-000000000001', name: 'Nyeri Town', code: 'NYR' };
const KARATINA = { id: '20000000-0000-4000-8000-000000000002', name: 'Karatina', code: 'KRT' };

const dept = (id: string, name: string): BranchWasteDepartment => ({ id: `30000000-0000-4000-8000-0000000000${id}`, name });
const D = {
  kitchen: dept('01', 'Kitchen'),
  pastry: dept('02', 'Pastry'),
  barista: dept('03', 'Barista'),
  service: dept('04', 'Service'),
  kKitchen: dept('11', 'Kitchen'),
  kPastry: dept('12', 'Pastry'),
};

const person = (id: string, name: string, roleLabel: string): Person => ({ id, name, initials: name.split(' ').map((w) => w[0]).join(''), roleLabel });
const P = {
  grace: person('u-grace', 'Grace Wanjiru', 'Kitchen head'),
  ann: person('u-ann', 'Ann Kamau', 'Pastry head'),
  david: person('u-david', 'David Mutua', 'Barista member'),
  john: person('u-john', 'John Maina', 'Service head'),
  joyce: person('u-joyce', 'Joyce Mwende', 'Kitchen member'),
  peter: person('u-peter', 'Peter Njoroge', 'Pastry member'),
};

/** The Nairobi day `offset` days before today, as `YYYY-MM-DD`. */
function dayBefore(offset: number): string {
  const d = new Date(`${nairobiToday()}T12:00:00+03:00`);
  d.setUTCDate(d.getUTCDate() - offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d);
}
const at = (offset: number, clock: string): string => new Date(`${dayBefore(offset)}T${clock}:00+03:00`).toISOString();

interface Seed {
  n: number;
  day: number;
  clock: string;
  item: string;
  qty: string;
  unit: string;
  dept: BranchWasteDepartment;
  reason: WasteReason;
  by: Person;
  value: string;
  branch?: typeof NYERI;
  reversed?: { clock: string; reason: 'WRONG_ITEM' | 'WRONG_QUANTITY' | 'OTHER'; note?: string };
  note?: string;
}

const TODAY: Seed[] = [
  { n: 1, day: 0, clock: '17:40', item: 'Beef stew', qty: '2', unit: 'kg', dept: D.kitchen, reason: 'EXPIRY', by: P.grace, value: '640' },
  { n: 2, day: 0, clock: '16:15', item: 'Croissants', qty: '6', unit: 'pcs', dept: D.pastry, reason: 'EXPIRY', by: P.ann, value: '480' },
  { n: 3, day: 0, clock: '15:30', item: 'Milk', qty: '3', unit: 'L', dept: D.barista, reason: 'SPOILAGE', by: P.david, value: '450' },
  { n: 4, day: 0, clock: '14:20', item: 'Marinated chicken', qty: '3', unit: 'kg', dept: D.kitchen, reason: 'EXPIRY', by: P.grace, value: '1260' },
  { n: 5, day: 0, clock: '14:20', item: 'Kachumbari mix', qty: '2', unit: 'kg', dept: D.kitchen, reason: 'SPOILAGE', by: P.grace, value: '360', note: 'Left out of the cold room overnight.' },
  { n: 6, day: 0, clock: '11:05', item: 'Cake slices', qty: '4', unit: 'pcs', dept: D.pastry, reason: 'DAMAGE_IN_STORE', by: P.ann, value: '520' },
  { n: 7, day: 0, clock: '10:10', item: 'Sugar sachets', qty: '40', unit: 'pcs', dept: D.service, reason: 'DAMAGE_IN_STORE', by: P.john, value: '120' },
  { n: 8, day: 0, clock: '09:05', item: 'Milk', qty: '6', unit: 'L', dept: D.barista, reason: 'SPOILAGE', by: P.david, value: '900', reversed: { clock: '09:12', reason: 'WRONG_ITEM' } },
  { n: 9, day: 0, clock: '08:40', item: 'Fries portions', qty: '5', unit: 'pcs', dept: D.kitchen, reason: 'PREP_ERROR', by: P.grace, value: '250' },
];

const KARATINA_TODAY: Seed[] = [
  { n: 101, day: 0, clock: '16:50', item: 'Samosas', qty: '12', unit: 'pcs', dept: D.kKitchen, reason: 'EXPIRY', by: P.joyce, value: '600', branch: KARATINA },
  { n: 102, day: 0, clock: '15:10', item: 'Marinated chicken', qty: '4', unit: 'kg', dept: D.kKitchen, reason: 'EXPIRY', by: P.joyce, value: '1680', branch: KARATINA },
  { n: 103, day: 0, clock: '13:25', item: 'Muffins', qty: '8', unit: 'pcs', dept: D.kPastry, reason: 'SPOILAGE', by: P.peter, value: '640', branch: KARATINA },
  { n: 104, day: 0, clock: '11:40', item: 'Pilau', qty: '3', unit: 'kg', dept: D.kKitchen, reason: 'PREP_ERROR', by: P.joyce, value: '420', branch: KARATINA },
  { n: 105, day: 0, clock: '09:30', item: 'Bread rolls', qty: '10', unit: 'pcs', dept: D.kPastry, reason: 'EXPIRY', by: P.peter, value: '300', branch: KARATINA, reversed: { clock: '09:44', reason: 'WRONG_QUANTITY' } },
];

const OLD_ITEMS: [string, string, string, BranchWasteDepartment, WasteReason, Person, string][] = [
  ['Beef stew', '1.5', 'kg', D.kitchen, 'EXPIRY', P.grace, '480'],
  ['Croissants', '4', 'pcs', D.pastry, 'SPOILAGE', P.ann, '320'],
  ['Milk', '2', 'L', D.barista, 'SPOILAGE', P.david, '300'],
  ['Pilau', '2', 'kg', D.kitchen, 'PREP_ERROR', P.grace, '280'],
  ['Cake slices', '3', 'pcs', D.pastry, 'DAMAGE_IN_STORE', P.ann, '390'],
  ['Sugar sachets', '25', 'pcs', D.service, 'DAMAGE_IN_STORE', P.john, '75'],
];
const OLDER: Seed[] = Array.from({ length: 36 }, (_, i) => {
  const [item, qty, unit, d, reason, by, value] = OLD_ITEMS[i % OLD_ITEMS.length] as (typeof OLD_ITEMS)[number];
  const hour = 8 + ((i * 3) % 10);
  return { n: 200 + i, day: 1 + (i % 6), clock: `${String(hour).padStart(2, '0')}:${i % 2 ? '15' : '40'}`, item, qty, unit, dept: d, reason, by, value };
});

function toEntry(s: Seed): BranchWasteEntry {
  const reversed = s.reversed !== undefined;
  return {
    id: `e0000000-0000-4000-8000-${String(s.n).padStart(12, '0')}`,
    at: at(s.day, s.clock),
    itemId: `10000000-0000-4000-8000-${String(s.n).padStart(12, '0')}`,
    itemName: s.item,
    quantity: s.qty,
    unit: s.unit,
    reason: s.reason,
    reasonText: WASTE_REASON_TEXT[s.reason],
    note: s.note ?? null,
    loggedBy: s.by,
    valueKes: reversed ? '0.00' : `${s.value}.00`,
    status: reversed ? 'REVERSED' : 'LOGGED',
    reversal: s.reversed
      ? { at: at(s.day, s.reversed.clock), by: s.by, reason: s.reversed.reason, reasonText: WASTE_REVERSAL_TEXT[s.reversed.reason], note: s.reversed.note ?? null }
      : null,
    can: { reverse: false },
    department: s.dept,
    branch: s.branch ?? NYERI,
  };
}

let store: BranchWasteEntry[] | null = null;
const all = (): BranchWasteEntry[] => {
  store ??= [...TODAY, ...KARATINA_TODAY, ...OLDER].map(toEntry);
  return store;
};

const inDay = (iso: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date(iso));
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 220));

/** Test hook: `globalThis.__branchWasteMockFail = 'ALREADY_REVERSED'` makes the next write fail with that code (or `'LOAD'` the next read). */
const flags = globalThis as { __branchWasteMockFail?: string };
function maybeFail(kind: 'LOAD' | 'WRITE'): void {
  const code = flags.__branchWasteMockFail;
  if (!code) return;
  if (kind === 'LOAD' && code === 'LOAD') {
    flags.__branchWasteMockFail = undefined;
    throw new ApiError('Mock load failure', 500, 'INTERNAL');
  }
  if (kind === 'WRITE' && code !== 'LOAD') {
    flags.__branchWasteMockFail = undefined;
    throw new ApiError('Mock write failure', code === 'ALREADY_REVERSED' ? 409 : 500, code);
  }
}

function kpisFor(rows: BranchWasteEntry[], everyBranch: boolean): KpiCell[] {
  const live = (e: BranchWasteEntry): boolean => e.status === 'LOGGED';
  const today = dayBefore(0);
  const todays = rows.filter((e) => inDay(e.at) === today && live(e));
  const money = (list: BranchWasteEntry[]): number => list.reduce((sum, e) => sum + Number(e.valueKes ?? 0), 0);
  const week = rows.filter((e) => inDay(e.at) >= dayBefore(6) && live(e));
  const reversed = rows.filter((e) => e.reversal && inDay(e.reversal.at) >= dayBefore(6)).length;
  const byItem = new Map<string, number>();
  for (const e of week) byItem.set(e.itemName, (byItem.get(e.itemName) ?? 0) + Number(e.valueKes ?? 0));
  const top = Array.from(byItem.entries()).sort((a, b) => b[1] - a[1])[0];
  const fmt = (n: number): string => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(n);
  const branches = new Set(todays.map((e) => e.branch.id)).size;
  return [
    { key: 'today', label: 'TODAY', value: fmt(money(todays)), caption: `KES · ${todays.length} entries${everyBranch ? ` · ${branches} ${branches === 1 ? 'branch' : 'branches'}` : ''}`, tone: 'NEUTRAL' },
    { key: 'last7', label: 'LAST 7 DAYS', value: fmt(money(week)), caption: `KES · ${week.length} entries`, tone: 'NEUTRAL' },
    { key: 'most', label: 'MOST WASTED · 7 DAYS', value: top ? top[0] : 'Nothing yet', caption: top ? `KES ${fmt(top[1])}${everyBranch ? '' : ' · Kitchen'} · mostly expired` : 'No waste in 7 days', tone: 'WARN' },
    { key: 'reversed', label: 'REVERSED · 7 DAYS', value: String(reversed), caption: everyBranch ? 'Each by its own department' : 'Both by their own department', tone: 'NEUTRAL' },
  ];
}

function filterRows(rows: BranchWasteEntry[], q: BranchWasteListQuery): BranchWasteEntry[] {
  const needle = q.search?.trim().toLowerCase() ?? '';
  const from = q.from ?? dayBefore(0);
  const to = q.to ?? q.from ?? dayBefore(0);
  return rows
    .filter((e) => {
      const day = inDay(e.at);
      if (day < from || day > to) return false;
      if (q.departmentId && e.department.id !== q.departmentId) return false;
      if (q.reason && e.reason !== q.reason) return false;
      if (q.status === 'logged' && e.status !== 'LOGGED') return false;
      if (q.status === 'reversed' && e.status !== 'REVERSED') return false;
      if (needle && !`${e.itemName} ${e.loggedBy.name}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

function page(rows: BranchWasteEntry[], q: BranchWasteListQuery): { rows: BranchWasteEntry[]; page: BranchWasteList['page'] } {
  const pageSize = q.pageSize ?? 50;
  const current = Math.max(1, q.page ?? 1);
  return { rows: rows.slice((current - 1) * pageSize, current * pageSize), page: { page: current, pageSize, total: rows.length } };
}

const withReverse = (e: BranchWasteEntry, can: boolean): BranchWasteEntry => ({ ...e, can: { reverse: can && e.status === 'LOGGED' } });
const departmentsOf = (rows: BranchWasteEntry[]): BranchWasteDepartment[] => Array.from(new Map(rows.map((e): [string, BranchWasteDepartment] => [e.department.name, e.department])).values());

export const mockBranchWaste = {
  /** BW4: the Branch Manager's own branch (Nyeri Town). */
  async branch(q: BranchWasteListQuery): Promise<BranchWasteList> {
    await tick();
    maybeFail('LOAD');
    const own = all().filter((e) => e.branch.id === NYERI.id);
    const found = page(filterRows(own, q), q);
    return { kpis: kpisFor(own, false), rows: found.rows.map((e) => withReverse(e, true)), departments: departmentsOf(own), page: found.page };
  },
  /** BW5: every branch, read only. */
  async branches(q: AllBranchesWasteQuery): Promise<BranchWasteList> {
    await tick();
    maybeFail('LOAD');
    const scoped = all().filter((e) => !q.branchId || e.branch.id === q.branchId);
    const found = page(filterRows(scoped, q), q);
    return { kpis: kpisFor(scoped, !q.branchId), rows: found.rows.map((e) => withReverse(e, false)), departments: departmentsOf(scoped), branches: [NYERI, KARATINA].map(({ id, name }) => ({ id, name })), page: found.page };
  },
  /** BW6 */
  async detail(id: string): Promise<BranchWasteDetail> {
    await tick();
    maybeFail('LOAD');
    const entry = all().find((e) => e.id === id);
    if (!entry) throw new ApiError('Not found', 404, 'NOT_FOUND');
    const ledger: NonNullable<BranchWasteDetail['ledger']> = [{ kind: 'LOGGED', at: entry.at, quantity: `-${entry.quantity}` }];
    if (entry.reversal) ledger.push({ kind: 'REVERSAL', at: entry.reversal.at, quantity: entry.quantity });
    return { entry: withReverse(entry, entry.branch.id === NYERI.id), ledger };
  },
  /** BW7: the original stays, the entry is stamped reversed and reads 0. */
  async reverse(id: string, input: ReverseBranchWasteInput): Promise<BranchWasteEntry> {
    await tick();
    maybeFail('WRITE');
    const rows = all();
    const index = rows.findIndex((e) => e.id === id);
    const entry = rows[index];
    if (!entry) throw new ApiError('Not found', 404, 'NOT_FOUND');
    if (entry.status === 'REVERSED') throw new ApiError('That entry was already reversed.', 409, 'ALREADY_REVERSED');
    const me = P.david;
    const done: BranchWasteEntry = {
      ...entry,
      status: 'REVERSED',
      valueKes: '0.00',
      reversal: { at: new Date().toISOString(), by: me, reason: input.reason, reasonText: WASTE_REVERSAL_TEXT[input.reason], note: input.note ?? null },
      can: { reverse: false },
    };
    rows[index] = done;
    return done;
  },
};
