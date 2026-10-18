import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { myRota, myTime } from './me-service';
import { myRotaQuery, myTimeQuery } from './me-validators';

export const meController = {
  time: async (req: Request, res: Response): Promise<void> => {
    ok(res, await myTime(subjectOf(req), myTimeQuery.parse(req.query)));
  },
  rota: async (req: Request, res: Response): Promise<void> => {
    ok(res, await myRota(subjectOf(req), myRotaQuery.parse(req.query)));
  },
};
