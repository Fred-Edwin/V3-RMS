/**
 * The head's Branch day phone calls answered in memory, shaped exactly like the frozen contract (BD1 to BD10), until the back end
 * (`feat/block4-be`) is merged. Off once `NEXT_PUBLIC_BRANCH_DAY_MOCK=0`. State lives in this module, so it survives navigation and
 * resets on reload. Test switches (browser console): `localStorage.bdMock = 'error' | 'empty' | 'slow'`, and
 * `localStorage.bdMockClock = 'morning' | 'evening'` to force the 12:00 Nairobi button switch. The PIN is 1234.
 */
import { ApiError } from '@/types/api';
import type {
  CountLine,
  CountView,
  DayHead,
  Home,
  HomeAction,
  MyDay,
  MyHistory,
  MyHistoryQuery,
  OpeningDifference,
  OpeningView,
  RecountPreview,
  SaveCountResult,
  SignCountResult,
  OpeningResult,
} from '../../_shared/types/branch-day-contract';
import type { Person } from '../../../_shared/types/wire';
import type { BranchDayPhoneApi } from './branch-day-phone-api';

const BRANCH = { id: '10000000-0000-4000-8000-000000000001', name: 'Nyeri Town', code: 'NYR' };
const DEPARTMENT = { id: '30000000-0000-4000-8000-000000000002', name: 'Barista' };
const PERSON: Person = { id: '20000000-0000-4000-8000-000000000002', name: 'David M.', initials: 'DM', roleLabel: 'Barista Department Head' };

const ITEMS: { id: string; name: string; unit: string; group: string; last: string }[] = [
  { id: 'i1', name: 'Coffee beans 1kg', unit: 'Bags', group: 'Drinks and dry goods', last: '12' },
  { id: 'i2', name: 'Milk 1L', unit: 'Packets', group: 'Drinks and dry goods', last: '8' },
  { id: 'i3', name: 'Sugar 2kg', unit: 'Packs', group: 'Drinks and dry goods', last: '6' },
  { id: 'i4', name: 'Cocoa powder 1kg', unit: 'Tins', group: 'Drinks and dry goods', last: '3' },
  { id: 'i5', name: 'Vanilla syrup 750ml', unit: 'Bottles', group: 'Drinks and dry goods', last: '4' },
  { id: 'i6', name: 'Paper cups 12oz', unit: 'Sleeves', group: 'Serving supplies', last: '10' },
  { id: 'i7', name: 'Coffee filters', unit: 'Boxes', group: 'Serving supplies', last: '3' },
  { id: 'i8', name: 'Napkins', unit: 'Packs', group: 'Serving supplies', last: '8' },
];

const nairobiDate = (d = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d);
const nairobiHour = (): number => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: 'numeric', hour12: false }).format(new Date())) % 24;

const flag = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

interface MockState {
  openingState: 'NOT_CHECKED' | 'ACCEPTED' | 'RECOUNTED';
  openingAt: string | null;
  differences: OpeningDifference[];
  accepted: Record<string, string>;
  typed: Record<string, string>;
  signedAt: string | null;
  keys: Map<string, unknown>;
}

const state: MockState = { openingState: 'NOT_CHECKED', openingAt: null, differences: [], accepted: {}, typed: {}, signedAt: null, keys: new Map() };

const day = (): DayHead => ({ id: '70000000-0000-4000-8000-000000000044', reference: 'DAY-NYR-0044', date: nairobiDate(), status: 'OPEN' });
const items = (): typeof ITEMS => (flag('bdMock') === 'empty' ? [] : ITEMS);
const wait = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, flag('bdMock') === 'slow' ? 2500 : 220));
  if (flag('bdMock') === 'error') throw new ApiError('Mock failure', 500, 'INTERNAL');
};
const clockIsMorning = (): boolean => {
  const forced = flag('bdMockClock');
  return forced ? forced === 'morning' : nairobiHour() < 12;
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const badPin = (): ApiError => new ApiError('That PIN is not right.', 400, 'INVALID_PIN');
const checkedBy = (): Person | null => (state.openingState === 'NOT_CHECKED' ? null : PERSON);

const openingView = (): OpeningView => ({
  day: day(),
  department: DEPARTMENT,
  itemCount: items().length,
  lastCloseAt: new Date(Date.now() - 12 * 3600_000).toISOString(),
  check: { state: state.openingState, checkedAt: state.openingAt, checkedBy: checkedBy(), onBehalf: false, differences: state.differences },
  lines: items().map((i) => ({ itemId: i.id, itemName: i.name, unit: i.unit, lastNightQty: i.last, acceptedQty: state.accepted[i.id] ?? null })),
});

const countLines = (): CountLine[] => items().map((i) => ({ itemId: i.id, itemName: i.name, unit: i.unit, categoryPath: [i.group], countedQty: state.typed[i.id] ?? null }));
const countView = (): CountView => {
  const lines = countLines();
  const filled = lines.filter((l) => l.countedQty !== null).length;
  const groups: { name: string; itemCount: number }[] = [];
  for (const l of lines) {
    const g = groups.find((x) => x.name === l.categoryPath[0]);
    if (g) g.itemCount += 1;
    else groups.push({ name: l.categoryPath[0] ?? 'Items', itemCount: 1 });
  }
  return {
    day: day(),
    department: DEPARTMENT,
    onBehalfOfDepartment: false,
    state: state.signedAt ? 'COUNTED' : 'NOT_COUNTED',
    lines,
    summary: { itemCount: lines.length, filledCount: filled, blankCount: lines.length - filled, groups },
    canSign: lines.length > 0 && filled === lines.length && !state.signedAt,
    signedAt: state.signedAt,
    signedBy: state.signedAt ? PERSON : null,
  };
};

const differencesFor = (lines: { itemId: string; countedQty: string }[]): OpeningDifference[] =>
  lines.flatMap((l) => {
    const item = items().find((i) => i.id === l.itemId);
    if (!item || Number(l.countedQty) === Number(item.last)) return [];
    return [{ itemId: item.id, itemName: item.name, unit: item.unit, lastNightQty: item.last, countedQty: l.countedQty, difference: String(Number(l.countedQty) - Number(item.last)) }];
  });

const HISTORY: MyHistory['rows'] = Array.from({ length: 28 }, (_, n) => {
  const date = new Date(Date.now() - (n + 1) * 86_400_000);
  const corrected = n === 1 || n === 9;
  return {
    id: `70000000-0000-4000-8000-0000000000${String(43 - n).padStart(2, '0')}`,
    reference: `DAY-NYR-00${String(43 - n).padStart(2, '0')}`,
    date: nairobiDate(date),
    status: corrected ? ('CORRECTED' as const) : ('CLOSED' as const),
    itemsCounted: 8,
    signedAt: new Date(new Date(`${nairobiDate(date)}T15:20:00.000Z`).getTime() + n * 600_000).toISOString(),
    correctedCount: corrected ? 1 : 0,
  };
});

export const branchDayPhoneMock: BranchDayPhoneApi = {
  async home() {
    await wait();
    const counted = state.signedAt !== null;
    const action: HomeAction = counted ? 'NONE' : state.openingState === 'NOT_CHECKED' && clockIsMorning() ? 'CHECK_OPENING' : 'COUNT';
    const home: Home = {
      day: day(),
      branch: BRANCH,
      department: DEPARTMENT,
      itemCount: items().length,
      opening: { state: state.openingState, checkedAt: state.openingAt, checkedBy: checkedBy(), onBehalf: false, differences: state.differences },
      delivery: { state: 'CONFIRMED', dispatches: [{ id: 'd1', reference: 'DSP-NYR-0232' }], confirmedAt: new Date(Date.now() - 3 * 3600_000).toISOString(), gapCount: 1, gapOpen: true },
      count: { state: counted ? 'COUNTED' : 'NOT_COUNTED', signedAt: state.signedAt, signedBy: counted ? PERSON : null, onBehalf: false },
      closed: { at: null },
      action,
    };
    return clone(home);
  },
  async opening() {
    await wait();
    return clone(openingView());
  },
  async acceptOpening(input) {
    await wait();
    if (state.openingState !== 'NOT_CHECKED' && !state.keys.has(input.idempotencyKey)) throw new ApiError('Already checked', 409, 'OPENING_ALREADY_CHECKED');
    state.openingState = 'ACCEPTED';
    state.openingAt = state.openingAt ?? new Date().toISOString();
    state.differences = [];
    state.accepted = Object.fromEntries(ITEMS.map((i) => [i.id, i.last]));
    state.keys.set(input.idempotencyKey, true);
    const result: OpeningResult = { view: openingView(), replayed: false };
    return clone(result);
  },
  async recountPreview(input) {
    await wait();
    const differences = differencesFor(input.lines);
    const preview: RecountPreview = {
      itemCount: input.lines.length,
      matchedItems: input.lines.filter((l) => !differences.some((d) => d.itemId === l.itemId)).map((l) => items().find((i) => i.id === l.itemId)?.name ?? ''),
      differences,
    };
    return clone(preview);
  },
  async recount(input) {
    await wait();
    if (input.pin !== '1234') throw badPin();
    if (state.openingState !== 'NOT_CHECKED' && !state.keys.has(input.idempotencyKey)) throw new ApiError('Already checked', 409, 'OPENING_ALREADY_CHECKED');
    state.openingState = 'RECOUNTED';
    state.openingAt = state.openingAt ?? new Date().toISOString();
    state.differences = differencesFor(input.lines);
    state.accepted = Object.fromEntries(input.lines.map((l) => [l.itemId, l.countedQty]));
    state.keys.set(input.idempotencyKey, true);
    const result: OpeningResult = { view: openingView(), replayed: false };
    return clone(result);
  },
  async count() {
    await wait();
    return clone(countView());
  },
  async saveCount(input) {
    await wait();
    if (state.signedAt) throw new ApiError('Already counted', 409, 'ALREADY_COUNTED');
    for (const l of input.lines) {
      if (l.countedQty === null) delete state.typed[l.itemId];
      else state.typed[l.itemId] = l.countedQty;
    }
    const result: SaveCountResult = { savedAt: new Date().toISOString(), view: countView() };
    return clone(result);
  },
  async signCount(input) {
    await wait();
    if (input.pin !== '1234') throw badPin();
    if (state.signedAt && !state.keys.has(input.idempotencyKey)) throw new ApiError('Already counted', 409, 'ALREADY_COUNTED');
    if (!countView().canSign && !state.signedAt) throw new ApiError('Count every item before you sign.', 400, 'COUNT_INCOMPLETE');
    state.signedAt = state.signedAt ?? new Date().toISOString();
    state.keys.set(input.idempotencyKey, true);
    const result: SignCountResult = { view: countView(), signedAt: state.signedAt, onBehalf: false, replayed: false };
    return clone(result);
  },
  async myHistory(query: MyHistoryQuery) {
    await wait();
    const pageSize = query.pageSize ?? 25;
    const page = query.page ?? 1;
    const filtered = HISTORY.filter((r) => (!query.status || r.status === query.status) && (!query.from || r.date >= query.from) && (!query.to || r.date <= query.to));
    const result: MyHistory = {
      department: DEPARTMENT,
      head: PERSON,
      rows: filtered.slice((page - 1) * pageSize, page * pageSize),
      page: { page, pageSize, total: filtered.length },
    };
    return clone(result);
  },
  async myDay(id) {
    await wait();
    const row = HISTORY.find((r) => r.id === id);
    if (!row) throw new ApiError('Not found', 404, 'NOT_FOUND');
    const result: MyDay = {
      day: { id: row.id, reference: row.reference, date: row.date, status: row.status },
      department: DEPARTMENT,
      signedAt: row.signedAt,
      lines: ITEMS.map((i, n) => ({ itemName: i.name, unit: i.unit, openingQty: i.last, receivedQty: String(n % 3 === 0 ? 4 : 0), wasteQty: String(n === 1 ? 1 : 0), closingQty: String(Number(i.last) - 2), usedQty: String(2 + (n % 3 === 0 ? 4 : 0) - (n === 1 ? 1 : 0)) })),
    };
    return clone(result);
  },
};
