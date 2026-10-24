import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { personMonth, personTiles } from './time-tab-service';
import { timeMonthQuerySchema, timeTilesQuerySchema } from './time-tab-validators';

export const timeTabController = {
  month: async (req: Request, res: Response): Promise<void> => {
    ok(res, await personMonth(subjectOf(req), timeMonthQuerySchema.parse(req.query)));
  },
  tiles: async (req: Request, res: Response): Promise<void> => {
    ok(res, await personTiles(subjectOf(req), timeTilesQuerySchema.parse(req.query)));
  },
};
