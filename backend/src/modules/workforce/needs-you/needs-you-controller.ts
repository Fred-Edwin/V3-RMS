import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok, subjectOf } from '../rota/rota-http';
import { attentionRows } from './sources/attention-source';
import { remind, listOverdue } from './needs-you-overdue';
import { contextFor, countNeedsYou, listNeedsYou, markHomeSeen, undoRow } from './needs-you-service';
import { PAGE_SIZES, pageNeedsYou } from './needs-you-page';

const pageQuery = z
  .object({
    q: z.string().trim().max(80).optional(),
    group: z.string().trim().max(40).optional(),
    siteId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().refine((n) => PAGE_SIZES.some((s) => s === n), 'Rows per page: 10, 25, 50 or 100').default(10),
  })
  .strict();

const itemParam = z.object({ id: z.string().trim().min(3).max(120) }).strict();
const remindBody = z.object({ idempotencyKey: z.string().trim().min(8).max(64) }).strict();

export const needsYouController = {
  list: async (req: Request, res: Response): Promise<void> => ok(res, await listNeedsYou(subjectOf(req))),
  counts: async (req: Request, res: Response): Promise<void> => ok(res, await countNeedsYou(subjectOf(req))),
  page: async (req: Request, res: Response): Promise<void> => ok(res, await pageNeedsYou(subjectOf(req), pageQuery.parse(req.query))),
  seen: async (req: Request, res: Response): Promise<void> => ok(res, await markHomeSeen(subjectOf(req))),
  undo: async (req: Request, res: Response): Promise<void> => ok(res, await undoRow(subjectOf(req), itemParam.parse(req.params).id)),
  attention: async (req: Request, res: Response): Promise<void> => {
    const subject = subjectOf(req);
    const rows = await attentionRows(subject, await contextFor(subject));
    ok(res, { rows, total: rows.length });
  },
  overdue: async (req: Request, res: Response): Promise<void> => ok(res, await listOverdue(subjectOf(req))),
  remind: async (req: Request, res: Response): Promise<void> => ok(res, await remind(subjectOf(req), itemParam.parse(req.params).id, remindBody.parse(req.body).idempotencyKey)),
};
