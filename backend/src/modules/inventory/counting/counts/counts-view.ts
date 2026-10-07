import { Prisma } from '@prisma/client';
import { countWord, fmtKesSigned } from '../_shared/count-format';
import { firstNameOf, toPerson } from '../_shared/count-people';
import { statusTextFor, type CountCaps } from '../_shared/count-state';
import { clockText, daysBetween, signedText } from '../_shared/count-time';
import { CAUSE_TEXT, type CountRow, type CountsSummary, type FlaggedList, type RepeatShortfallList } from '../_shared/counting-contract';
import type { LongestWithoutCount } from '../_shared/count-reads';
import type { CountListRow, FlaggedRow, RepeatHistory, RepeatRow, SummaryFacts } from './counts-repository';

type Cell = CountsSummary['kpis'][number];

const sectionsOf = (r: Pick<CountListRow, 'scopeNames' | 'firstItemNames'>): string => (r.scopeNames.length > 0 ? r.scopeNames : r.firstItemNames).join(', ');

/** "6 days" / "Today" / "Never": how long the longest-waiting section or item has gone without a count. */
const longestCell = (longest: LongestWithoutCount | undefined, now: Date): Cell => {
  if (!longest) return { key: 'longest', label: 'LONGEST WITHOUT A COUNT', value: '–', caption: 'Nothing to count yet', tone: 'NEUTRAL' };
  const days = longest.lastCountedAt ? daysBetween(longest.lastCountedAt, now) : null;
  const value = days === null ? 'Never' : days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`;
  return {
    key: 'longest',
    label: 'LONGEST WITHOUT A COUNT',
    value,
    caption: longest.kind === 'SECTION' ? `${longest.name} section` : `${longest.name}${longest.sectionName ? ` · ${longest.sectionName}` : ''}`,
    tone: days === null || days >= 5 ? 'WARN' : 'NEUTRAL',
  };
};

/** The Store Manager's strip: Waiting for you, In progress, Exceeded the range (7 days), Longest without a count. */
export const managerStrip = (f: SummaryFacts, longest: LongestWithoutCount | undefined, now: Date): Cell[] => [
  {
    key: 'waiting',
    label: 'WAITING FOR YOU',
    value: String(f.waiting.count),
    caption: f.waiting.latest ? `${f.waiting.latest.sectionsText} · signed ${clockText(f.waiting.latest.signedAt)}` : 'Nothing waiting',
    tone: f.waiting.count > 0 ? 'WARN' : 'NEUTRAL',
    filter: 'waiting',
  },
  {
    key: 'inProgress',
    label: 'IN PROGRESS',
    value: String(f.inProgress.count),
    caption: f.inProgress.first ? `${f.inProgress.first.sectionsText} · ${firstNameOf(f.inProgress.first.counterName)}, ${f.inProgress.first.counted} of ${f.inProgress.first.total}` : 'Nobody is counting',
    tone: 'NEUTRAL',
    filter: 'inProgress',
  },
  {
    key: 'exceeded7d',
    label: 'EXCEEDED THE RANGE · 7 DAYS',
    value: countWord(f.exceeded.lines, 'line'),
    caption: `Net difference ${fmtKesSigned(f.exceeded.netKes)}`,
    tone: f.exceeded.lines > 0 ? 'ALERT' : 'NEUTRAL',
  },
  longestCell(longest, now),
];

/** The Director's strip: Flagged to you, Net difference (7 days), Short 3 counts running, Longest without a count. */
export const directorStrip = (f: SummaryFacts, longest: LongestWithoutCount | undefined, now: Date): Cell[] => [
  {
    key: 'flagged',
    label: 'FLAGGED TO YOU · NOT SEEN',
    value: String(f.flaggedUnseen),
    caption: f.flaggedUnseen === 0 ? 'Everything is seen' : `${countWord(f.flaggedUnseen, 'line')} to look at`,
    tone: f.flaggedUnseen > 0 ? 'WARN' : 'NEUTRAL',
    filter: 'flagged',
  },
  {
    key: 'net7d',
    label: 'NET DIFFERENCE · 7 DAYS',
    value: fmtKesSigned(f.exceeded.netKes),
    caption: `${countWord(f.exceeded.lines, 'line')} outside the range`,
    tone: f.exceeded.netKes.isNegative() ? 'ALERT' : 'NEUTRAL',
  },
  {
    key: 'repeat',
    label: 'SHORT 3 COUNTS RUNNING',
    value: countWord(f.repeatShortfalls, 'item'),
    caption: f.repeatShortfalls === 0 ? 'No item is short again and again' : 'Short again and again',
    tone: f.repeatShortfalls > 0 ? 'WARN' : 'NEUTRAL',
    filter: 'repeat',
  },
  longestCell(longest, now),
];

/** "4 exceed · 32 within", "All within range", "No differences", "Not signed yet". Needs `restock.read`. */
export const differencesText = (r: Pick<CountListRow, 'status' | 'exceeds' | 'within'>): string => {
  if (r.status === 'OPEN') return 'Not signed yet';
  if (r.exceeds > 0) return `${r.exceeds} exceed · ${r.within} within`;
  return r.within > 0 ? 'All within range' : 'No differences';
};

export const countRowView = (r: CountListRow, args: { caps: CountCaps; actorId: string; now: Date }): CountRow => {
  const { caps, actorId, now } = args;
  const finished = r.status !== 'OPEN';
  const row: CountRow = {
    id: r.id,
    reference: r.reference,
    status: r.status,
    statusText: statusTextFor(r, caps),
    sectionsText: sectionsOf(r),
    counter: toPerson(r.counter),
    startedAt: r.startedAt.toISOString(),
    signedAt: r.signedAt ? r.signedAt.toISOString() : null,
    signedText: r.signedAt ? signedText(r.signedAt, now) : `Started ${clockText(r.startedAt)}`,
    itemsCounted: r.itemsCounted,
    itemsTotal: r.itemsTotal,
    itemsText: finished ? String(r.itemsCounted) : `${r.itemsCounted} of ${r.itemsTotal}`,
    recountOf: r.recountOf,
    mine: r.counterId === actorId,
    can: { review: r.status === 'SUBMITTED' && caps.resolve },
  };
  if (!caps.blind) row.differencesText = differencesText(r);
  return row;
};

export const flaggedRowView = (r: FlaggedRow, canMarkSeen: boolean): FlaggedList['rows'][number] => {
  const difference = r.countedQty.minus(r.expectedQty);
  return {
    countId: r.countId,
    countReference: r.countReference,
    lineId: r.lineId,
    itemName: r.itemName,
    unit: r.unit,
    difference: difference.toDecimalPlaces(4).toFixed(),
    differenceValueKes: difference.times(r.unitCost).toDecimalPlaces(2).toFixed(2),
    cause: r.cause,
    causeText: r.cause ? CAUSE_TEXT[r.cause] : 'No cause given',
    countedBy: toPerson(r.countedBy),
    alert: r.alert,
    seenAt: r.seenAt ? r.seenAt.toISOString() : null,
    seenBy: r.seenBy ? toPerson(r.seenBy) : null,
    can: { markSeen: canMarkSeen && r.seenAt === null },
  };
};

export const repeatRowView = (r: RepeatRow, history: readonly RepeatHistory[]): RepeatShortfallList['rows'][number] => ({
  itemId: r.itemId,
  itemName: r.itemName,
  unit: r.unit,
  sectionName: r.sectionName,
  shortRuns: r.shortRuns,
  lastCounts: history
    .filter((h) => h.itemId === r.itemId)
    .map((h) => ({ countReference: h.countReference, difference: h.difference.toDecimalPlaces(4).toFixed(), at: h.at.toISOString() })),
});

export const ZERO = new Prisma.Decimal(0);
