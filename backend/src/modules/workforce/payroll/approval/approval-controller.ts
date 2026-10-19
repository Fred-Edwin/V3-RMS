import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { monthParams } from '../review/review-validators';
import { approveBody, sendBackBody, sendBody } from './approval-validators';
import { approveMonth, sendBack, sendToAccountant } from './approval-service';

export const approvalController = {
  send: async (req: Request, res: Response): Promise<void> => ok(res, await sendToAccountant(subjectOf(req), monthParams.parse(req.params).monthKey, sendBody.parse(req.body))),
  sendBack: async (req: Request, res: Response): Promise<void> => ok(res, await sendBack(subjectOf(req), monthParams.parse(req.params).monthKey, sendBackBody.parse(req.body))),
  approve: async (req: Request, res: Response): Promise<void> => ok(res, await approveMonth(subjectOf(req), monthParams.parse(req.params).monthKey, approveBody.parse(req.body))),
};
