/**
 * Fixture mode only (`NEXT_PUBLIC_SCW_FIXTURES=1`): an in-memory Stock back end (S1 to S5) over the shared fixture world. The
 * ledger and card figures are generated deterministically from each item so every row adds up (opening + in + out + adjusted =
 * closing) and a card's days chain from one closing figure to the next. Not the real rules; just enough to drive the screens.
 */
import type { FixtureHandler } from '../../../_shared/services/scw-call';
import { fixtureCan } from '../../../_shared/fixtures/fixture-role';
import { dayMonthClock, fail, fixtureNow, isoAgo, kes, lastCountedText, nairobiDay, norm, paginate, qty, weekdayDayMonth } from '../../../_shared/fixtures/fixture-clock';
import { items, itemById, sectionById, sections, type WorldItem } from '../../../_shared/fixtures/fixture-world';
import type { KpiCell } from '../../../_shared/types/wire';
import type { ItemStockStatus, LedgerList, LedgerRow, StockCard, StockCardDay, StockCardEntry, StockItemRow, StockItemsList, StockOverview } from '../types/stock-contract';

function statusOf(i: WorldItem): ItemStockStatus {
  if (i.onHand < 0) return 'NEGATIVE';
  if (i.restockLevel !== null && i.onHand === 0) return 'OUT';
  if (i.restockLevel !== null && i.onHand < i.restockLevel) return 'LOW';
  return 'OK';
}

const hash = (s: string): number => {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003;
  return h;
};

const requireStock = (): void => {
  if (!fixtureCan('stock.read')) fail(403, 'FORBIDDEN', 'Not allowed');
};

const kesNum = (n: number): string => kes(n);

function overview(): StockOverview {
  requireStock();
  const low = items.filter((i) => ['LOW', 'OUT'].includes(statusOf(i))).length;
  const neg = items.filter((i) => statusOf(i) === 'NEGATIVE').length;
  const sorted = [...sections].sort((a, b) => a.position - b.position);
  const stale = sorted
    .map((s) => {
      const list = items.filter((i) => i.sectionId === s.id);
      const oldest = list.reduce<string | null>((a, i) => (i.lastCountedAt && (!a || i.lastCountedAt < a) ? i.lastCountedAt : a), null);
      return { s, oldest };
    })
    .sort((a, b) => (a.oldest ?? '').localeCompare(b.oldest ?? ''));
  return {
    kpis: [
      { key: 'tracked', label: 'ITEMS TRACKED', value: String(items.length), caption: `${sections.length} sections`, tone: 'NEUTRAL' },
      { key: 'low', label: 'LOW OR OUT', value: String(low), caption: 'At or below the restock level', tone: low > 0 ? 'WARN' : 'NEUTRAL' },
      { key: 'neg', label: 'NEGATIVE STOCK', value: String(neg), caption: neg > 0 ? 'Needs a count or a correction' : 'None', tone: neg > 0 ? 'ALERT' : 'NEUTRAL' },
      { key: 'counts', label: 'COUNTS TODAY', value: '2', caption: '1 signed · 1 in progress', tone: 'NEUTRAL' },
    ],
    todaysCounts: [
      { id: 'c-1013', reference: 'CNT-2026-1013', what: 'Samrat', byText: 'Linnet', status: 'TO_REVIEW', statusText: 'Waiting for review' },
      { id: 'c-1014', reference: 'CNT-2026-1014', what: 'Summer', byText: 'Peter, 4 of 10', status: 'IN_PROGRESS', statusText: 'In progress' },
      { id: 'c-1015', reference: 'CNT-2026-1015', what: 'Packaging', byText: 'Isabel', status: 'SIGNED', statusText: 'Signed' },
    ],
    longestWithoutCount: [
      ...stale.slice(0, 2).map(({ s, oldest }) => ({ kind: 'SECTION' as const, refId: s.id, name: s.name, detail: `${items.filter((i) => i.sectionId === s.id).length} items`, lastCountedAt: oldest, lastCountedText: lastCountedText(oldest) })),
      ...items
        .filter((i) => i.lastCountedAt)
        .sort((a, b) => (a.lastCountedAt ?? '').localeCompare(b.lastCountedAt ?? ''))
        .slice(0, 2)
        .map((i) => ({ kind: 'ITEM' as const, refId: i.id, name: i.name, detail: sectionById(i.sectionId ?? '')?.name ?? 'No section', lastCountedAt: i.lastCountedAt, lastCountedText: lastCountedText(i.lastCountedAt) })),
    ],
    can: { startCount: fixtureCan('counts.record') },
  };
}

function matches(i: WorldItem, q: URLSearchParams): boolean {
  const s = norm(q.get('search') ?? '');
  if (s && !norm(i.name).includes(s)) return false;
  if (q.get('categoryId') && i.category !== q.get('categoryId')) return false;
  if (q.get('type') && i.type !== q.get('type')) return false;
  if (q.get('departmentTag') && i.department !== q.get('departmentTag')) return false;
  if (q.get('sectionId') && (i.sectionId ?? 'none') !== q.get('sectionId')) return false;
  return true;
}

const rowOf = (i: WorldItem): StockItemRow => ({
  itemId: i.id,
  name: i.name,
  sectionName: sectionById(i.sectionId ?? '')?.name ?? null,
  unit: i.unit,
  onHand: qty(i.onHand),
  restockLevel: i.restockLevel === null ? null : qty(i.restockLevel),
  valueKes: kes(i.onHand * i.cost),
  lastCountedAt: i.lastCountedAt,
  lastCountedText: i.lastCountedAt ? weekdayDayMonth(i.lastCountedAt) : 'Never counted',
  status: statusOf(i),
});

function itemsList(q: URLSearchParams): StockItemsList {
  requireStock();
  const base = items.filter((i) => matches(i, q));
  const status = q.get('status') ?? 'all';
  const filtered = base.filter((i) => (status === 'low' ? ['LOW', 'OUT'].includes(statusOf(i)) : status === 'negative' ? statusOf(i) === 'NEGATIVE' : true));
  const { slice, page } = paginate(filtered, q);
  const total = items.reduce((a, i) => a + i.onHand * i.cost, 0);
  const kpis: KpiCell[] = [
    { key: 'tracked', label: 'ITEMS TRACKED', value: String(items.length), caption: 'Across all sections', tone: 'NEUTRAL' },
    { key: 'low', label: 'LOW OR OUT', value: String(items.filter((i) => ['LOW', 'OUT'].includes(statusOf(i))).length), caption: 'At or below the restock level', tone: 'WARN', filter: 'low' },
    { key: 'neg', label: 'NEGATIVE STOCK', value: String(items.filter((i) => statusOf(i) === 'NEGATIVE').length), caption: 'Went below zero', tone: 'ALERT', filter: 'negative' },
    { key: 'value', label: 'STOCK VALUE', value: `KES ${Math.round(total).toLocaleString('en-KE')}`, caption: 'At today’s cost', tone: 'NEUTRAL' },
  ];
  return {
    kpis,
    rows: slice.map(rowOf),
    chips: {
      all: base.length,
      low: base.filter((i) => ['LOW', 'OUT'].includes(statusOf(i))).length,
      negative: base.filter((i) => statusOf(i) === 'NEGATIVE').length,
    },
    page,
  };
}

interface Move {
  inQty: number;
  sentOut: number;
  prepUse: number;
  waste: number;
  adjusted: number;
}

/** One day's movements for an item, from its hash and the day offset. Out columns are negative. */
function dayMoves(i: WorldItem, back: number): Move {
  const h = hash(`${i.id}:${back}`);
  const base = Math.max(1, Math.round(Math.abs(i.onHand) * 0.2) || 1);
  return {
    inQty: h % 5 === 0 ? base * 3 : 0,
    sentOut: h % 4 === 1 ? -base : 0,
    prepUse: h % 3 === 0 ? -Math.max(1, Math.round(base / 2)) : 0,
    waste: h % 7 === 2 ? -1 : 0,
    adjusted: h % 11 === 3 ? (h % 2 === 0 ? 1 : -1) : 0,
  };
}
const net = (m: Move): number => m.inQty + m.sentOut + m.prepUse + m.waste + m.adjusted;

function period(q: URLSearchParams): { from: string; to: string; days: number } {
  const to = q.get('to') ?? nairobiDay(new Date(fixtureNow()).toISOString());
  const from = q.get('from') ?? nairobiDay(new Date(Date.parse(`${to}T00:00:00Z`) - 6 * 86_400_000).toISOString());
  if (from > to) fail(400, 'RANGE_INVALID', 'The start date is after the end date.');
  if (to > nairobiDay(new Date(fixtureNow()).toISOString())) fail(400, 'DATE_IN_FUTURE', 'That date is in the future.');
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  return { from, to, days };
}

function ledgerRow(i: WorldItem, days: number): LedgerRow & { hadAdjust: boolean; hadWaste: boolean } {
  const sum: Move = { inQty: 0, sentOut: 0, prepUse: 0, waste: 0, adjusted: 0 };
  for (let d = 0; d < days; d += 1) {
    const m = dayMoves(i, d);
    sum.inQty += m.inQty;
    sum.sentOut += m.sentOut;
    sum.prepUse += m.prepUse;
    sum.waste += m.waste;
    sum.adjusted += m.adjusted;
  }
  const closing = i.onHand;
  const opening = closing - net(sum);
  return {
    itemId: i.id,
    name: i.name,
    unit: i.unit,
    note: i.type === 'Prepped' ? 'made in Prep' : null,
    opening: qty(opening),
    in: qty(sum.inQty),
    sentOut: qty(sum.sentOut),
    prepUse: qty(sum.prepUse),
    waste: qty(sum.waste),
    adjusted: qty(sum.adjusted),
    closing: qty(closing),
    closingValueKes: kes(closing * i.cost),
    hadAdjust: sum.adjusted !== 0,
    hadWaste: sum.waste !== 0,
  };
}

function ledger(q: URLSearchParams): LedgerList {
  requireStock();
  const p = period(q);
  const search = norm(q.get('search') ?? '');
  const chip = q.get('chip') ?? 'all';
  const refSearch = /^(adj|cnt|grn|dsp)/i.test(search);
  const all = items
    .filter((i) => (q.get('sectionId') ? (i.sectionId ?? 'none') === q.get('sectionId') : true))
    .filter((i) => (!search || refSearch ? true : norm(i.name).includes(search)))
    .map((i) => ({ i, row: ledgerRow(i, p.days) }))
    .filter(({ row }) => (refSearch ? hash(row.itemId + search) % 4 === 0 : true));
  const filtered = all.filter(({ row }) => (chip === 'adjustments' ? row.hadAdjust : chip === 'waste' ? row.hadWaste : chip === 'negative' ? Number(row.closing) < 0 : true));
  const { slice, page } = paginate(filtered, q);
  const sumOf = (pick: (r: LedgerRow) => number): number => filtered.reduce((a, { row }) => a + pick(row), 0);
  const valueOf = (pick: (r: LedgerRow) => number): number => filtered.reduce((a, { i, row }) => a + pick(row) * i.cost, 0);
  const money = (n: number): string => `${n < 0 ? '−' : ''}KES ${Math.abs(Math.round(n)).toLocaleString('en-KE')}`;
  return {
    from: p.from,
    to: p.to,
    periodText: `${p.days} day${p.days === 1 ? '' : 's'}`,
    kpis: [
      { key: 'opening', label: 'OPENING VALUE', value: money(valueOf((r) => Number(r.opening))), caption: `On ${p.from}`, tone: 'NEUTRAL' },
      { key: 'in', label: 'IN', value: money(valueOf((r) => Number(r.in))), caption: 'Received and made', tone: 'NEUTRAL' },
      { key: 'out', label: 'OUT', value: money(valueOf((r) => Number(r.sentOut) + Number(r.prepUse) + Number(r.waste))), caption: 'Sent, used and wasted', tone: 'WARN' },
      { key: 'closing', label: 'CLOSING VALUE', value: money(sumOf(() => 0) + valueOf((r) => Number(r.closing))), caption: `On ${p.to}`, tone: 'NEUTRAL' },
    ],
    rows: slice.map(({ row }) => {
      const { hadAdjust: _a, hadWaste: _w, ...rest } = row;
      void _a;
      void _w;
      return rest;
    }),
    chips: {
      all: all.length,
      adjustments: all.filter(({ row }) => row.hadAdjust).length,
      waste: all.filter(({ row }) => row.hadWaste).length,
      negative: all.filter(({ row }) => Number(row.closing) < 0).length,
    },
    page,
  };
}

const TYPE_BY: { key: keyof Move; type: StockCardEntry['type']; ref: (back: number) => string }[] = [
  { key: 'inQty', type: 'RECEIVE', ref: (b) => `GRN-${2400 - b * 3}` },
  { key: 'sentOut', type: 'DISPATCH_OUT', ref: (b) => `Dispatch ${1 + (b % 4)} · Nyeri Town · ${dayMonthClock(isoAgo(b * 24)).slice(0, 6)}` },
  { key: 'prepUse', type: 'PREP_CONSUME', ref: (b) => `PREP-04${10 - b}` },
  { key: 'waste', type: 'WASTE', ref: () => '' },
  { key: 'adjusted', type: 'ADJUSTMENT', ref: (b) => `ADJ-${3402 - b}` },
];

function card(itemId: string, q: URLSearchParams): StockCard {
  requireStock();
  const i = itemById(itemId);
  if (!i) fail(404, 'ITEM_NOT_FOUND', 'That item was not found.');
  const p = period(q);
  const showEntries = q.get('show') === 'entries';
  const chip = q.get('chip');
  let closing = i.onHand;
  const rows: StockCardDay[] = [];
  const total = { opening: 0, in: 0, sentOut: 0, prepUse: 0, waste: 0, adjusted: 0 };
  for (let back = 0; back < p.days; back += 1) {
    const m = dayMoves(i, back);
    const opening = closing - net(m);
    const at = isoAgo(back * 24 + 3);
    const refs: string[] = [];
    const entries: StockCardEntry[] = [];
    TYPE_BY.forEach((t) => {
      const v = m[t.key];
      if (v === 0) return;
      const ref = t.ref(back);
      if (ref) refs.push(ref);
      entries.push({ id: `${i.id}-${back}-${t.type}`, at, type: t.type, reference: ref || null, quantity: qty(v), reversed: false, note: null });
    });
    rows.push({
      day: nairobiDay(at),
      dayText: weekdayDayMonth(at),
      referenceText: refs.join(' · ') || 'No movement',
      references: refs,
      collapsed: false,
      opening: qty(opening),
      in: qty(m.inQty),
      sentOut: qty(m.sentOut),
      prepUse: qty(m.prepUse),
      waste: qty(m.waste),
      adjusted: qty(m.adjusted),
      closing: qty(closing),
      closingValueKes: kes(closing * i.cost),
      ...(showEntries ? { entries } : {}),
    });
    total.opening = opening;
    total.in += m.inQty;
    total.sentOut += m.sentOut;
    total.prepUse += m.prepUse;
    total.waste += m.waste;
    total.adjusted += m.adjusted;
    closing = opening;
  }
  let days = rows.filter((d) => (chip === 'adjustmentsOnly' ? Number(d.adjusted) !== 0 : chip === 'daysWithMovement' ? d.references.length > 0 : true));
  let footer = `${days.length} day${days.length === 1 ? '' : 's'} with movement`;
  if (!showEntries && days.length > 5) {
    const older = days.slice(5);
    days = [
      ...days.slice(0, 5),
      {
        ...(older[older.length - 1] as StockCardDay),
        day: 'earlier',
        dayText: `${older.length} earlier ${older.length === 1 ? 'day' : 'days'}`,
        referenceText: 'Collapsed. Show by entries to see each one.',
        references: [],
        collapsed: true,
        opening: (older[older.length - 1] as StockCardDay).opening,
        closing: (older[0] as StockCardDay).closing,
        closingValueKes: (older[0] as StockCardDay).closingValueKes,
      },
    ];
    footer = `5 days and ${older.length} earlier ${older.length === 1 ? 'day' : 'days'}`;
  }
  const status = statusOf(i);
  const last = i.lastCountedAt;
  return {
    item: { id: i.id, name: i.name, unit: i.unit, sectionName: sectionById(i.sectionId ?? '')?.name ?? null, locationName: 'Central Store' },
    onHand: qty(i.onHand),
    status,
    statusText: status === 'OK' ? 'OK' : status === 'LOW' ? 'Low' : status === 'OUT' ? 'Out' : 'Negative',
    valueKes: kes(i.onHand * i.cost),
    unitCostText: `KES ${kesNum(i.cost)} per ${i.unit}`,
    lastCounted: last ? { at: last, reference: 'CNT-2026-1012', text: `${lastCountedText(last)} · CNT-2026-1012` } : null,
    from: p.from,
    to: p.to,
    periodText: `${p.days} day${p.days === 1 ? '' : 's'}`,
    strip: { opening: qty(total.opening), in: qty(total.in), sentOut: qty(total.sentOut), prepUse: qty(total.prepUse), waste: qty(total.waste), adjusted: qty(total.adjusted), closing: qty(i.onHand) },
    days,
    footerText: footer,
  };
}

export const stockFixtureHandler: FixtureHandler = ({ method, path, query }) => {
  if (method !== 'GET') return fail(404, 'NOT_FOUND', `No fixture for ${method} ${path}`);
  if (path === '/overview') return overview();
  if (path === '/items') return itemsList(query);
  if (path === '/ledger') return ledger(query);
  const hit = /^\/ledger\/([^/]+)$/.exec(path);
  if (hit) return card(hit[1] as string, query);
  return fail(404, 'NOT_FOUND', `No fixture for ${method} ${path}`);
};

export function stockFixtureCsv(): string {
  const rows = items.map((i) => ledgerRow(i, 7));
  return ['Item,Unit,Opening,In,Sent out,Prep use,Waste,Adjusted,Closing', ...rows.map((r) => [r.name, r.unit, r.opening, r.in, r.sentOut, r.prepUse, r.waste, r.adjusted, r.closing].join(','))].join('\n');
}
