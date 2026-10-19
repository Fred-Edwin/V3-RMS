import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { closePeriodEarly } from './close-service';
import { closeBody, idParam, periodListQuery, periodQuery, reopenBody, signBody } from './periods-validators';
import { getPeriod, listPeriods } from './periods-service';
import { reopenPeriod, signReport } from './reopen-service';

export const periodsController = {
  list: async (req: Request, res: Response): Promise<void> => {
    ok(res, await listPeriods(subjectOf(req), periodListQuery.parse(req.query)));
  },
  get: async (req: Request, res: Response): Promise<void> => {
    ok(res, await getPeriod(subjectOf(req), idParam.parse(req.params).id, periodQuery.parse(req.query)));
  },
  close: async (req: Request, res: Response): Promise<void> => {
    ok(res, await closePeriodEarly(subjectOf(req), idParam.parse(req.params).id, closeBody.parse(req.body ?? {})));
  },
  reopen: async (req: Request, res: Response): Promise<void> => {
    ok(res, await reopenPeriod(subjectOf(req), idParam.parse(req.params).id, reopenBody.parse(req.body)));
  },
  sign: async (req: Request, res: Response): Promise<void> => {
    ok(res, await signReport(subjectOf(req), idParam.parse(req.params).id, signBody.parse(req.body)));
  },
};
