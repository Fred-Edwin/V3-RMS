import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { sheetParams } from '../recording/recording-validators';
import { approveSheet, sendBack, voidSheet } from './approval-service';
import { approveBody, receiveBody, receiveParams, sendBackBody, voidBody } from './approval-validators';
import { receiveCash } from './receipt-service';

export const approvalController = {
  approve: async (req: Request, res: Response): Promise<void> => ok(res, await approveSheet(subjectOf(req), sheetParams.parse(req.params).id, approveBody.parse(req.body))),
  sendBack: async (req: Request, res: Response): Promise<void> => ok(res, await sendBack(subjectOf(req), sheetParams.parse(req.params).id, sendBackBody.parse(req.body))),
  void: async (req: Request, res: Response): Promise<void> => ok(res, await voidSheet(subjectOf(req), sheetParams.parse(req.params).id, voidBody.parse(req.body))),
  receive: async (req: Request, res: Response): Promise<void> => {
    const p = receiveParams.parse(req.params);
    ok(res, await receiveCash(subjectOf(req), p.id, p.lineId, receiveBody.parse(req.body)));
  },
};
