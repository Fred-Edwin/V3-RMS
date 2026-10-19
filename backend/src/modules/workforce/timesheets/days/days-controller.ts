import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { decideDay } from './decide-service';
import { dayParams, decisionBody } from './days-validators';
import { dayDetail } from './person-service';

export const daysController = {
  day: async (req: Request, res: Response): Promise<void> => {
    ok(res, await dayDetail(subjectOf(req), dayParams.parse(req.params).id));
  },
  decide: async (req: Request, res: Response): Promise<void> => {
    ok(res, await decideDay(subjectOf(req), dayParams.parse(req.params).id, decisionBody.parse(req.body)));
  },
};
