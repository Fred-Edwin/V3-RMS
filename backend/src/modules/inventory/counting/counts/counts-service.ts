import type { Request } from 'express';
import { NotFoundError, ValidationError } from '../../../../utils/errors';
import { actorCan, requireHubReader } from '../../_shared/central-store-access';
import { dayEndInstant, dayStartInstant } from '../../stock/_shared/nairobi-time';
import { readCountDetail } from '../_shared/count-detail-reader';
import { longestWithoutCount } from '../_shared/count-reads';
import { capsOf } from '../_shared/count-state';
import { countRowView, directorStrip, flaggedRowView, managerStrip, repeatRowView } from './counts-view';
import { countsRepository } from './counts-repository';
import type { CountDetail, CountsList, CountsListQuery, CountsSummary, CountsSummaryQuery, FlaggedList, PagerQuery, RepeatShortfallList } from './counts.types';

type Actor = NonNullable<Request['user']>;

const DAY_MS = 24 * 60 * 60 * 1000;
export const SUMMARY_DAYS = 7;

/** The chips the Flagged and Repeat shortfalls tabs share ("Flagged to me 3", "All counts 5", "Repeat shortfalls 2"). */
const flaggedChips = async (siteId: string): Promise<FlaggedList['chips']> => {
  const [facts, chips] = await Promise.all([countsRepository.summaryFacts(siteId, new Date(0)), countsRepository.chipCounts(siteId)]);
  return { flaggedToMe: facts.flaggedUnseen, allCounts: chips.all, repeatShortfalls: facts.repeatShortfalls };
};

export const countsService = {
  /**
   * C1: the Manager's strip or the Director's, chosen by capability (whoever may mark lines seen gets the Director's). The System
   * Admin holds both, so `audience` lets them pick; for everyone else it is ignored.
   */
  summary: async (actor: Actor, query: CountsSummaryQuery, now: Date = new Date()): Promise<CountsSummary> => {
    const siteId = await requireHubReader(actor);
    const bothHats = actorCan(actor, 'counts.acknowledge') && actorCan(actor, 'counts.resolve');
    const audience = bothHats ? (query.audience ?? 'manager') : actorCan(actor, 'counts.acknowledge') ? 'director' : 'manager';
    const [facts, longest] = await Promise.all([countsRepository.summaryFacts(siteId, new Date(now.getTime() - SUMMARY_DAYS * DAY_MS)), longestWithoutCount(siteId, now, 1)]);
    return { audience, kpis: audience === 'director' ? directorStrip(facts, longest[0], now) : managerStrip(facts, longest[0], now) };
  },

  /** C2: the Counts table with its chips, search and numbered pager. `differencesText` only for a caller who sees stock figures. */
  list: async (actor: Actor, query: CountsListQuery, now: Date = new Date()): Promise<CountsList> => {
    const siteId = await requireHubReader(actor);
    if (query.from && query.to && query.from > query.to) throw new ValidationError('"from" must not be after "to"');
    const caps = capsOf(actor);
    // Nairobi days: `from` starts at the start of that day, `to` is included, so the cut is the start of the day after it.
    const range = { ...(query.from ? { startedFrom: dayStartInstant(query.from) } : {}), ...(query.to ? { startedBefore: dayEndInstant(query.to) } : {}) };
    const [{ rows, total }, chips, unsectioned] = await Promise.all([
      countsRepository.list(siteId, { status: query.status, ...(query.search ? { search: query.search } : {}), ...range }, { page: query.page, pageSize: query.pageSize }),
      countsRepository.chipCounts(siteId, undefined, range),
      countsRepository.unsectionedCount(siteId),
    ]);
    return {
      rows: rows.map((r) => countRowView(r, { caps, actorId: actor.id, now })),
      chips: { ...chips, unsectioned },
      page: { page: query.page, pageSize: query.pageSize, total },
    };
  },

  /** C3: the lines flagged to the Director, unseen first. */
  flagged: async (actor: Actor, query: PagerQuery): Promise<FlaggedList> => {
    const siteId = await requireHubReader(actor);
    const [{ rows, total }, chips] = await Promise.all([countsRepository.flagged(siteId, query), flaggedChips(siteId)]);
    const canMarkSeen = actorCan(actor, 'counts.acknowledge');
    return { rows: rows.map((r) => flaggedRowView(r, canMarkSeen)), chips, page: { page: query.page, pageSize: query.pageSize, total } };
  },

  /** C4: items short on three counts running or more, with their last three counts. */
  repeatShortfalls: async (actor: Actor, query: PagerQuery): Promise<RepeatShortfallList> => {
    const siteId = await requireHubReader(actor);
    const [{ rows, total }, chips] = await Promise.all([
      countsRepository.repeatItems(siteId, { skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      flaggedChips(siteId),
    ]);
    const history = await countsRepository.lastCountsOf(siteId, rows.map((r) => r.itemId));
    return { rows: rows.map((r) => repeatRowView(r, history)), chips, page: { page: query.page, pageSize: query.pageSize, total } };
  },

  /**
   * C5: one count. A caller with `counts.read` may open any; one with only `counts.record` (the Attendant) may open their own and
   * gets a blind payload. Anyone else's count is 404: they are told nothing about it.
   */
  detail: async (actor: Actor, id: string, now: Date = new Date()): Promise<CountDetail> => {
    const siteId = await requireHubReader(actor);
    const count = await countsRepository.findById(siteId, id);
    const allowed = count && (actorCan(actor, 'counts.read') || (actorCan(actor, 'counts.record') && count.counterId === actor.id));
    if (!count || !allowed) throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
    return readCountDetail(actor, siteId, count, now);
  },
};
