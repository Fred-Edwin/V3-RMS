import type { Request } from 'express';
import { blindnessOf } from '../../_shared/blind-rule';
import { actorCan, requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { ConflictError, NotFoundError, UnprocessableEntityError } from '../../../../utils/errors';
import type { ExportQuery, RunDetail, RunSummary } from '../_shared/prep-contract';
import { prepRunRepository } from '../_shared/prep-run-repository';
import { serializeRunDetail, serializeRunSummary } from '../_shared/prep-run-serializer';
import { nairobiDateWindow } from '../_shared/prep-time';
import { runsToCsv } from './review-csv';
import { reasonsFor } from './review-reasons';
import { reviewRepository } from './review-repository';

type Actor = NonNullable<Request['user']>;

/** The most rows one export carries (docs/features/inventory/prep-plan.md §3.6, #17). */
export const EXPORT_MAX_ROWS = 10_000;

const NOT_OPEN = 'This run was cancelled or corrected, so there is nothing left to review';

const nairobiToday = (now: Date): string => new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const reviewService = {
  /** #14 The queue, newest first. Every route that reaches here already holds `prep.read_flags`. */
  needsLook: async (actor: Actor, query: { page: number; perPage: number }): Promise<{ count: number; items: (RunSummary & { reasons: string[] })[] }> => {
    const siteId = await requireHubReader(actor);
    const [rows, count] = await Promise.all([reviewRepository.listNeedsLook(siteId, query.page, query.perPage), reviewRepository.countNeedsLook(siteId)]);
    return { count, items: rows.map((run) => ({ ...serializeRunSummary(run, actor), reasons: reasonsFor(run) })) };
  },

  /** #15 The sidebar badge. */
  count: async (actor: Actor): Promise<{ count: number }> => {
    const siteId = await requireHubReader(actor);
    return { count: await reviewRepository.countNeedsLook(siteId) };
  },

  /** #16 Mark reviewed. Idempotent: a run that is already reviewed comes back unchanged. */
  review: async (actor: Actor, id: string, now: Date = new Date()): Promise<RunDetail> => {
    const siteId = await requireHubActor(actor);
    const run = await prepRunRepository.findById(siteId, id);
    if (!run) throw new NotFoundError('Prep run not found');
    if (run.status !== 'RECORDED') throw new ConflictError(NOT_OPEN, 'RUN_NOT_OPEN');
    if (run.reviewedAt) return serializeRunDetail(run, actor, now);

    const changed = await reviewRepository.markReviewed(siteId, id, actor.id, now);
    const fresh = await prepRunRepository.findById(siteId, id);
    if (!fresh) throw new NotFoundError('Prep run not found');
    // Nothing changed and the run is still unreviewed: it was cancelled or corrected between the read and the write.
    if (!changed && !fresh.reviewedAt) throw new ConflictError(NOT_OPEN, 'RUN_NOT_OPEN');
    return serializeRunDetail(fresh, actor, now);
  },

  /** #17 The History table as a CSV file, for the filters on screen. The unit cost column is only there with `prep.see_costs`. */
  exportCsv: async (actor: Actor, query: ExportQuery, now: Date = new Date()): Promise<{ fileName: string; csv: string }> => {
    const siteId = await requireHubReader(actor);
    const rows = await reviewRepository.exportRows(
      siteId,
      {
        search: query.search || undefined,
        outputItemId: query.outputItemId,
        personId: query.personId,
        status: query.status,
        needsLook: actorCan(actor, 'prep.read_flags') ? query.needsLook : undefined,
        mineUserId: query.mine ? actor.id : undefined,
        ...nairobiDateWindow(query.from, query.to),
      },
      EXPORT_MAX_ROWS + 1,
    );
    if (rows.length > EXPORT_MAX_ROWS) {
      throw new UnprocessableEntityError(`That is more than ${EXPORT_MAX_ROWS.toLocaleString('en-US')} runs. Narrow the dates and try again`, 'EXPORT_TOO_LARGE');
    }
    const summaries = rows.map((run) => serializeRunSummary(run, actor));
    // The same rule the serializer applies to `outputUnitCost`, so the header matches the rows even when there are none.
    const withCosts = actorCan(actor, 'prep.see_costs') && !blindnessOf(actor).itemCosts;
    return {
      fileName: `prep-history-${query.from ?? 'start'}-${query.to ?? nairobiToday(now)}.csv`,
      csv: runsToCsv(summaries, withCosts),
    };
  },
};
