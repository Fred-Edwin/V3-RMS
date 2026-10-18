import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { latenessReport } from './lateness-service';
import { latenessQuerySchema } from './lateness-validators';

export const latenessController = {
  report: async (req: Request, res: Response): Promise<void> => {
    ok(res, await latenessReport(subjectOf(req), latenessQuerySchema.parse(req.query)));
  },
};
