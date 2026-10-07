import type { Request } from 'express';
import { locationRepository } from '../../../../repositories/location-repository';
import { NotFoundError } from '../../../../utils/errors';
import { blindnessOf } from '../../_shared/blind-rule';
import { actorCan, requireHubReader } from '../../_shared/central-store-access';
import { longestWithoutCount, todaysCounts, type TodaysCount } from '../../counting/_shared/count-reads';
import type { KpiCell } from '../../_shared/wire';
import { clockText, daysAgoText } from '../_shared/nairobi-time';
import { lowCell, negativeCell, trackedCell } from '../_shared/stock-kpis';
import { trackedSectionCount } from '../_shared/stock-sections';
import type { StockOverview } from '../_shared/stock-contract';
import { overviewRepository } from './overview-repository';

type Actor = NonNullable<Request['user']>;

/** How many "longest without a count" rows the Overview shows. */
const LONGEST_LIMIT = 3;

type TodaysCountRow = StockOverview['todaysCounts'][number];

/** OPEN is in progress, SUBMITTED waits for review, APPROVED is signed (a Manager's own count and an approved Attendant count alike). */
const countRow = (count: TodaysCount): TodaysCountRow => {
  const started = clockText(count.startedAt);
  if (count.status === 'OPEN') {
    return { id: count.id, reference: count.reference, what: count.sectionsText, byText: `${count.counterName} · started ${started}`, status: 'IN_PROGRESS', statusText: 'In progress' };
  }
  const span = `${count.counterName} · ${started} to ${clockText(count.signedAt ?? count.startedAt)}`;
  return count.status === 'SUBMITTED'
    ? { id: count.id, reference: count.reference, what: count.sectionsText, byText: span, status: 'TO_REVIEW', statusText: 'To review' }
    : { id: count.id, reference: count.reference, what: count.sectionsText, byText: span, status: 'SIGNED', statusText: 'Signed' };
};

/** "2 signed · 1 in progress"; "None yet" before the first count of the day. */
export const countsTodayCell = (rows: TodaysCountRow[]): KpiCell => {
  const n = (status: TodaysCountRow['status']) => rows.filter((row) => row.status === status).length;
  const parts = [
    [n('SIGNED'), 'signed'],
    [n('TO_REVIEW'), 'to review'],
    [n('IN_PROGRESS'), 'in progress'],
  ].flatMap(([count, word]) => (count === 0 ? [] : [`${count} ${word}`]));
  return { key: 'countsToday', label: 'COUNTS TODAY', value: String(rows.length), caption: parts.length > 0 ? parts.join(' · ') : 'None yet', tone: 'NEUTRAL' };
};

export const overviewService = {
  /**
   * S1: the Overview. The four KPI cells, today's counts, the sections and items that have gone longest without a count, and
   * whether the caller may start a count. Counting's data arrives only through `count-reads`.
   */
  get: async (actor: Actor, now: Date = new Date()): Promise<StockOverview> => {
    const siteId = await requireHubReader(actor);
    const location = await locationRepository.findCentralStore();
    if (!location || location.siteId !== siteId) throw new NotFoundError('No Central Store is configured');

    const [totals, sections, counts, longest] = await Promise.all([
      overviewRepository.storeTotals(siteId, location.id),
      trackedSectionCount(siteId),
      todaysCounts(siteId, now),
      longestWithoutCount(siteId, now, LONGEST_LIMIT),
    ]);
    const rows = counts.map(countRow);

    return {
      kpis: [trackedCell(totals.tracked, sections), lowCell(totals.lowOrOut), negativeCell(totals.negative), countsTodayCell(rows)],
      todaysCounts: rows,
      longestWithoutCount: longest.map((entry) => ({
        kind: entry.kind,
        refId: entry.refId,
        name: entry.name,
        detail: entry.kind === 'SECTION' ? `Section · ${entry.itemCount ?? 0} ${entry.itemCount === 1 ? 'item' : 'items'}` : `Item · ${entry.sectionName ?? 'No section'}`,
        lastCountedAt: entry.lastCountedAt ? entry.lastCountedAt.toISOString() : null,
        lastCountedText: entry.lastCountedAt ? daysAgoText(entry.lastCountedAt, now) : 'Never counted',
      })),
      // A person who counts blind (the Attendant) starts their count from the Counts page; the Overview button is for the others.
      can: { startCount: actorCan(actor, 'counts.record') && !blindnessOf(actor).stockFigures },
    };
  },
};
