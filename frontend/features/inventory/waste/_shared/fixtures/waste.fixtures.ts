/**
 * Fixture mode only (`NEXT_PUBLIC_SCW_FIXTURES=1`): an in-memory Waste back end (W1 to W4) over the shared fixture world. Logging
 * lowers the item's on-hand figure; reversing returns it; an Attendant sees and reverses only their own entries of today and gets
 * no stock figure (no `onHand`, no `kpis`), as the real server does. A repeated idempotency key replays the same batch.
 */
import type { FixtureHandler } from '../../../_shared/services/scw-call';
import { fixtureCan, getFixtureRole } from '../../../_shared/fixtures/fixture-role';
import { fail, hhmm, isoAgo, isToday, kes, kesWhole, nowIso, norm, paginate, qty, dayDiff } from '../../../_shared/fixtures/fixture-clock';
import { PEOPLE, items, itemById } from '../../../_shared/fixtures/fixture-world';
import type { Person } from '../../../_shared/types/wire';
import { WASTE_REASON_TEXT, WASTE_REVERSAL_TEXT, type LogWasteInput, type ReverseWasteInput, type WasteEntry, type WasteItemOption, type WasteReason, type WasteReversalReason } from '../types/waste-contract';

interface Row { id: string; at: string; itemId: string; quantity: number; reason: WasteReason; note: string | null; by: Person; reversal: { at: string; by: Person; reason: WasteReversalReason; note: string | null } | null }
const rows: Row[] = [];
const batches = new Map<string, WasteEntry[]>();
let seq = 1;

const me = (): Person => (getFixtureRole() === 'STORE_ATTENDANT' ? PEOPLE.peter : getFixtureRole() === 'STORE_MANAGER' ? PEOPLE.isabel : getFixtureRole() === 'DIRECTOR' ? PEOPLE.grace : getFixtureRole() === 'ACCOUNTANT' ? PEOPLE.accountant : getFixtureRole() === 'BRANCH_MANAGER' ? PEOPLE.branch : PEOPLE.admin);

function init(): void {
  if (rows.length) return;
  const mk = (name: string, q: number, reason: WasteReason, hoursAgo: number, by: Person, rev = false): void => {
    const it = items.find((i) => i.name === name);
    if (!it) return;
    rows.push({ id: `w-${seq++}`, at: isoAgo(hoursAgo), itemId: it.id, quantity: q, reason, note: null, by, reversal: rev ? { at: isoAgo(hoursAgo - 0.1), by, reason: 'WRONG_ITEM', note: null } : null });
  };
  mk('Chicken breast', 3, 'EXPIRY', 0.3, PEOPLE.peter);
  mk('Beef mince', 2, 'SPOILAGE', 0.3, PEOPLE.peter);
  mk('Wheat flour', 1, 'DAMAGE_IN_STORE', 0.1, PEOPLE.isabel);
  mk('Whole milk', 6, 'SPOILAGE', 2.5, PEOPLE.peter, true);
  mk('Tomatoes', 4, 'SPOILAGE', 50, PEOPLE.linnet);
  mk('Avocados', 2, 'EXPIRY', 80, PEOPLE.peter, true);
}

const entry = (r: Row): WasteEntry => {
  const it = itemById(r.itemId);
  const own = r.by.id === me().id;
  const canRev = !r.reversal && (fixtureCan('waste.reverse_any') || (fixtureCan('waste.reverse_own') && own && isToday(r.at)));
  const e: WasteEntry = {
    id: r.id, at: r.at, itemId: r.itemId, itemName: it?.name ?? '', quantity: qty(r.quantity), unit: it?.unit ?? '', reason: r.reason, reasonText: WASTE_REASON_TEXT[r.reason], note: r.note, loggedBy: r.by,
    status: r.reversal ? 'REVERSED' : 'LOGGED',
    reversal: r.reversal ? { ...r.reversal, reasonText: WASTE_REVERSAL_TEXT[r.reversal.reason] } : null,
    can: { reverse: canRev },
  };
  if (fixtureCan('catalog.see_costs')) e.valueKes = kes(r.quantity * (it?.cost ?? 0));
  return e;
};

const visible = (): Row[] => (fixtureCan('waste.read') && getFixtureRole() !== 'STORE_ATTENDANT' ? rows : rows.filter((r) => r.by.id === me().id));

function option(i: (typeof items)[number]): WasteItemOption {
  const o: WasteItemOption = { itemId: i.id, name: i.name, unit: i.unit };
  if (fixtureCan('catalog.see_costs')) o.unitCost = kes(i.cost);
  if (fixtureCan('restock.read')) o.onHand = qty(i.onHand);
  return o;
}

function list(q: URLSearchParams) {
  if (!fixtureCan('waste.read')) fail(403, 'FORBIDDEN', 'Not allowed');
  const period = q.get('period') ?? 'today';
  const scope = getFixtureRole() === 'STORE_ATTENDANT' ? 'mine' : (q.get('scope') ?? 'all');
  const s = norm(q.get('search') ?? '');
  const base = visible().filter((r) => (scope === 'mine' ? r.by.id === me().id : true));
  const inPeriod = (r: Row): boolean => (period === 'reversed' ? Boolean(r.reversal) : period === '7d' ? dayDiff(r.at) <= 6 : isToday(r.at));
  const filtered = base.filter(inPeriod).filter((r) => !s || norm(itemById(r.itemId)?.name ?? '').includes(s)).sort((a, b) => b.at.localeCompare(a.at));
  const { slice, page } = paginate(filtered, q);
  const val = (r: Row) => (r.reversal ? 0 : r.quantity * (itemById(r.itemId)?.cost ?? 0));
  const sum = (f: (r: Row) => boolean) => base.filter(f).reduce((a, r) => a + val(r), 0);
  const attendant = getFixtureRole() === 'STORE_ATTENDANT';
  const todays = base.filter((r) => isToday(r.at) && !r.reversal);
  const totals = base.filter((r) => dayDiff(r.at) <= 6 && !r.reversal).reduce<Record<string, number>>((m, r) => ({ ...m, [r.itemId]: (m[r.itemId] ?? 0) + val(r) }), {});
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  return {
    ...(attendant ? { bannerText: todays.length ? `${todays.length} item${todays.length === 1 ? '' : 's'} logged today. You can reverse your own entries today.` : null } : {
      kpis: [
        { key: 'today', label: 'TODAY', value: Math.round(sum((r) => isToday(r.at))).toLocaleString('en-KE'), caption: `KES · ${base.filter((r) => isToday(r.at)).length} entries`, tone: 'NEUTRAL' as const },
        { key: 'last7', label: 'LAST 7 DAYS', value: Math.round(sum((r) => dayDiff(r.at) <= 6)).toLocaleString('en-KE'), caption: `KES · ${base.filter((r) => dayDiff(r.at) <= 6).length} entries`, tone: 'NEUTRAL' as const },
        { key: 'top', label: 'MOST WASTED · 7 DAYS', value: top ? (itemById(top[0])?.name ?? '–') : '–', caption: top ? kesWhole(top[1]) : 'Nothing wasted', tone: 'WARN' as const },
        { key: 'rev', label: 'REVERSED · 7 DAYS', value: String(base.filter((r) => r.reversal && dayDiff(r.at) <= 6).length), caption: 'Both by the Attendant, same day', tone: 'NEUTRAL' as const },
      ],
    }),
    rows: slice.map(entry),
    chips: { today: base.filter((r) => isToday(r.at)).length, last7: base.filter((r) => dayDiff(r.at) <= 6).length, reversed: base.filter((r) => r.reversal).length },
    page,
  };
}

export const wasteFixtureHandler: FixtureHandler = ({ method, path, query, body }) => {
  init();
  if (method === 'GET' && path === '/items') {
    if (!fixtureCan('waste.log')) fail(403, 'FORBIDDEN', 'Not allowed');
    const s = norm(query.get('search') ?? '');
    const found = items.filter((i) => i.sectionId && (!s || norm(i.name).includes(s))).slice(0, Number(query.get('limit') ?? 20));
    const often = ['Chicken breast', 'Whole milk', 'Tomatoes', 'Wheat flour', 'Avocados', 'Beef mince'].map((n) => items.find((i) => i.name === n)).filter((i): i is NonNullable<typeof i> => Boolean(i));
    return { often: often.map(option), items: found.map(option) };
  }
  if (method === 'GET' && path === '') return list(query);
  if (method === 'POST' && path === '') {
    if (!fixtureCan('waste.log')) fail(403, 'FORBIDDEN', 'Not allowed');
    const input = body as LogWasteInput;
    const replay = batches.get(input.idempotencyKey);
    if (replay) return { entries: replay, replayed: true };
    const made: Row[] = input.entries.map((e) => {
      const it = itemById(e.inventoryItemId);
      if (!it) fail(400, 'ITEM_RETIRED', 'That item is no longer in the catalog.');
      it.onHand -= Number(e.quantity);
      return { id: `w-${seq++}`, at: nowIso(), itemId: it.id, quantity: Number(e.quantity), reason: e.reason, note: input.note ?? null, by: me(), reversal: null };
    });
    rows.push(...made);
    const out = made.map(entry);
    batches.set(input.idempotencyKey, out);
    const total = made.reduce((a, r) => a + r.quantity * (itemById(r.itemId)?.cost ?? 0), 0);
    return { entries: out, ...(fixtureCan('catalog.see_costs') ? { totalValueKes: kes(total) } : {}), ...(fixtureCan('restock.read') ? { wentNegative: made.some((r) => (itemById(r.itemId)?.onHand ?? 0) < 0) } : {}), replayed: false };
  }
  const hit = /^\/([^/]+)\/reverse$/.exec(path);
  if (method === 'POST' && hit) {
    const r = rows.find((x) => x.id === hit[1]);
    if (!r) fail(404, 'NOT_FOUND', 'Entry not found');
    if (r.reversal) fail(409, 'ALREADY_REVERSED', 'That entry was already reversed.');
    const own = r.by.id === me().id;
    if (!fixtureCan('waste.reverse_any')) {
      if (!own) fail(403, 'NOT_YOUR_ENTRY', 'You can only reverse your own entries.');
      if (!isToday(r.at)) fail(409, 'REVERSAL_WINDOW_PASSED', 'Entries can only be reversed the same day.');
    }
    const input = body as ReverseWasteInput;
    r.reversal = { at: nowIso(), by: me(), reason: input.reason, note: input.note ?? null };
    const it = itemById(r.itemId);
    if (it) it.onHand += r.quantity;
    return entry(r);
  }
  return fail(404, 'NOT_FOUND', `No fixture for ${method} ${path}`);
};

void hhmm;
