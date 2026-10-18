import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { decideDay } from './decide-service';
import { dayParams, decisionBody, periodPersonParams } from './days-validators';
import { dayDetail, personPeriod } from './person-service';

export const daysController = {
  person: async (req: Request, res: Response): Promise<void> => {
    const { id, employeeId } = periodPersonParams.parse(req.params);
    ok(res, await personPeriod(subjectOf(req), id, employeeId));
  },
  day: async (req: Request, res: Response): Promise<void> => {
    ok(res, await dayDetail(subjectOf(req), dayParams.parse(req.params).id));
  },
  decide: async (req: Request, res: Response): Promise<void> => {
    ok(res, await decideDay(subjectOf(req), dayParams.parse(req.params).id, decisionBody.parse(req.body)));
  },
};
