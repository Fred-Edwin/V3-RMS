/**
 * In-memory Branch waste for the phone screens, used only while `NEXT_PUBLIC_BRANCH_WASTE_MOCK=true` (see `branch-waste-api.ts`).
 * Built from the contract fixtures (`waste-contract.fixtures.json`, the Kitchen department of Nyeri Town), re-dated so the first
 * entries are today. It applies the same rules the server will (the same-day reverse window, own entries only, idempotent log,
 * no money or stock keys) so the screens can be walked end to end. Test aids on `window.__bwMock` (browser only):
 * `failNext('items' | 'log' | 'mine' | 'reverse', code?)`, `delay(ms)`, `seedMany(n)`.
 */
import { ApiError } from '@/types/api';
import { useAuthStore } from '@/store/authStore';
import fixtures from '../../_shared/types/waste-contract.fixtures.json';
import { BRANCH_WASTE_ERROR_COPY } from '../../_shared/lib/branch-waste-copy';
import {
  WASTE_REASON_TEXT,
  WASTE_REVERSAL_TEXT,
  type BranchWasteEntry,
  type BranchWasteErrorCode,
  type BranchWasteItems,
  type LogBranchWasteInput,
  type LogBranchWasteResult,
  type MyBranchWasteList,
  type MyBranchWasteQuery,
  type ReverseBranchWasteInput,
  type WasteItemOption,
} from '../../_shared/types/waste-contract';
import type { BranchWasteApi } from './branch-waste-api';

const NAIROBI = 'Africa/Nairobi';
const DAY_MS = 24 * 60 * 60 * 1000;
const nairobiDay = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI }).format(d);
const clock = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

const KITCHEN = { id: '30000000-0000-4000-8000-000000000001', name: 'Kitchen' };
const BRANCH = (fixtures.myBranchWasteList.rows[0] as unknown as BranchWasteEntry).branch;
const id = (n: number): string => `10000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;

const CATALOG: WasteItemOption[] = [
  { itemId: id(1), name: 'Marinated chicken', unit: 'kg' },
  { itemId: id(2), name: 'Kachumbari mix', unit: 'kg' },
  { itemId: id(3), name: 'Milk', unit: 'L' },
  { itemId: id(4), name: 'Beef stew', unit: 'kg' },
  { itemId: id(5), name: 'Pilau', unit: 'kg' },
  { itemId: id(6), name: 'Bread rolls', unit: 'pcs' },
  { itemId: id(7), name: 'Fries portions', unit: 'pcs' },
  { itemId: id(8), name: 'Samosas', unit: 'pcs' },
  { itemId: id(9), name: 'Chapati', unit: 'pcs' },
  { itemId: id(10), name: 'Tomato sauce', unit: 'L' },
  { itemId: id(11), name: 'Cooked rice', unit: 'kg' },
  { itemId: id(12), name: 'Green salad', unit: 'kg' },
];
const OFTEN = CATALOG.slice(0, 6);

const me = () => {
  const u = useAuthStore.getState().user;
  const name = u?.name ?? 'Grace Wanjiru';
  const initials = name.split(/\s+/).map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase();
  return { id: u?.id ?? 'u-grace', name, initials, roleLabel: 'Kitchen head' };
};
const JOSEPH = { id: 'u-joseph', name: 'Joseph Mwangi', initials: 'JM', roleLabel: 'Kitchen member' };

const failures: Partial<Record<'items' | 'log' | 'mine' | 'reverse', string>> = {};
let delayMs = 250;
const wait = (): Promise<void> => new Promise((r) => setTimeout(r, delayMs));
async function maybeFail(op: keyof typeof failures): Promise<void> {
  await wait();
  const code = failures[op];
  if (code === undefined) return;
  delete failures[op];
  if (code === 'network') throw new TypeError('Failed to fetch');
  const known = code in BRANCH_WASTE_ERROR_COPY;
  throw new ApiError(known ? BRANCH_WASTE_ERROR_COPY[code as BranchWasteErrorCode] : 'Server error', known ? 409 : 500, code);
}

function entry(n: number, item: WasteItemOption, quantity: string, reason: BranchWasteEntry['reason'], at: Date, by: BranchWasteEntry['loggedBy'], note: string | null = null): BranchWasteEntry {
  return {
    id: `e0000000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`,
    at: at.toISOString(),
    itemId: item.itemId,
    itemName: item.name,
    quantity,
    unit: item.unit,
    reason,
    reasonText: WASTE_REASON_TEXT[reason],
    note,
    loggedBy: by,
    status: 'LOGGED',
    reversal: null,
    can: { reverse: false },
    department: KITCHEN,
    branch: BRANCH,
  };
}

/** Today at `hh:mm` Nairobi (UTC+3), `daysAgo` days back. */
function at(daysAgo: number, hh: number, mm: number): Date {
  const [y, m, d] = nairobiDay(new Date(Date.now() - daysAgo * DAY_MS)).split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hh - 3, mm));
}

let seq = 100;
let rows: BranchWasteEntry[] = [];
const batches = new Map<string, LogBranchWasteResult>();

function seed(): void {
  const who = me();
  const [chicken, kachumbari, milk, stew, , rolls, fries, samosas] = CATALOG as [WasteItemOption, WasteItemOption, WasteItemOption, WasteItemOption, WasteItemOption, WasteItemOption, WasteItemOption, WasteItemOption];
  const reversedAt = at(0, 9, 12);
  const reversed: BranchWasteEntry = {
    ...entry(1, milk, '6', 'SPOILAGE', at(0, 9, 5), who),
    status: 'REVERSED',
    reversal: { at: reversedAt.toISOString(), by: who, reason: 'WRONG_ITEM', reasonText: WASTE_REVERSAL_TEXT.WRONG_ITEM, note: null },
  };
  rows = [
    entry(2, kachumbari, '2', 'SPOILAGE', at(0, 14, 20), who),
    entry(3, chicken, '3', 'EXPIRY', at(0, 14, 20), who),
    reversed,
    entry(4, stew, '2', 'EXPIRY', at(0, 11, 5), JOSEPH),
    entry(5, fries, '5', 'PREP_ERROR', at(1, 8, 40), who),
    entry(6, samosas, '12', 'EXPIRY', at(1, 17, 5), JOSEPH),
    entry(7, rolls, '6', 'PREP_ERROR', at(4, 10, 15), JOSEPH),
  ];
  rows.sort((a, b) => b.at.localeCompare(a.at));
}

const isToday = (iso: string): boolean => nairobiDay(new Date(iso)) === nairobiDay(new Date());

function withCan(r: BranchWasteEntry): BranchWasteEntry {
  const mine = r.loggedBy.id === me().id;
  return { ...r, can: { reverse: r.status === 'LOGGED' && mine && isToday(r.at) } };
}

function bannerFor(list: BranchWasteEntry[]): string | null {
  const todays = list.filter((r) => r.loggedBy.id === me().id && isToday(r.at) && r.status === 'LOGGED');
  if (todays.length === 0) return null;
  const latest = todays[0]!;
  const batch = todays.filter((r) => r.at === latest.at);
  return `${batch.length} ${batch.length === 1 ? 'item' : 'items'} logged at ${clock(latest.at)}. You can reverse your own entries today.`;
}

export const mockBranchWasteApi: BranchWasteApi = {
  async items(query = {}) {
    await maybeFail('items');
    const q = (query.search ?? '').trim().toLowerCase();
    const items = CATALOG.filter((i) => q === '' || i.name.toLowerCase().includes(q));
    const result: BranchWasteItems = { often: OFTEN, items };
    return result;
  },

  async log(input: LogBranchWasteInput) {
    await maybeFail('log');
    if (rows.length === 0 && batches.size === 0) seed();
    const prior = batches.get(input.idempotencyKey);
    if (prior) return { ...prior, replayed: true };
    const when = new Date();
    const made = input.entries.map((e, i) => {
      const item = CATALOG.find((c) => c.itemId === e.inventoryItemId);
      if (!item) throw new ApiError(BRANCH_WASTE_ERROR_COPY.ITEM_NOT_IN_DEPARTMENT, 400, 'ITEM_NOT_IN_DEPARTMENT');
      return withCan(entry(++seq + i, item, e.quantity, e.reason, when, me(), input.note ?? null));
    });
    rows = [...made, ...rows];
    const result: LogBranchWasteResult = { entries: made, replayed: false };
    batches.set(input.idempotencyKey, result);
    return result;
  },

  async mine(query: MyBranchWasteQuery = {}) {
    await maybeFail('mine');
    if (rows.length === 0 && batches.size === 0) seed();
    const today = nairobiDay(new Date());
    const to = query.to ?? today;
    const from = query.from ?? nairobiDay(new Date(Date.now() - 6 * DAY_MS));
    const inRange = rows.filter((r) => {
      const day = nairobiDay(new Date(r.at));
      return day >= from && day <= to;
    });
    const pageSize = query.pageSize ?? 50;
    const page = query.page ?? 1;
    const result: MyBranchWasteList = {
      department: KITCHEN,
      rows: inRange.slice((page - 1) * pageSize, page * pageSize).map(withCan),
      bannerText: bannerFor(rows),
      page: { page, pageSize, total: inRange.length },
    };
    return result;
  },

  async reverse(entryId: string, input: ReverseBranchWasteInput) {
    await maybeFail('reverse');
    const found = rows.find((r) => r.id === entryId);
    const fail = (code: BranchWasteErrorCode, status = 409): never => {
      throw new ApiError(BRANCH_WASTE_ERROR_COPY[code], status, code);
    };
    if (!found) throw new ApiError('Not found', 404, 'NOT_FOUND');
    if (found.status === 'REVERSED') return fail('ALREADY_REVERSED');
    if (found.loggedBy.id !== me().id) return fail('NOT_YOUR_ENTRY', 403);
    if (!isToday(found.at)) return fail('REVERSAL_WINDOW_PASSED', 403);
    const now = new Date().toISOString();
    const updated: BranchWasteEntry = {
      ...found,
      status: 'REVERSED',
      reversal: { at: now, by: me(), reason: input.reason, reasonText: WASTE_REVERSAL_TEXT[input.reason], note: input.note ?? null },
    };
    rows = rows.map((r) => (r.id === entryId ? updated : r));
    return withCan(updated);
  },
};

if (typeof window !== 'undefined') {
  (window as unknown as { __bwMock: unknown }).__bwMock = {
    failNext: (op: keyof typeof failures, code = 'server') => {
      failures[op] = code;
    },
    delay: (ms: number) => {
      delayMs = ms;
    },
    seedMany: (n: number) => {
      if (rows.length === 0) seed();
      const item = CATALOG[0]!;
      for (let i = 0; i < n; i++) rows.push(entry(++seq, item, String(1 + (i % 5)), 'EXPIRY', at(2 + (i % 4), 8 + (i % 9), i % 60), i % 2 ? me() : JOSEPH));
      rows.sort((a, b) => b.at.localeCompare(a.at));
    },
    reset: () => {
      rows = [];
      batches.clear();
    },
  };
}
