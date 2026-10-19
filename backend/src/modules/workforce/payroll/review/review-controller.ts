import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { addAdjustment, leaveOut, removeAdjustment } from './adjustments-service';
import { checkKind, checkLine, listReview, recalculate } from './review-service';
import { adjustmentBody, adjustmentParams, checkBody, checkKindBody, leaveOutBody, lineParams, monthParams, recalculateBody, removeAdjustmentBody, reviewQuery } from './review-validators';

export const reviewController = {
  list: async (req: Request, res: Response): Promise<void> => ok(res, await listReview(subjectOf(req), monthParams.parse(req.params).monthKey, reviewQuery.parse(req.query))),
  recalculate: async (req: Request, res: Response): Promise<void> => ok(res, await recalculate(subjectOf(req), monthParams.parse(req.params).monthKey, recalculateBody.parse(req.body))),
  check: async (req: Request, res: Response): Promise<void> => {
    const { monthKey, lineId } = lineParams.parse(req.params);
    ok(res, await checkLine(subjectOf(req), monthKey, lineId, checkBody.parse(req.body)));
  },
  checkKind: async (req: Request, res: Response): Promise<void> => ok(res, await checkKind(subjectOf(req), monthParams.parse(req.params).monthKey, checkKindBody.parse(req.body))),
  leaveOut: async (req: Request, res: Response): Promise<void> => {
    const { monthKey, lineId } = lineParams.parse(req.params);
    ok(res, await leaveOut(subjectOf(req), monthKey, lineId, leaveOutBody.parse(req.body)));
  },
  addAdjustment: async (req: Request, res: Response): Promise<void> => ok(res, await addAdjustment(subjectOf(req), monthParams.parse(req.params).monthKey, adjustmentBody.parse(req.body)), 201),
  removeAdjustment: async (req: Request, res: Response): Promise<void> => {
    const { monthKey, id } = adjustmentParams.parse(req.params);
    ok(res, await removeAdjustment(subjectOf(req), monthKey, id, removeAdjustmentBody.parse(req.body)));
  },
};
