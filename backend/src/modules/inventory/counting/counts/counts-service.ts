import type { Request } from 'express';
import { NotFoundError, ValidationError } from '../../../../utils/errors';
import { actorCan, requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { addDays, dayEndInstant, dayStartInstant, nairobiDay } from '../../stock/_shared/nairobi-time';
import { readCountDetail } from '../_shared/count-detail-reader';
import { longestWithoutCount } from '../_shared/count-reads';
import { capsOf } from '../_shared/count-state';
import { progressView, sectionsText } from '../_shared/count-view';
import { countRowView, countsHomeView, directorStrip, flaggedRowView, managerStrip, myCountRowView, repeatRowView } from './counts-view';
import { countsRepository } from './counts-repository';
import type { CountDetail, CountsHome, CountsList, CountsListQuery, CountsSummary, CountsSummaryQuery, FlaggedList, MyCountsList, MyCountsQuery, PagerQuery, RepeatShortfallList } from './counts.types';

type Actor = NonNullable<Request['user']>;

const DAY_MS = 24 * 60 * 60 * 1000;
export const SUMMARY_DAYS = 7;
/** C32's window when no range is given: today and the 29 days before it. */
export const MINE_DEFAULT_DAYS = 30;

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
   * C31: the Attendant's front door. Everything is the caller's own, and nothing is a stock figure: the open count to resume, how
   * many sections there are and the one counted longest ago (a date), how many counts they have signed, and how many waste entries
   * they logged on today's Nairobi day. The Store Manager and System Admin get the same answer about their own work.
   */
  home: async (actor: Actor, now: Date = new Date()): Promise<CountsHome> => {
    const siteId = await requireHubActor(actor);
    const today = nairobiDay(now);
    const [open, sections, signedCount, wasteToday] = await Promise.all([
      countsRepository.findOpenOf(siteId, actor.id),
      longestWithoutCount(siteId, now, Number.MAX_SAFE_INTEGER),
      countsRepository.signedCountOf(siteId, actor.id),
      countsRepository.wasteEntriesLogged(siteId, actor.id, dayStartInstant(today), dayEndInstant(today)),
    ]);
    const progress = open ? progressView(open.lines) : null;
    return countsHomeView(
      {
        open: open && progress ? { id: open.id, reference: open.reference, sectionsText: sectionsText(open), counted: progress.counted, total: progress.total, progressText: progress.text } : null,
        sections,
        signedCount,
        wasteToday,
      },
      now,
    );
  },

  /**
   * C32: the caller's own signed counts, newest signed first, whoever the caller is (another person's count never appears, and a
   * Manager's `counts.read` does not widen it). With no range the window is the last 30 Nairobi days; a count waiting for review
   * always shows.
   */
  mine: async (actor: Actor, query: MyCountsQuery, now: Date = new Date()): Promise<MyCountsList> => {
    const siteId = await requireHubActor(actor);
    if (query.from && query.to && query.from > query.to) throw new ValidationError('"from" must not be after "to"');
    const from = query.from ?? (query.to ? undefined : addDays(nairobiDay(now), -(MINE_DEFAULT_DAYS - 1)));
    const range = { ...(from ? { signedFrom: dayStartInstant(from) } : {}), ...(query.to ? { signedBefore: dayEndInstant(query.to) } : {}) };
    const { rows, total } = await countsRepository.mineList(siteId, actor.id, { status: query.status, ...range }, { page: query.page, pageSize: query.pageSize });
    return { rows: rows.map((r) => myCountRowView(r, now)), page: { page: query.page, pageSize: query.pageSize, total } };
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
