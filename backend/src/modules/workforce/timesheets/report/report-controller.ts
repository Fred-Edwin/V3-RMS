import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { idParam } from '../periods/periods-validators';
import { periodReport } from './report-service';

export const reportController = {
  get: async (req: Request, res: Response): Promise<void> => {
    ok(res, await periodReport(subjectOf(req), idParam.parse(req.params).id));
  },
};
