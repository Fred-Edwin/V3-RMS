import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { todayBoard } from './board-service';
import { boardQuerySchema, clockForSchema } from './board-validators';
import { clockForSomeone } from './clock-for-service';

export const boardController = {
  board: async (req: Request, res: Response): Promise<void> => {
    ok(res, await todayBoard(subjectOf(req), boardQuerySchema.parse(req.query)));
  },
  clockFor: async (req: Request, res: Response): Promise<void> => {
    ok(res, await clockForSomeone(subjectOf(req), clockForSchema.parse(req.body)), 201);
  },
};
