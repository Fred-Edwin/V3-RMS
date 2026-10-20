import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { monthParams } from '../review/review-validators';
import { markPaid } from './paid-service';
import { markPaidBody } from './paid-validators';

export const paidController = {
  markPaid: async (req: Request, res: Response): Promise<void> => ok(res, await markPaid(subjectOf(req), monthParams.parse(req.params).monthKey, markPaidBody.parse(req.body))),
};
