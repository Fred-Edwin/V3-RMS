import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { decideOvertime, listOvertime } from './overtime-service';
import { overtimeDecisionBody, overtimeListQuery, overtimeParams } from './overtime-validators';

export const overtimeController = {
  list: async (req: Request, res: Response): Promise<void> => {
    ok(res, await listOvertime(subjectOf(req), overtimeListQuery.parse(req.query)));
  },
  decide: async (req: Request, res: Response): Promise<void> => {
    ok(res, await decideOvertime(subjectOf(req), overtimeParams.parse(req.params).id, overtimeDecisionBody.parse(req.body)));
  },
};
