import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { applyFix, previewFix } from './fixes-service';
import { dayQuerySchema, fixSchema } from './fixes-validators';
import { dayHistory } from './history-service';

export const fixesController = {
  day: async (req: Request, res: Response): Promise<void> => {
    ok(res, await dayHistory(subjectOf(req), dayQuerySchema.parse(req.query)));
  },
  preview: async (req: Request, res: Response): Promise<void> => {
    ok(res, await previewFix(subjectOf(req), fixSchema.parse(req.body)));
  },
  apply: async (req: Request, res: Response): Promise<void> => {
    ok(res, await applyFix(subjectOf(req), fixSchema.parse(req.body)), 201);
  },
};
