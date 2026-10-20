import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { monthParams } from '../review/review-validators';
import { publishMonth } from './publish-service';
import { publishBody } from './publish-validators';

export const publishController = {
  publish: async (req: Request, res: Response): Promise<void> => ok(res, await publishMonth(subjectOf(req), monthParams.parse(req.params).monthKey, publishBody.parse(req.body))),
};
