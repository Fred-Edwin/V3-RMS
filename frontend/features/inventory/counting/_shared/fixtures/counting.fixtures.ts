/**
 * Fixture mode only (`NEXT_PUBLIC_SCW_FIXTURES=1`): an in-memory Counting back end behind the same paths as the real one
 * (contract §4.1, C1 to C30), so every flow can be walked without a server: start, count, check, sign, decide, approve, move, undo.
 * It keeps simple state (resets on reload) and answers for the role the dev story page selects, with the same blind rule as the
 * real server: no stock-figure key ever reaches a caller without `restock.read`. Not a copy of the back end's rules; just enough
 * behaviour to drive the screens. Deleted from the bundle in production (the flag is inlined).
 */
import type { FixtureHandler, FixtureRequest } from '../../../_shared/services/scw-call';
import { fixtureCan, getFixtureRole, type FixtureRole } from '../../../_shared/fixtures/fixture-role';
import {
  dayMonthClock, fail, hhmm, isoAgo, kes, kesWhole, lastCountedText, nowIso, paginate, qty, signedText, dayDiff, norm,
} from '../../../_shared/fixtures/fixture-clock';
import { PEOPLE, SECTION_ID, items, itemById, itemsOf, sectionById, sections, type WorldItem } from '../../../_shared/fixtures/fixture-world';
import type { Person } from '../../../_shared/types/wire';
import {
  CAUSE_TEXT,
  type AddItemsList,
  type ApprovePreview,
  type BlankSheet,
  type CheckResult,
  type CountCause,
  type CountDetail,
  type CountLine,
  type CountProgress,
  type CountRecordPrint,
  type CountRow,
  type CountSettings,
  type CountsList,
  type CountsSummary,
  type CountStatus,
  type DecisionInput,
  type FlaggedList,
  type LayoutInput,
  type LineDecision,
  type LineResult,
  type MoveView,
  type MovementKind,
  type RecheckState,
  type RepeatShortfallList,
  type SaveLinesInput,
  type SectionItems,
  type SetupView,
  type SettingsPreview,
  type SignInput,
  type SignPreview,
  type StartCountInput,
  type StartOptions,
  type LineDecisionKind,
} from '../types/counting-contract';

const mary: Person = { id: 'u-mary', name: 'Mary Atieno', initials: 'MA', roleLabel: 'Store Attendant' };

function me(role: FixtureRole = getFixtureRole()): Person {
  switch (role) {
    case 'STORE_ATTENDANT': return PEOPLE.linnet;
    case 'STORE_MANAGER': return PEOPLE.isabel;
    case 'DIRECTOR': return PEOPLE.grace;
    case 'ACCOUNTANT': return PEOPLE.accountant;
    case 'BRANCH_MANAGER': return PEOPLE.branch;
    case 'SYSTEM_ADMIN': return PEOPLE.admin;
  }
}

// ----------------------------------------------------------------------------------------------- model

interface LineM {
  id: string;
  itemId: string;
  sectionId: string | null;
  sectionName: string | null;
  position: number;
  counted: number | null;
  skipped: boolean;
  recheck: RecheckState;
  first: number | null;
  offered: boolean;
  /** Frozen at the counter's sign. */
  expected: number | null;
  cost: number | null;
  decision: { kind: LineDecisionKind; cause: CountCause | null; note: string | null; movementKind: MovementKind | null; at: string | null; by: Person | null };
  flagged: boolean;
  alert: boolean;
  seenAt: string | null;
  seenBy: Person | null;
  adjustmentRef: string | null;
  lastCountedAt: string | null;
}

interface CountM {
  id: string;
  reference: string;
  status: CountStatus;
  sectionIds: string[];
  scope: 'SECTIONS' | 'ITEMS';
  counter: Person;
  startedAt: string;
  signedAt: string | null;
  approvedAt: string | null;
  approver: Person | null;
  selfSigned: boolean;
  recountOfLineId: string | null;
  lines: LineM[];
  savedAt: string | null;
  range: { kes: number; percent: number } | null;
  timeline: { label: string; at: string; detail: string | null }[];
  idempotencyKey: string | null;
}

interface MoveM {
  id: string;
  itemId: string;
  fromSectionId: string | null;
  toSectionId: string;
  by: Person;
  at: string;
  undone: boolean;
  /** Moved since the manager's last visit. */
  unseen: boolean;
}

const settings = { rangeKes: 500, rangePercent: 5, flagRepeatShortfalls: true, directorAlertKes: 5000 };
let nextRef = 1017;
let nextAdj = 3410;
let layoutVersion = 1;
let lineSeq = 1;
const counts: CountM[] = [];
const moves: MoveM[] = [];
const orderToday = new Map<string, string[]>();

const newLine = (item: WorldItem, position: number, sectionName: string | null): LineM => ({
  id: `l-${lineSeq++}`,
  itemId: item.id,
  sectionId: item.sectionId,
  sectionName,
  position,
  counted: null,
  skipped: false,
  recheck: 'NONE',
  first: null,
  offered: false,
  expected: null,
  cost: null,
  decision: { kind: 'PENDING', cause: null, note: null, movementKind: null, at: null, by: null },
  flagged: false,
  alert: false,
  seenAt: null,
  seenBy: null,
  adjustmentRef: null,
  lastCountedAt: item.lastCountedAt,
});

function judge(counted: number, expected: number, cost: number, range: { kes: number; percent: number }): Exclude<LineResult, 'NOT_COUNTED' | 'NOT_YET'> {
  const diff = counted - expected;
  if (diff === 0) return 'MATCHES';
  const value = Math.abs(diff * cost);
  const percent = expected > 0 ? (Math.abs(diff) / expected) * 100 : Number.POSITIVE_INFINITY;
  return value <= range.kes && percent <= range.percent ? 'WITHIN_RANGE' : 'EXCEEDS';
}

const liveRange = () => ({ kes: settings.rangeKes, percent: settings.rangePercent });

function seedCount(
  reference: string,
  status: CountStatus,
  sectionIds: string[],
  counter: Person,
  startedHoursAgo: number,
  counts_: Record<string, number | 'skip'>,
  options: { selfSigned?: boolean; approver?: Person | null; scope?: 'SECTIONS' | 'ITEMS'; itemNames?: string[]; recountOfLineId?: string; signedHoursAgo?: number } = {},
): CountM {
  const scoped = options.itemNames ? items.filter((i) => options.itemNames?.includes(i.name)) : sectionIds.flatMap((id) => itemsOf(id));
  const lines = scoped.map((item, idx) => newLine(item, idx, sectionById(item.sectionId ?? '')?.name ?? null));
  const count: CountM = {
    id: `c-${reference.slice(-4)}`,
    reference,
    status,
    sectionIds,
    scope: options.scope ?? 'SECTIONS',
    counter,
    startedAt: isoAgo(startedHoursAgo),
    signedAt: null,
    approvedAt: null,
    approver: null,
    selfSigned: options.selfSigned ?? false,
    recountOfLineId: options.recountOfLineId ?? null,
    lines,
    savedAt: isoAgo(startedHoursAgo - 0.3),
    range: null,
    timeline: [],
    idempotencyKey: null,
  };
  for (const line of lines) {
    const item = itemById(line.itemId);
    if (!item) continue;
    const value = counts_[item.name];
    if (value === 'skip') line.skipped = true;
    else if (typeof value === 'number') line.counted = value;
    else if (status !== 'OPEN') line.counted = item.onHand;
  }
  if (status !== 'OPEN') {
    const signedAgo = options.signedHoursAgo ?? startedHoursAgo - 0.6;
    count.signedAt = isoAgo(signedAgo);
    count.range = liveRange();
    for (const line of lines) {
      const item = itemById(line.itemId);
      if (!item) continue;
      line.expected = item.onHand;
      line.cost = item.cost;
    }
    count.timeline = [
      { label: 'Counted', at: count.signedAt, detail: `${hhmm(count.startedAt)} to ${hhmm(count.signedAt)}` },
      { label: count.selfSigned ? 'Signed with your PIN' : 'Signed with PIN', at: count.signedAt, detail: null },
    ];
  }
  if (status === 'APPROVED') {
    count.approvedAt = isoAgo((options.signedHoursAgo ?? startedHoursAgo - 0.6) - 0.4);
    count.approver = options.approver ?? PEOPLE.isabel;
  }
  counts.push(count);
  return count;
}

function initWorld(): void {
  if (counts.length > 0) return;
  // The submitted Samrat count waiting for the Manager (Paper step 9).
  seedCount('CNT-2026-1013', 'SUBMITTED', [SECTION_ID.samrat], PEOPLE.linnet, 4.2, {
    'Sugar, white': 164,
    'Brown sugar': 'skip',
    'Vanilla essence': 8,
    'Cooking oil': 79,
    'Baking powder': 10,
    'Wheat flour': 51,
    Honey: 7,
    'Gram flour': 3,
    'Cinnamon sticks': 3,
  }, { signedHoursAgo: 3.6 });
  const sugar = counts[0]?.lines.find((l) => itemById(l.itemId)?.name === 'Sugar, white');
  if (sugar) {
    sugar.recheck = 'RECOUNTED';
    sugar.first = 162;
  }
  const wheat = counts[0]?.lines.find((l) => itemById(l.itemId)?.name === 'Wheat flour');
  if (wheat) wheat.recheck = 'KEPT';
  // Peter is counting Summer right now.
  seedCount('CNT-2026-1014', 'OPEN', [SECTION_ID.summer], PEOPLE.peter, 1.8, { 'Whole milk': 96, 'Butter 500 g': 24, 'Cheddar cheese': 6, 'Cream, fresh': 14, Tomatoes: 'skip' });
  // Yesterday's approved Eggs count, with a write-off, and Mary's recount of it.
  const eggsCount = seedCount('CNT-2026-1012', 'APPROVED', [SECTION_ID.others], PEOPLE.linnet, 28, { Eggs: 22 }, { itemNames: ['Eggs', 'Oat milk 1 L', 'Lemons'], signedHoursAgo: 27, approver: PEOPLE.isabel });
  for (const line of eggsCount.lines) {
    const item = itemById(line.itemId);
    if (item?.name === 'Eggs') {
      line.expected = 24;
      line.decision = { kind: 'WRITE_OFF', cause: 'MISCOUNT', note: null, movementKind: null, at: isoAgo(26.5), by: PEOPLE.isabel };
      line.adjustmentRef = 'ADJ-3402';
    }
  }
  const eggLine = eggsCount.lines.find((l) => itemById(l.itemId)?.name === 'Eggs');
  seedCount('CNT-2026-1016', 'OPEN', [], mary, 0.9, {}, { scope: 'ITEMS', itemNames: ['Eggs'], recountOfLineId: eggLine?.id });
  // The Manager's own signed count, flagged to the Director (Paper steps 15 and 26).
  const own = seedCount('CNT-2026-1015', 'APPROVED', [SECTION_ID.packaging], PEOPLE.isabel, 20, { 'Takeaway cups 12 oz': 38, 'Paper bags, small': 20 }, { selfSigned: true, approver: PEOPLE.isabel, signedHoursAgo: 19.5 });
  own.timeline = [
    { label: 'Counted', at: own.signedAt ?? nowIso(), detail: '07:02 to 07:41' },
    { label: 'Signed with your PIN', at: own.signedAt ?? nowIso(), detail: null },
    { label: '2 lines applied', at: own.signedAt ?? nowIso(), detail: 'ADJ-3408 to ADJ-3409' },
    { label: 'Director told about 2 lines', at: own.signedAt ?? nowIso(), detail: null },
  ];
  for (const line of own.lines) {
    const item = itemById(line.itemId);
    if (item?.name === 'Takeaway cups 12 oz') {
      line.expected = 40;
      line.flagged = true;
      line.decision = { kind: 'WRITE_OFF', cause: 'MISCOUNT', note: null, movementKind: null, at: own.signedAt, by: PEOPLE.isabel };
      line.adjustmentRef = 'ADJ-3408';
    }
    if (item?.name === 'Paper bags, small') {
      line.expected = 22;
      line.flagged = true;
      line.alert = false;
      line.decision = { kind: 'WRITE_OFF', cause: 'SPOILAGE', note: null, movementKind: null, at: own.signedAt, by: PEOPLE.isabel };
      line.adjustmentRef = 'ADJ-3409';
    }
  }
  const sugarItem = items.find((i) => i.name === 'Sugar, white');
  if (sugarItem) sugarItem.shortStreak = 3;
  const oil = items.find((i) => i.name === 'Cooking oil');
  if (oil) oil.shortStreak = 1;
  moves.push({
    id: 'm-1',
    itemId: items.find((i) => i.name === 'Rice, 25 kg bag')?.id ?? '',
    fromSectionId: SECTION_ID.summer,
    toSectionId: SECTION_ID.others,
    by: PEOPLE.linnet,
    at: isoAgo(5),
    undone: false,
    unseen: true,
  });
}

// ---------------------------------------------------------------------------------------------- views

const has = fixtureCan;
const seesFigures = (count: CountM): boolean => has('restock.read') && (count.status !== 'OPEN' || count.counter.id === me().id);

function rangeOf(count: CountM): { kes: number; percent: number } {
  return count.range ?? liveRange();
}

interface Computed {
  counted: number | null;
  expected: number;
  cost: number;
  diff: number;
  value: number;
  percent: number;
  result: LineResult;
}

function compute(count: CountM, line: LineM): Computed {
  const item = itemById(line.itemId);
  const expected = line.expected ?? item?.onHand ?? 0;
  const cost = line.cost ?? item?.cost ?? 0;
  if (line.counted === null) {
    return { counted: null, expected, cost, diff: 0, value: 0, percent: 0, result: line.skipped ? 'NOT_COUNTED' : count.status === 'OPEN' ? 'NOT_YET' : 'NOT_COUNTED' };
  }
  const diff = line.counted - expected;
  return {
    counted: line.counted,
    expected,
    cost,
    diff,
    value: diff * cost,
    percent: expected > 0 ? (diff / expected) * 100 : 0,
    result: judge(line.counted, expected, cost, rangeOf(count)),
  };
}

const progressOf = (count: CountM): CountProgress => {
  const total = count.lines.length;
  const counted = count.lines.filter((l) => l.counted !== null).length;
  const skipped = count.lines.filter((l) => l.skipped).length;
  const zero = count.lines.filter((l) => l.counted === 0).length;
  const rechecked = count.lines.filter((l) => l.recheck !== 'NONE').length;
  return { total, counted, skipped, zero, rechecked, text: `${counted} of ${total} counted${skipped > 0 ? ` · ${skipped} skipped` : ''}` };
};

function decisionOf(line: LineM): LineDecision {
  const d = line.decision;
  let text = '';
  if (d.kind === 'WRITE_OFF') text = d.cause ? CAUSE_TEXT[d.cause] : '';
  if (d.kind === 'MOVEMENT_LOGGED') text = `Movement logged · ${d.movementKind ? d.movementKind.charAt(0) + d.movementKind.slice(1).toLowerCase().replace('_', ' ') : ''}`;
  if (d.kind === 'RECOUNT_ASKED') text = 'Recount asked';
  if (d.kind === 'ACCEPTED') text = 'Within range · accepted';
  return { kind: d.kind, cause: d.cause, causeNote: d.note, movementKind: d.movementKind, text, by: d.by, at: d.at };
}

function storyOf(item: WorldItem, c: Computed): string | null {
  if (c.result !== 'EXCEEDS' && c.result !== 'WITHIN_RANGE') return null;
  const last = lastCountedText(item.lastCountedAt).toLowerCase();
  if (item.department === 'KITCHEN') return `No prep use logged for ${item.name.toLowerCase()} this week. Last counted ${last}.`;
  return `Two deliveries and one dispatch since the last count. Last counted ${last}.`;
}

function lineView(count: CountM, line: LineM): CountLine {
  const item = itemById(line.itemId);
  const c = compute(count, line);
  const figures = seesFigures(count);
  const view: CountLine = {
    id: line.id,
    itemId: line.itemId,
    itemName: item?.name ?? 'Item',
    unit: item?.unit ?? '',
    sectionId: line.sectionId,
    sectionName: line.sectionName,
    position: line.position,
    countedQty: line.counted === null ? null : qty(line.counted),
    skipped: line.skipped,
    recheck: line.recheck,
    firstCountedQty: line.recheck === 'RECOUNTED' && line.first !== null ? qty(line.first) : null,
    lastCountedAt: line.lastCountedAt,
    lastCountedText: lastCountedText(line.lastCountedAt),
    can: {
      decide: count.status === 'SUBMITTED' && has('counts.resolve') && (c.result === 'EXCEEDS' || c.result === 'WITHIN_RANGE'),
      countAgain: count.status === 'APPROVED' && has('counts.record') && has('counts.resolve') && c.result === 'EXCEEDS',
    },
  };
  if (has('catalog.see_costs')) view.unitCost = kes(c.cost);
  if (figures) {
    view.expectedQty = qty(c.expected);
    if (line.counted !== null) {
      view.difference = qty(c.diff);
      view.differencePercent = (Math.round(c.percent * 10) / 10).toFixed(1);
      view.differenceValueKes = kes(c.value);
    }
    view.result = c.result;
    view.story = item ? storyOf(item, c) : null;
    view.suggestedCause = c.result === 'EXCEEDS' && item ? (item.department === 'KITCHEN' ? 'PREP_NOT_LOGGED' : 'SPOILAGE') : null;
    view.shortStreak = item?.shortStreak ?? 0;
    view.decision = decisionOf(line);
    view.director = { flagged: line.flagged, alert: line.alert, seenAt: line.seenAt, seenBy: line.seenBy };
    view.adjustmentRef = line.adjustmentRef;
  }
  return view;
}

function figuresOf(count: CountM) {
  const rows = count.lines.map((l) => ({ l, c: compute(count, l) }));
  const counted = rows.filter((r) => r.c.counted !== null);
  const within = counted.filter((r) => r.c.result === 'MATCHES' || r.c.result === 'WITHIN_RANGE');
  const exceeds = counted.filter((r) => r.c.result === 'EXCEEDS');
  return {
    counted: counted.length,
    withinRange: within.length,
    exceeds: exceeds.length,
    notCounted: rows.length - counted.length,
    toDecide: exceeds.filter((r) => r.l.decision.kind === 'PENDING').length,
    decided: exceeds.filter((r) => r.l.decision.kind !== 'PENDING').length,
    net: counted.reduce((a, r) => a + r.c.value, 0),
    withinNet: within.reduce((a, r) => a + r.c.value, 0),
    exceedsNet: exceeds.reduce((a, r) => a + r.c.value, 0),
  };
}

function statusTextOf(count: CountM): string {
  if (count.status === 'OPEN') return 'In progress';
  if (count.status === 'SUBMITTED') return has('counts.resolve') ? 'Waiting for you' : 'Submitted';
  return count.selfSigned ? 'Signed' : 'Approved';
}

function trackerOf(count: CountM): CountDetail['tracker'] {
  const f = figuresOf(count);
  // "Checked" means the Manager has decided every outside-range line (N7); a submitted count with nothing decided yet is at "Submitted".
  const checked = count.status === 'APPROVED' || (count.status === 'SUBMITTED' && f.decided > 0 && f.toDecide === 0);
  const state = (done: boolean, current: boolean): 'DONE' | 'CURRENT' | 'TODO' => (done ? 'DONE' : current ? 'CURRENT' : 'TODO');
  const waiting = count.status === 'SUBMITTED' && !checked;
  return {
    steps: [
      { key: 'COUNTED', state: state(count.status !== 'OPEN', count.status === 'OPEN'), at: count.signedAt },
      { key: 'SUBMITTED', state: state(count.status !== 'OPEN' && !waiting, waiting), at: count.signedAt },
      { key: 'CHECKED', state: count.status === 'APPROVED' ? 'DONE' : checked ? 'CURRENT' : 'TODO', at: checked ? count.approvedAt : null },
      { key: 'APPROVED', state: state(count.status === 'APPROVED', false), at: count.approvedAt },
    ],
  };
}

function detailView(count: CountM): CountDetail {
  const view: CountDetail = {
    id: count.id,
    reference: count.reference,
    status: count.status,
    statusText: statusTextOf(count),
    sections: count.sectionIds.map((id) => ({ id, name: sectionById(id)?.name ?? 'Section' })),
    scope: count.scope,
    counter: count.counter,
    startedAt: count.startedAt,
    signedAt: count.signedAt,
    approvedAt: count.approvedAt,
    approver: count.approver,
    selfSigned: count.selfSigned,
    recountOf: recountInfo(count),
    progress: progressOf(count),
    savedAt: count.savedAt,
    tracker: trackerOf(count),
    lines: count.lines.map((l) => lineView(count, l)),
    can: {
      count: count.status === 'OPEN' && count.counter.id === me().id && has('counts.record'),
      sign: count.status === 'OPEN' && count.counter.id === me().id && has('counts.record'),
      decide: count.status === 'SUBMITTED' && has('counts.resolve'),
      approve: count.status === 'SUBMITTED' && has('counts.resolve') && figuresOf(count).toDecide === 0,
      print: has('counts.read') && count.status !== 'OPEN',
    },
  };
  if (seesFigures(count)) {
    const f = figuresOf(count);
    view.figures = {
      counted: f.counted,
      withinRange: f.withinRange,
      exceeds: f.exceeds,
      notCounted: f.notCounted,
      toDecide: f.toDecide,
      decided: f.decided,
      netDifferenceKes: kes(f.net),
      withinRangeNetKes: kes(f.withinNet),
    };
    view.range = { kes: rangeOf(count).kes, percent: String(rangeOf(count).percent) };
    view.expectedAsOf = count.signedAt;
    view.timeline = count.timeline;
  }
  return view;
}

function recountInfo(count: CountM): CountDetail['recountOf'] {
  if (!count.recountOfLineId) return null;
  for (const other of counts) {
    const line = other.lines.find((l) => l.id === count.recountOfLineId);
    if (line) return { countId: other.id, reference: other.reference, lineId: line.id, itemName: itemById(line.itemId)?.name ?? '' };
  }
  return null;
}

function sectionsText(count: CountM): string {
  if (count.scope === 'ITEMS') return count.lines.map((l) => itemById(l.itemId)?.name ?? '').join(', ');
  return count.sectionIds.map((id) => sectionById(id)?.name ?? '').join(', ');
}

function rowView(count: CountM): CountRow {
  const p = progressOf(count);
  const f = figuresOf(count);
  const row: CountRow = {
    id: count.id,
    reference: count.reference,
    status: count.status,
    statusText: statusTextOf(count),
    sectionsText: sectionsText(count),
    counter: count.counter,
    startedAt: count.startedAt,
    signedAt: count.signedAt,
    signedText: count.signedAt ? signedText(count.signedAt) : `Started ${hhmm(count.startedAt)}`,
    itemsCounted: p.counted,
    itemsTotal: p.total,
    itemsText: count.status === 'OPEN' ? `${p.counted} of ${p.total}` : String(p.counted),
    recountOf: (() => {
      const r = recountInfo(count);
      return r ? { id: r.countId, reference: r.reference } : null;
    })(),
    mine: count.counter.id === me().id,
    can: { review: count.status === 'SUBMITTED' && has('counts.resolve') },
  };
  if (has('restock.read')) row.differencesText = count.status === 'OPEN' ? 'Not signed yet' : `${f.exceeds} exceed · ${f.withinRange} within`;
  return row;
}

// ------------------------------------------------------------------------------------------ endpoints

const findCount = (id: string): CountM => {
  const count = counts.find((c) => c.id === id);
  if (!count) fail(404, 'NOT_FOUND', 'Count not found');
  if (!has('counts.read') && count.counter.id !== me().id) fail(404, 'NOT_FOUND', 'Count not found');
  return count;
};

const requireCap = (cap: Parameters<typeof has>[0]): void => {
  if (!has(cap)) fail(403, 'FORBIDDEN', 'Not allowed');
};

function lastCountedBy(section: string): string | null {
  const done = counts.filter((c) => c.status !== 'OPEN' && c.sectionIds.includes(section) && c.signedAt).sort((a, b) => Date.parse(b.signedAt ?? '') - Date.parse(a.signedAt ?? ''))[0];
  return done ? (done.counter.name.split(' ')[0] ?? null) : null;
}

function startOptions(recountLineId: string | null): StartOptions {
  requireCap('counts.record');
  const mine = counts.find((c) => c.status === 'OPEN' && c.counter.id === me().id);
  const mineOrder = orderToday.get(me().id);
  const ordered = mineOrder ? [...sections].sort((a, b) => mineOrder.indexOf(a.id) - mineOrder.indexOf(b.id)) : [...sections].sort((a, b) => a.position - b.position);
  const stamps = sections.map((s) => Math.min(...itemsOf(s.id).map((i) => (i.lastCountedAt ? Date.parse(i.lastCountedAt) : 0)), Infinity));
  const oldest = Math.min(...stamps);
  let recount: StartOptions['recount'] = null;
  if (recountLineId) {
    for (const count of counts) {
      const line = count.lines.find((l) => l.id === recountLineId);
      if (!line) continue;
      const item = itemById(line.itemId);
      if (!item) break;
      recount = { lineId: line.id, countId: count.id, countReference: count.reference, itemId: item.id, itemName: item.name, unit: item.unit, sectionName: line.sectionName };
    }
    if (!recount) fail(400, 'RECOUNT_NOT_ALLOWED', 'That line cannot be counted again.');
  }
  return {
    sections: ordered.map((s) => {
      const list = itemsOf(s.id);
      const last = list.reduce<string | null>((a, i) => (i.lastCountedAt && (!a || i.lastCountedAt > a) ? i.lastCountedAt : a), null);
      const open = counts.find((c) => c.status === 'OPEN' && c.sectionIds.includes(s.id));
      return {
        id: s.id,
        name: s.name,
        supplierName: s.supplierName,
        itemCount: list.length,
        lastCountedAt: last,
        lastCountedText: lastCountedText(last),
        lastCountedBy: lastCountedBy(s.id),
        longestSinceCount: Math.min(...list.map((i) => (i.lastCountedAt ? Date.parse(i.lastCountedAt) : 0))) === oldest && list.length > 0,
        busy: open ? { countId: open.id, reference: open.reference, counterName: open.counter.name } : null,
      };
    }),
    order: mineOrder ? { mode: 'TODAY', appliesTo: 'today' } : { mode: 'SHELF', appliesTo: 'every day' },
    unsectionedCount: itemsOf(null).length,
    openCount: mine
      ? { id: mine.id, reference: mine.reference, sectionsText: sectionsText(mine), progressText: progressOf(mine).text }
      : null,
    recount,
    can: { start: has('counts.record') },
  };
}

const startedKeys = new Map<string, string>();

function startCount(input: StartCountInput): CountDetail {
  requireCap('counts.record');
  const replay = startedKeys.get(input.idempotencyKey);
  if (replay) {
    const found = counts.find((c) => c.id === replay);
    if (found) return detailView(found);
  }
  if (counts.some((c) => c.status === 'OPEN' && c.counter.id === me().id)) fail(409, 'YOU_HAVE_OPEN_COUNT', 'You already have a count open.');
  let scoped: WorldItem[] = [];
  let sectionIds: string[] = [];
  let scope: 'SECTIONS' | 'ITEMS' = 'SECTIONS';
  let recountOfLineId: string | null = null;
  if (input.recountOfLineId) {
    const owner = counts.find((c) => c.lines.some((l) => l.id === input.recountOfLineId));
    const line = owner?.lines.find((l) => l.id === input.recountOfLineId);
    if (!owner || !line || owner.status === 'OPEN') fail(400, 'RECOUNT_NOT_ALLOWED', 'That line cannot be counted again.');
    const item = itemById(line.itemId);
    if (item) scoped = [item];
    scope = 'ITEMS';
    recountOfLineId = line.id;
  } else if (input.itemIds?.length) {
    scoped = items.filter((i) => input.itemIds?.includes(i.id));
    scope = 'ITEMS';
  } else {
    sectionIds = input.sectionIds ?? [];
    for (const id of sectionIds) {
      const busy = counts.find((c) => c.status === 'OPEN' && c.sectionIds.includes(id));
      if (busy) fail(409, 'SECTION_BUSY', `${busy.counter.name} is already counting that section.`);
    }
    const mineOrder = orderToday.get(me().id);
    const ordered = mineOrder ? [...sectionIds].sort((a, b) => mineOrder.indexOf(a) - mineOrder.indexOf(b)) : [...sectionIds].sort((a, b) => (sectionById(a)?.position ?? 0) - (sectionById(b)?.position ?? 0));
    sectionIds = ordered;
    scoped = ordered.flatMap((id) => itemsOf(id));
  }
  if (scoped.length === 0) fail(400, 'NOTHING_TO_COUNT', 'Nothing is set up to count there.');
  const count: CountM = {
    id: `c-${nextRef}`,
    reference: `CNT-2026-${nextRef++}`,
    status: 'OPEN',
    sectionIds,
    scope,
    counter: me(),
    startedAt: nowIso(),
    signedAt: null,
    approvedAt: null,
    approver: null,
    selfSigned: false,
    recountOfLineId,
    lines: scoped.map((item, idx) => newLine(item, idx, sectionById(item.sectionId ?? '')?.name ?? null)),
    savedAt: null,
    range: null,
    timeline: [],
    idempotencyKey: input.idempotencyKey,
  };
  counts.push(count);
  startedKeys.set(input.idempotencyKey, count.id);
  return detailView(count);
}

function ownOpen(id: string): CountM {
  const count = counts.find((c) => c.id === id);
  if (!count) fail(404, 'NOT_FOUND', 'Count not found');
  if (count.counter.id !== me().id) fail(403, 'NOT_YOUR_COUNT', 'Only the person who counted can do this.');
  if (count.status !== 'OPEN') fail(409, 'COUNT_NOT_OPEN', 'This count is already signed.');
  return count;
}

function saveLines(id: string, input: SaveLinesInput) {
  const count = ownOpen(id);
  for (const entry of input.lines) {
    const line = count.lines.find((l) => l.id === entry.lineId);
    if (!line) continue;
    const next = entry.countedQty === null ? null : Number(entry.countedQty);
    if (entry.recheck === 'RECOUNTED' && line.counted !== null && line.first === null) line.first = line.counted;
    line.counted = entry.skipped ? null : next;
    line.skipped = entry.skipped;
    if (entry.recheck) line.recheck = entry.recheck;
  }
  count.savedAt = nowIso();
  const result: { savedAt: string; progress: CountProgress; lines?: { lineId: string; result?: LineResult; difference?: string; differenceValueKes?: string }[] } = {
    savedAt: count.savedAt,
    progress: progressOf(count),
  };
  if (seesFigures(count)) {
    result.lines = input.lines.map((entry) => {
      const line = count.lines.find((l) => l.id === entry.lineId);
      if (!line) return { lineId: entry.lineId };
      const c = compute(count, line);
      return { lineId: line.id, result: c.result, ...(line.counted !== null ? { difference: qty(c.diff), differenceValueKes: kes(c.value) } : {}) };
    });
  }
  return result;
}

function check(id: string, sectionId: string): CheckResult {
  const count = ownOpen(id);
  if (has('restock.read')) return { items: [], text: '' };
  const list = count.lines.filter((l) => l.sectionId === sectionId && l.counted !== null && !l.offered && compute(count, l).result === 'EXCEEDS');
  for (const line of list) line.offered = true;
  const name = sectionById(sectionId)?.name ?? 'This section';
  return {
    items: list.map((l) => ({ lineId: l.id, itemName: itemById(l.itemId)?.name ?? '', unit: itemById(l.itemId)?.unit ?? '', sectionName: l.sectionName, counted: qty(l.counted ?? 0) })),
    text: list.length > 0 ? `${name} done. Check ${list.length} item${list.length === 1 ? '' : 's'} again?` : '',
  };
}

function signPreview(id: string): SignPreview {
  const count = ownOpen(id);
  const p = progressOf(count);
  const preview: SignPreview = { itemCount: p.counted, zero: p.zero, skipped: p.skipped };
  if (seesFigures(count)) {
    const rows = count.lines.map((l) => ({ l, c: compute(count, l) })).filter((r) => r.c.counted !== null);
    const outside = rows.filter((r) => r.c.result === 'EXCEEDS');
    const applied = rows.filter((r) => r.c.result !== 'EXCEEDS' && r.c.diff !== 0);
    preview.figures = {
      appliedLines: applied.length,
      appliedNetKes: kes(applied.reduce((a, r) => a + r.c.value, 0)),
      outside: outside.map((r) => ({
        lineId: r.l.id,
        itemName: itemById(r.l.itemId)?.name ?? '',
        unit: itemById(r.l.itemId)?.unit ?? '',
        difference: qty(r.c.diff),
        differenceValueKes: kes(r.c.value),
        cause: null,
      })),
      netKes: kes(rows.reduce((a, r) => a + r.c.value, 0)),
      causesNeeded: outside.map((r) => r.l.id),
      directorNote: outside.length > 0 ? 'The Director sees these lines with your causes.' : 'Nothing is outside the range, so the Director is not alerted.',
    };
  }
  return preview;
}

function postAdjustment(line: LineM, c: Computed, when: string): void {
  if (c.diff === 0) return;
  line.adjustmentRef = `ADJ-${nextAdj++}`;
  const item = itemById(line.itemId);
  if (item) item.onHand += c.diff;
  line.lastCountedAt = when;
}

function sign(id: string, input: SignInput): CountDetail {
  const count = ownOpen(id);
  if (input.pin === '0000' || input.pin.length < 4) fail(400, 'INVALID_PIN', 'Could not sign. Check your PIN and try again.');
  if (count.lines.every((l) => l.counted === null)) fail(400, 'NOTHING_COUNTED', 'You have not counted anything yet.');
  const when = nowIso();
  const range = liveRange();
  count.signedAt = when;
  count.range = range;
  for (const line of count.lines) {
    const item = itemById(line.itemId);
    line.expected = item?.onHand ?? 0;
    line.cost = item?.cost ?? 0;
  }
  const selfSign = has('counts.resolve');
  if (selfSign) {
    const outside = count.lines.filter((l) => compute(count, l).result === 'EXCEEDS');
    for (const line of outside) {
      const cause = input.causes?.find((c) => c.lineId === line.id);
      if (!cause) fail(400, 'CAUSE_REQUIRED', 'Pick a cause for every line outside the range.');
      line.decision = { kind: 'WRITE_OFF', cause: cause.cause, note: cause.note ?? null, movementKind: null, at: when, by: me() };
      line.flagged = true;
    }
    count.selfSigned = true;
    count.status = 'APPROVED';
    count.approvedAt = when;
    count.approver = me();
    const first = nextAdj;
    for (const line of count.lines) {
      const c = compute(count, line);
      if (c.counted === null) continue;
      postAdjustment(line, c, when);
      if (Math.abs(c.value) >= settings.directorAlertKes) {
        line.alert = true;
        line.flagged = true;
      }
    }
    const last = nextAdj - 1;
    count.timeline = [
      { label: 'Counted', at: when, detail: `${hhmm(count.startedAt)} to ${hhmm(when)}` },
      { label: 'Signed with your PIN', at: when, detail: null },
      ...(last >= first ? [{ label: `${last - first + 1} lines applied`, at: when, detail: `ADJ-${first} to ADJ-${last}` }] : []),
      ...(outside.length > 0 ? [{ label: `Director told about ${outside.length} line${outside.length === 1 ? '' : 's'}`, at: when, detail: null }] : []),
    ];
  } else {
    count.status = 'SUBMITTED';
    count.timeline = [
      { label: 'Counted', at: when, detail: `${hhmm(count.startedAt)} to ${hhmm(when)}` },
      { label: 'Signed with PIN', at: when, detail: null },
    ];
  }
  for (const line of count.lines) if (line.counted !== null && !selfSign) line.lastCountedAt = line.lastCountedAt;
  return detailView(count);
}

function decide(id: string, input: DecisionInput): CountDetail {
  requireCap('counts.resolve');
  const count = findCount(id);
  if (count.status !== 'SUBMITTED') fail(409, 'COUNT_NOT_SUBMITTED', 'This count is not waiting for review.');
  const targets = input.group === 'WITHIN_RANGE'
    ? count.lines.filter((l) => compute(count, l).result === 'WITHIN_RANGE')
    : count.lines.filter((l) => input.lineIds?.includes(l.id));
  const d = input.decision;
  const when = nowIso();
  for (const line of targets) {
    if (d.kind === 'CLEAR') line.decision = { kind: 'PENDING', cause: null, note: null, movementKind: null, at: null, by: null };
    else if (d.kind === 'WRITE_OFF') line.decision = { kind: 'WRITE_OFF', cause: d.cause, note: d.note ?? null, movementKind: null, at: when, by: me() };
    else if (d.kind === 'MOVEMENT_LOGGED') line.decision = { kind: 'MOVEMENT_LOGGED', cause: null, note: null, movementKind: d.movementKind, at: when, by: me() };
    else if (d.kind === 'RECOUNT_ASKED') line.decision = { kind: 'RECOUNT_ASKED', cause: null, note: null, movementKind: null, at: when, by: me() };
    else line.decision = { kind: 'ACCEPTED', cause: null, note: null, movementKind: null, at: when, by: me() };
  }
  return detailView(count);
}

function approvePreview(id: string): ApprovePreview {
  requireCap('counts.resolve');
  const count = findCount(id);
  const rows = count.lines.map((l) => ({ l, c: compute(count, l) }));
  const writeOffs = rows.filter((r) => r.l.decision.kind === 'WRITE_OFF' && r.c.diff !== 0);
  const accepted = rows.filter((r) => r.l.decision.kind === 'ACCEPTED' && r.c.diff !== 0);
  const net = [...writeOffs, ...accepted].reduce((a, r) => a + r.c.value, 0);
  const alerted = writeOffs.some((r) => Math.abs(r.c.value) >= settings.directorAlertKes);
  const skipped = rows.find((r) => r.l.skipped);
  return {
    rows: writeOffs.map((r) => ({ lineId: r.l.id, label: `${itemById(r.l.itemId)?.name ?? ''} · ${r.l.decision.cause ? CAUSE_TEXT[r.l.decision.cause] : ''}`, valueKes: kes(r.c.value) })),
    withinRange: accepted.length > 0 ? { count: accepted.length, netKes: kes(accepted.reduce((a, r) => a + r.c.value, 0)) } : null,
    adjustments: writeOffs.length + accepted.length,
    netKes: kes(net),
    directorNote: alerted ? `Director is alerted. A difference reaches KES ${settings.directorAlertKes.toLocaleString('en-KE')}.` : `Director is not alerted. No single difference reaches KES ${settings.directorAlertKes.toLocaleString('en-KE')}.`,
    notCountedNote: skipped ? `${itemById(skipped.l.itemId)?.name ?? 'An item'} was not counted, so nothing is written for it.` : null,
  };
}

const approvedKeys = new Set<string>();

function approve(id: string, input: { pin: string; idempotencyKey: string }): CountDetail {
  requireCap('counts.resolve');
  const count = findCount(id);
  if (approvedKeys.has(input.idempotencyKey) && count.status === 'APPROVED') return detailView(count);
  if (count.status !== 'SUBMITTED') fail(409, 'COUNT_NOT_SUBMITTED', 'This count is not waiting for review.');
  if (input.pin === '0000' || input.pin.length < 4) fail(400, 'INVALID_PIN', 'Could not approve. Check your PIN and try again.');
  if (figuresOf(count).toDecide > 0) fail(409, 'LINES_UNDECIDED', 'Decide every line outside the range first.');
  const when = nowIso();
  const first = nextAdj;
  for (const line of count.lines) {
    const c = compute(count, line);
    if (line.decision.kind === 'WRITE_OFF' || line.decision.kind === 'ACCEPTED') {
      postAdjustment(line, c, when);
      if (Math.abs(c.value) >= settings.directorAlertKes) {
        line.alert = true;
        line.flagged = true;
      }
    }
  }
  count.status = 'APPROVED';
  count.approvedAt = when;
  count.approver = me();
  const last = nextAdj - 1;
  count.timeline = [
    ...count.timeline,
    { label: 'Approved with PIN', at: when, detail: null },
    ...(last >= first ? [{ label: `${last - first + 1} lines applied`, at: when, detail: `ADJ-${first} to ADJ-${last}` }] : []),
  ];
  approvedKeys.add(input.idempotencyKey);
  return detailView(count);
}

function summary(audience: string | null): CountsSummary {
  requireCap('counts.read');
  const director = audience ? audience === 'director' : has('counts.acknowledge') && !has('counts.resolve');
  const submitted = counts.filter((c) => c.status === 'SUBMITTED');
  const open = counts.filter((c) => c.status === 'OPEN' && c.scope === 'SECTIONS');
  const signed = counts.filter((c) => c.status !== 'OPEN');
  const exceedsLines = signed.flatMap((c) => c.lines.map((l) => compute(c, l)).filter((x) => x.result === 'EXCEEDS'));
  const net = exceedsLines.reduce((a, x) => a + x.value, 0);
  const oldest = Math.max(...sections.map((s) => Math.max(...itemsOf(s.id).map((i) => dayDiff(i.lastCountedAt ?? isoAgo(24 * 30))))));
  const oldestSection = sections.find((s) => itemsOf(s.id).some((i) => dayDiff(i.lastCountedAt ?? isoAgo(24 * 30)) === oldest))?.name ?? '';
  const longest = { key: 'longest', label: 'LONGEST WITHOUT A COUNT', value: `${oldest} days`, caption: `${oldestSection} section`, tone: 'WARN' as const };
  if (director) {
    const flagged = counts.flatMap((c) => c.lines.filter((l) => l.flagged && !l.seenAt));
    const repeat = items.filter((i) => i.shortStreak >= 3).length;
    return {
      audience: 'director',
      kpis: [
        { key: 'flagged', label: 'FLAGGED TO YOU · NOT SEEN', value: String(flagged.length), caption: flagged.length > 0 ? 'Lines the Manager counted herself' : 'Nothing waiting', tone: flagged.length > 0 ? 'WARN' : 'NEUTRAL', filter: 'flagged' },
        { key: 'net7d', label: 'NET DIFFERENCE · 7 DAYS', value: kesWhole(net), caption: `${exceedsLines.length} lines outside the range`, tone: 'ALERT' },
        { key: 'repeat', label: 'SHORT 3 COUNTS RUNNING', value: `${repeat} item${repeat === 1 ? '' : 's'}`, caption: 'Repeat shortfalls', tone: repeat > 0 ? 'ALERT' : 'NEUTRAL', filter: 'repeat' },
        longest,
      ],
    };
  }
  const firstOpen = open[0];
  return {
    audience: 'manager',
    kpis: [
      { key: 'waiting', label: 'WAITING FOR YOU', value: String(submitted.length), caption: submitted[0] ? `${sectionsText(submitted[0])} · signed ${hhmm(submitted[0].signedAt ?? nowIso())}` : 'Nothing to review', tone: submitted.length > 0 ? 'WARN' : 'NEUTRAL', filter: 'waiting' },
      { key: 'inProgress', label: 'IN PROGRESS', value: String(counts.filter((c) => c.status === 'OPEN').length), caption: firstOpen ? `${sectionsText(firstOpen)} · ${firstOpen.counter.name.split(' ')[0]}, ${progressOf(firstOpen).counted} of ${progressOf(firstOpen).total}` : 'No one is counting', tone: 'NEUTRAL', filter: 'inProgress' },
      { key: 'exceeded7d', label: 'EXCEEDED THE RANGE · 7 DAYS', value: `${exceedsLines.length} lines`, caption: `Net difference ${kesWhole(net)}`, tone: 'ALERT' },
      longest,
    ],
  };
}

function list(query: URLSearchParams): CountsList {
  requireCap('counts.read');
  const status = query.get('status') ?? 'all';
  const search = norm(query.get('search') ?? '');
  const all = [...counts].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const filtered = all.filter((c) => {
    if (status === 'waiting' && c.status !== 'SUBMITTED') return false;
    if (status === 'inProgress' && c.status !== 'OPEN') return false;
    if (status === 'approved' && c.status !== 'APPROVED') return false;
    if (!search) return true;
    return norm(`${c.reference} ${sectionsText(c)} ${c.counter.name}`).includes(search);
  });
  const { slice, page } = paginate(filtered, query);
  return {
    rows: slice.map(rowView),
    chips: {
      all: counts.length,
      waiting: counts.filter((c) => c.status === 'SUBMITTED').length,
      inProgress: counts.filter((c) => c.status === 'OPEN').length,
      approved: counts.filter((c) => c.status === 'APPROVED').length,
      unsectioned: itemsOf(null).length,
    },
    page,
  };
}

function flaggedChips(): FlaggedList['chips'] {
  return {
    flaggedToMe: counts.flatMap((c) => c.lines.filter((l) => l.flagged && !l.seenAt)).length,
    allCounts: counts.length,
    repeatShortfalls: items.filter((i) => i.shortStreak >= 3).length,
  };
}

function flagged(query: URLSearchParams): FlaggedList {
  requireCap('counts.read');
  const rows = counts.flatMap((count) =>
    count.lines
      .filter((l) => l.flagged)
      .map((l) => ({ count, l, c: compute(count, l) })),
  );
  const { slice, page } = paginate(rows, query);
  return {
    rows: slice.map(({ count, l, c }) => ({
      countId: count.id,
      countReference: count.reference,
      lineId: l.id,
      itemName: itemById(l.itemId)?.name ?? '',
      unit: itemById(l.itemId)?.unit ?? '',
      difference: qty(c.diff),
      differenceValueKes: kes(c.value),
      cause: l.decision.cause,
      causeText: l.decision.cause ? CAUSE_TEXT[l.decision.cause] : 'No cause given',
      countedBy: count.counter,
      alert: l.alert,
      seenAt: l.seenAt,
      seenBy: l.seenBy,
      can: { markSeen: has('counts.acknowledge') && !l.seenAt },
    })),
    chips: flaggedChips(),
    page,
  };
}

function repeatShortfalls(query: URLSearchParams): RepeatShortfallList {
  requireCap('counts.read');
  const rows = items
    .filter((i) => i.shortStreak >= 3)
    .map((i) => ({
      itemId: i.id,
      itemName: i.name,
      unit: i.unit,
      sectionName: sectionById(i.sectionId ?? '')?.name ?? null,
      shortRuns: i.shortStreak,
      lastCounts: [
        { countReference: 'CNT-2026-1013', difference: '-16', at: isoAgo(4) },
        { countReference: 'CNT-2026-1011', difference: '-2', at: isoAgo(52) },
        { countReference: 'CNT-2026-1008', difference: '-1', at: isoAgo(124) },
      ],
    }));
  const { slice, page } = paginate(rows, query);
  return { rows: slice, chips: flaggedChips(), page };
}

function markSeen(lineIds: string[]): { seen: number } {
  requireCap('counts.acknowledge');
  let seen = 0;
  for (const count of counts) {
    for (const line of count.lines) {
      if (lineIds.includes(line.id) && line.flagged && !line.seenAt) {
        line.seenAt = nowIso();
        line.seenBy = me();
        seen += 1;
      }
    }
  }
  return { seen };
}

function recordPrint(id: string): CountRecordPrint {
  requireCap('counts.read');
  const count = findCount(id);
  const rows = count.lines.map((l) => ({ l, c: compute(count, l) }));
  const diffs = rows.filter((r) => r.c.counted !== null && r.c.diff !== 0);
  const p = progressOf(count);
  return {
    reference: count.reference,
    generatedText: `Generated ${dayMonthClock(nowIso())}`,
    sectionsText: sectionsText(count),
    counterName: count.counter.name,
    timeText: `${hhmm(count.startedAt)} to ${hhmm(count.signedAt ?? nowIso())}`,
    counted: p.counted,
    total: p.total,
    differences: diffs.length,
    netValueKes: kes(diffs.reduce((a, r) => a + r.c.value, 0)),
    rows: diffs.map((r) => ({
      itemName: itemById(r.l.itemId)?.name ?? '',
      unit: itemById(r.l.itemId)?.unit ?? '',
      expected: qty(r.c.expected),
      counted: qty(r.c.counted ?? 0),
      difference: qty(r.c.diff),
      valueKes: kes(r.c.value),
      decisionText: decisionOf(r.l).text || 'Not decided',
    })),
    footnote: `The other ${p.counted - diffs.length} counted items matched. ${p.skipped} item${p.skipped === 1 ? ' was' : 's were'} skipped and keep their last count. This copy is for the Manager and shows expected stock.`,
    signatures: [
      { role: 'COUNTED_BY', name: count.counter.name, roleLabel: count.counter.roleLabel, signedAtText: dayMonthClock(count.signedAt ?? nowIso()) },
      ...(count.approver && count.approvedAt ? [{ role: 'APPROVED_BY' as const, name: count.approver.name, roleLabel: count.approver.roleLabel, signedAtText: dayMonthClock(count.approvedAt) }] : []),
    ],
  };
}

function blankSheet(): BlankSheet {
  const ordered = [...sections].sort((a, b) => a.position - b.position);
  return {
    printedAtText: `Printed ${hhmm(nowIso())} · Tue 13 Oct 2026`,
    dateText: '13 OCT',
    sections: ordered.map((s, idx) => ({
      id: s.id,
      name: s.name,
      detail: `Section ${idx + 1} of ${ordered.length} · ${s.supplierName ?? 'Manual section'} · ${itemsOf(s.id).length} items`,
      items: itemsOf(s.id).map((i) => ({ name: i.name, unit: i.unit })),
    })),
  };
}

// ----------------------------------------------------------------------------------------------- setup

function moveView(m: MoveM): MoveView {
  const item = itemById(m.itemId);
  const from = m.fromSectionId ? sectionById(m.fromSectionId)?.name ?? null : null;
  const to = sectionById(m.toSectionId)?.name ?? 'Unsectioned';
  return {
    id: m.id,
    itemId: m.itemId,
    itemName: item?.name ?? '',
    fromSectionId: m.fromSectionId,
    fromSectionName: from,
    toSectionId: m.toSectionId,
    toSectionName: to,
    by: m.by,
    at: m.at,
    undone: m.undone,
    text: `Moved here from ${from ?? 'no section'} by ${m.by.name.split(' ')[0]} · ${dayMonthClock(m.at)}`,
    can: { undo: has('counts.setup') && !m.undone },
  };
}

function setupView(): SetupView {
  requireCap('counts.read');
  const unseen = moves.filter((m) => m.unseen && !m.undone);
  const unsectioned = itemsOf(null);
  return {
    version: String(layoutVersion),
    sections: [...sections].sort((a, b) => a.position - b.position).map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      supplierName: s.supplierName,
      itemCount: itemsOf(s.id).length,
      position: s.position,
      tagText: s.kind === 'MANUAL' ? 'manual section' : null,
    })),
    unsectioned: { count: unsectioned.length, text: `${unsectioned.length} new item${unsectioned.length === 1 ? '' : 's'} · never counted until placed` },
    movedSinceLastVisit: unseen.map(moveView),
    movedText: unseen.length > 0 ? `${unseen.length} item${unseen.length === 1 ? '' : 's'} moved by the Attendant since your last visit.` : null,
    can: { edit: has('counts.setup') },
  };
}

function sectionItems(sectionId: string): SectionItems {
  requireCap('counts.read');
  const list = sectionId === 'unsectioned' ? itemsOf(null) : itemsOf(sectionId);
  const name = sectionId === 'unsectioned' ? 'Not in any section' : sectionById(sectionId)?.name ?? 'Section';
  return {
    section: { id: sectionId, name, itemCount: list.length },
    items: list.map((i) => {
      const move = moves.find((m) => m.itemId === i.id && m.toSectionId === sectionId && !m.undone);
      return {
        itemId: i.id,
        name: i.name,
        unit: i.unit,
        lastCountedAt: i.lastCountedAt,
        lastCountedText: lastCountedText(i.lastCountedAt),
        stale: i.lastCountedAt === null ? false : dayDiff(i.lastCountedAt) >= 5,
        movedHere: move ? moveView(move) : null,
      };
    }),
  };
}

function reindex(): void {
  sections.sort((a, b) => a.position - b.position).forEach((s, idx) => {
    s.position = idx;
  });
  for (const s of [...sections.map((x) => x.id), null]) itemsOf(s).forEach((i, idx) => { i.position = idx; });
}

function saveLayout(input: LayoutInput): SetupView {
  requireCap('counts.setup');
  if (input.version !== String(layoutVersion)) fail(409, 'LAYOUT_CHANGED', 'Count setup changed while you were editing.');
  input.sections.forEach((entry, idx) => {
    const section = sectionById(entry.id);
    if (section) section.position = idx;
    const target = entry.id === 'unsectioned' ? null : entry.id;
    entry.itemIds.forEach((itemId, pos) => {
      const item = itemById(itemId);
      if (!item) return;
      if (item.sectionId !== target) {
        moves.push({ id: `m-${moves.length + 1}`, itemId, fromSectionId: item.sectionId, toSectionId: target ?? 'unsectioned', by: me(), at: nowIso(), undone: false, unseen: false });
        item.sectionId = target;
      }
      item.position = pos;
    });
  });
  layoutVersion += 1;
  return setupView();
}

function addItemsList(query: URLSearchParams): AddItemsList {
  requireCap('counts.setup');
  const target = query.get('sectionId') ?? '';
  const q = norm(query.get('q') ?? '');
  const tab = query.get('tab') ?? 'unsectioned';
  const category = query.get('categoryId');
  const type = query.get('type');
  const department = query.get('departmentTag');
  const base = items.filter((i) => i.sectionId !== target);
  const matches = (i: WorldItem) =>
    (!q || norm(i.name).includes(q)) && (!category || i.category === category) && (!type || i.type === type) && (!department || i.department === department);
  const searched = base.filter(matches);
  const inTab = searched.filter((i) => (tab === 'other' ? i.sectionId !== null : i.sectionId === null));
  const { slice, page } = paginate(inTab, query);
  return {
    rows: slice.map((i) => ({
      itemId: i.id,
      name: i.name,
      categoryName: i.category,
      typeText: i.type,
      unit: i.unit,
      placement: i.sectionId === null ? { kind: 'UNSECTIONED' as const, note: 'New, no supplier' } : { kind: 'IN_SECTION' as const, sectionId: i.sectionId, sectionName: sectionById(i.sectionId)?.name ?? '' },
    })),
    chips: { unsectioned: base.filter((i) => i.sectionId === null).length, otherSections: base.filter((i) => i.sectionId !== null).length },
    matchText: q ? `${searched.length} match${searched.length === 1 ? '' : 'es'} for “${query.get('q')}” · all sections` : null,
    page,
  };
}

function addItems(sectionId: string, itemIds: string[]): SetupView {
  requireCap('counts.setup');
  const end = itemsOf(sectionId).length;
  itemIds.forEach((id, idx) => {
    const item = itemById(id);
    if (!item) return;
    moves.push({ id: `m-${moves.length + 1}`, itemId: id, fromSectionId: item.sectionId, toSectionId: sectionId, by: me(), at: nowIso(), undone: false, unseen: false });
    item.sectionId = sectionId;
    item.position = end + idx;
  });
  layoutVersion += 1;
  reindex();
  return setupView();
}

function moveItem(itemId: string, toSectionId: string): MoveView {
  requireCap('counts.record');
  const item = itemById(itemId);
  if (!item) fail(404, 'ITEM_NOT_IN_SETUP', 'That item is not in Count setup any more.');
  const move: MoveM = { id: `m-${moves.length + 1}`, itemId, fromSectionId: item.sectionId, toSectionId, by: me(), at: nowIso(), undone: false, unseen: !has('counts.setup') };
  moves.push(move);
  item.sectionId = toSectionId;
  item.position = itemsOf(toSectionId).length;
  layoutVersion += 1;
  reindex();
  return moveView(move);
}

function undoMove(id: string): SetupView {
  requireCap('counts.setup');
  const move = moves.find((m) => m.id === id);
  if (!move || move.undone) fail(409, 'MOVE_ALREADY_UNDONE', 'That move was already undone.');
  const item = itemById(move.itemId);
  if (item) {
    item.sectionId = move.fromSectionId;
    item.position = itemsOf(move.fromSectionId).length;
  }
  move.undone = true;
  layoutVersion += 1;
  reindex();
  return setupView();
}

function addSection(name: string): SetupView {
  requireCap('counts.setup');
  const trimmed = name.trim();
  if (sections.some((s) => norm(s.name) === norm(trimmed))) fail(409, 'SECTION_NAME_TAKEN', 'A section with that name already exists.');
  sections.push({ id: `s-${sections.length + 1}-${Date.now() % 100000}`, name: trimmed, kind: 'MANUAL', supplierName: null, position: sections.length });
  layoutVersion += 1;
  return setupView();
}

// -------------------------------------------------------------------------------------------- settings

const personOf = (role: 'range' | 'alert'): Person => (role === 'range' ? PEOPLE.isabel : PEOPLE.grace);

function settingsView(): CountSettings {
  requireCap('counts.read');
  return {
    rangeKes: settings.rangeKes,
    rangePercent: String(settings.rangePercent),
    flagRepeatShortfalls: settings.flagRepeatShortfalls,
    directorAlertKes: settings.directorAlertKes,
    rangeUpdatedBy: personOf('range'),
    rangeUpdatedAt: isoAgo(24 * 12),
    alertUpdatedBy: personOf('alert'),
    alertUpdatedAt: isoAgo(24 * 23),
    can: { editRange: has('counts.setup'), editDirectorAlert: has('counts.set_director_alert') },
  };
}

function settingsPreview(query: URLSearchParams): SettingsPreview {
  requireCap('counts.read');
  const rangeKes = Number(query.get('rangeKes') ?? settings.rangeKes);
  const rangePercent = Number(query.get('rangePercent') ?? settings.rangePercent);
  const alertKes = Number(query.get('directorAlertKes') ?? settings.directorAlertKes);
  const lines = counts.filter((c) => c.status !== 'OPEN').flatMap((c) => c.lines.map((l) => compute(c, l)).filter((x) => x.counted !== null));
  const judged = lines.map((x) => judge(x.counted ?? 0, x.expected, x.cost, { kes: rangeKes, percent: rangePercent }));
  const baseline = lines.map((x) => judge(x.counted ?? 0, x.expected, x.cost, liveRange()));
  const outside = judged.filter((r) => r === 'EXCEEDS').length;
  const moved = baseline.filter((r) => r === 'EXCEEDS').length - outside;
  const over = (n: number) => lines.filter((x) => Math.abs(x.value) >= n).length;
  return {
    range: {
      withinRange: judged.length - outside + 205,
      outsideRange: outside + 12,
      hint: moved > 0 ? `This would move ${moved} line${moved === 1 ? '' : 's'} into range. Nothing changes for counts already signed.` : moved < 0 ? `This would move ${-moved} line${moved === -1 ? '' : 's'} out of range. Nothing changes for counts already signed.` : null,
    },
    alert: {
      countsOver: over(alertKes) + 2,
      hint: alertKes !== settings.directorAlertKes ? `${over(settings.directorAlertKes) + 2} counts went over KES ${settings.directorAlertKes.toLocaleString('en-KE')}. At KES ${alertKes.toLocaleString('en-KE')} it would have been ${over(alertKes) + 2}.` : `${over(settings.directorAlertKes) + 2} counts went over KES ${settings.directorAlertKes.toLocaleString('en-KE')} in the last 7 days.`,
    },
  };
}

// --------------------------------------------------------------------------------------------- router

export const countingFixtureHandler: FixtureHandler = ({ method, path, query, body }: FixtureRequest) => {
  initWorld();
  const b = (body ?? {}) as Record<string, unknown>;
  const m = (re: RegExp): RegExpExecArray | null => re.exec(path);
  let hit: RegExpExecArray | null;

  if (method === 'GET') {
    if (path === '/counts/summary') return summary(query.get('audience'));
    if (path === '/counts/flagged') return flagged(query);
    if (path === '/counts/repeat-shortfalls') return repeatShortfalls(query);
    if (path === '/counts/blank-sheet') return blankSheet();
    if (path === '/counts/start-options') return startOptions(query.get('recountLineId'));
    if (path === '/counts') return list(query);
    if ((hit = m(/^\/counts\/([^/]+)\/print$/))) return recordPrint(hit[1] as string);
    if ((hit = m(/^\/counts\/([^/]+)\/sign-preview$/))) return signPreview(hit[1] as string);
    if ((hit = m(/^\/counts\/([^/]+)\/approve-preview$/))) return approvePreview(hit[1] as string);
    if ((hit = m(/^\/counts\/([^/]+)$/))) return detailView(findCount(hit[1] as string));
    if (path === '/count-setup') return setupView();
    if ((hit = m(/^\/count-setup\/sections\/([^/]+)\/items$/))) return sectionItems(hit[1] as string);
    if (path === '/count-setup/add-items') return addItemsList(query);
    if (path === '/count-settings') return settingsView();
    if (path === '/count-settings/preview') return settingsPreview(query);
  }
  if (method === 'POST') {
    if (path === '/counts') return startCount(body as StartCountInput);
    if (path === '/counts/seen') return markSeen((b.lineIds as string[]) ?? []);
    if ((hit = m(/^\/counts\/([^/]+)\/check$/))) return check(hit[1] as string, b.sectionId as string);
    if ((hit = m(/^\/counts\/([^/]+)\/sign$/))) return sign(hit[1] as string, body as SignInput);
    if ((hit = m(/^\/counts\/([^/]+)\/decisions$/))) return decide(hit[1] as string, body as DecisionInput);
    if ((hit = m(/^\/counts\/([^/]+)\/approve$/))) return approve(hit[1] as string, body as { pin: string; idempotencyKey: string });
    if (path === '/count-setup/sections') return addSection(b.name as string);
    if ((hit = m(/^\/count-setup\/sections\/([^/]+)\/items$/))) return addItems(hit[1] as string, (b.itemIds as string[]) ?? []);
    if ((hit = m(/^\/count-setup\/items\/([^/]+)\/move$/))) return moveItem(hit[1] as string, b.toSectionId as string);
    if ((hit = m(/^\/count-setup\/moves\/([^/]+)\/undo$/))) return undoMove(hit[1] as string);
  }
  if (method === 'PUT') {
    if (path === '/counts/section-order/today') {
      requireCap('counts.record');
      const ids = (b.sectionIds as string[]) ?? [];
      orderToday.set(me().id, ids);
      return { sectionIds: ids, appliesTo: 'today' };
    }
    if ((hit = m(/^\/counts\/([^/]+)\/lines$/))) return saveLines(hit[1] as string, body as SaveLinesInput);
    if (path === '/count-setup/layout') return saveLayout(body as LayoutInput);
    if (path === '/count-settings') {
      requireCap('counts.setup');
      settings.rangeKes = Number(b.rangeKes);
      settings.rangePercent = Number(b.rangePercent);
      settings.flagRepeatShortfalls = Boolean(b.flagRepeatShortfalls);
      return settingsView();
    }
    if (path === '/count-settings/director-alert') {
      requireCap('counts.set_director_alert');
      settings.directorAlertKes = Number(b.alertKes);
      return settingsView();
    }
  }
  return fail(404, 'NOT_FOUND', `No fixture for ${method} ${path}`);
};
