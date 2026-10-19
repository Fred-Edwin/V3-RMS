import type { Request, Response } from 'express';
import { toldCounts } from '../plan/plan-notice';
import { listHistory } from '../history/history-service';
import { HistoryQuerySchema } from '../page/page-validators';
import { created, groupOf, ok, subjectOf } from '../rules-http';
import { createVersion } from './versions-create';
import { previewVersion } from './versions-preview';
import { ChangeBodySchema, CreateBodySchema, VersionParamsSchema, WithdrawBodySchema } from './versions-validators';
import { withdrawVersion } from './versions-withdraw';

export const versionsController = {
  /** Paged history of a tab (and a site's own rule). */
  history: async (req: Request, res: Response): Promise<void> => {
    const query = HistoryQuerySchema.parse(req.query);
    ok(res, await listHistory(subjectOf(req), groupOf(req), { siteId: query.siteId ?? null, page: query.page, pageSize: query.pageSize }));
  },

  preview: async (req: Request, res: Response): Promise<void> => {
    ok(res, await previewVersion(subjectOf(req), groupOf(req), ChangeBodySchema.parse(req.body ?? {})));
  },

  /** 201 for a new version, 200 when the same request key had already made it. The notice carries counts only, never people. */
  create: async (req: Request, res: Response): Promise<void> => {
    const body = CreateBodySchema.parse({ ...(req.body ?? {}), idempotencyKey: req.body?.idempotencyKey ?? req.header('idempotency-key') ?? undefined });
    const made = await createVersion(subjectOf(req), groupOf(req), body);
    const data = { version: made.version, notice: { told: toldCounts(made.notice) }, confirmed: made.confirmed, waiting: made.waiting };
    if (made.replay) ok(res, data);
    else created(res, data);
  },

  withdraw: async (req: Request, res: Response): Promise<void> => {
    const { id } = VersionParamsSchema.parse(req.params);
    const done = await withdrawVersion(subjectOf(req), id, WithdrawBodySchema.parse(req.body ?? {}));
    ok(res, { version: done.version });
  },
};
