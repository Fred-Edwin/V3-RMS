import type { Request } from 'express';
import { actorCan, requireHubReader } from '../../_shared/central-store-access';
import { NotFoundError } from '../../../../utils/errors';
import type { RunDetail, RunsQuery, RunSummary } from '../_shared/prep-contract';
import { prepRunRepository } from '../_shared/prep-run-repository';
import { serializeRunDetail, serializeRunSummary } from '../_shared/prep-run-serializer';
import { nairobiDateWindow } from '../_shared/prep-time';

type Actor = NonNullable<Request['user']>;

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

  /** #10 One run, blind per role. Someone else's run opens read-only for an Attendant (`can` is all false). */
  get: async (actor: Actor, id: string): Promise<RunDetail> => {
    const siteId = await requireHubReader(actor);
    const run = await prepRunRepository.findById(siteId, id);
    if (!run) throw new NotFoundError('Prep run not found');
    return serializeRunDetail(run, actor);
  },
};
