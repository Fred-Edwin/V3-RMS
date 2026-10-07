import type { Request } from 'express';
import { blindnessOf } from '../../_shared/blind-rule';
import { actorCan, requireHubReader } from '../../_shared/central-store-access';
import { NotFoundError } from '../../../../utils/errors';
import type { RunDetail, RunsQuery, RunSummary } from '../_shared/prep-contract';
import { prepRunRepository } from '../_shared/prep-run-repository';
import { serializeRunDetail, serializeRunSummary } from '../_shared/prep-run-serializer';
import { nairobiDateWindow, nairobiDayRange } from '../_shared/prep-time';
import { reviewRepository } from '../review/review-repository';
import { runsSummaryRepository } from './runs-summary-repository';

type Actor = NonNullable<Request['user']>;
export type RunsSummary = { runsThisWeek: number; runsToday: number; needsLookCount: number; prepValue7d?: string };

/** Midnight at the start of this Nairobi week (Monday). */
const nairobiWeekStart = (now: Date): Date => {
  const dayStart = nairobiDayRange(now).start;
  const weekday = new Date(dayStart.getTime() + 3 * 60 * 60 * 1000).getUTCDay(); // 0 = Sunday, in Nairobi
  const sinceMonday = (weekday + 6) % 7;
  return new Date(dayStart.getTime() - sinceMonday * 24 * 60 * 60 * 1000);
};

export { nairobiWeekStart };

export const runsService = {
  /** #8 Newest first. `needsLook` is honoured only for a caller who may read flags; for anyone else it is ignored. */
  list: async (actor: Actor, query: RunsQuery): Promise<{ items: RunSummary[]; total: number; page: number; perPage: number }> => {
    const siteId = await requireHubReader(actor);
    const { items, total } = await prepRunRepository.list(siteId, {
      search: query.search || undefined,
      outputItemId: query.outputItemId,
      personId: query.personId,
      status: query.status,
      needsLook: actorCan(actor, 'prep.read_flags') ? query.needsLook : undefined,
      mineUserId: query.mine ? actor.id : undefined,
      ...nairobiDateWindow(query.from, query.to),
      page: query.page,
      perPage: query.perPage,
    });
    return { items: items.map((run) => serializeRunSummary(run, actor)), total, page: query.page, perPage: query.perPage };
  },

  /** #9 The KPI strip: runs this week and today (Nairobi days, the week starts Monday), the Needs a look count, and the prep value of the last 7 days (costs only). */
  summary: async (actor: Actor, now: Date = new Date()): Promise<RunsSummary> => {
    const siteId = await requireHubReader(actor);
    const today = nairobiDayRange(now).start;
    const weekStart = nairobiWeekStart(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const seesCosts = actorCan(actor, 'prep.see_costs') && !blindnessOf(actor).itemCosts;
    const [runsThisWeek, runsToday, needsLookCount, prepValue7d] = await Promise.all([
      runsSummaryRepository.countRecordedSince(siteId, weekStart),
      runsSummaryRepository.countRecordedSince(siteId, today),
      reviewRepository.countNeedsLook(siteId),
      seesCosts ? runsSummaryRepository.inputCostSince(siteId, sevenDaysAgo) : Promise.resolve(undefined),
    ]);
    return { runsThisWeek, runsToday, needsLookCount, ...(prepValue7d !== undefined ? { prepValue7d } : {}) };
  },

  /** #10 One run, blind per role. Someone else's run opens read-only for an Attendant (`can` is all false). */
  get: async (actor: Actor, id: string): Promise<RunDetail> => {
    const siteId = await requireHubReader(actor);
    const run = await prepRunRepository.findById(siteId, id);
    if (!run) throw new NotFoundError('Prep run not found');
    return serializeRunDetail(run, actor);
  },
};
