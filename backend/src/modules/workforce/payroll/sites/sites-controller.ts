import type { Request, Response } from 'express';
import { z } from 'zod';
import { lateApproveBody, remindBody } from '../approval/approval-validators';
import { monthParams } from '../review/review-validators';
import { ok, subjectOf } from '../../rota/rota-http';
import { approveSiteLate, remindSite } from './sites-service';

const siteParams = monthParams.extend({ siteId: z.string().uuid() }).strict();

export const sitesController = {
  remind: async (req: Request, res: Response): Promise<void> => {
    const { monthKey, siteId } = siteParams.parse(req.params);
    ok(res, await remindSite(subjectOf(req), monthKey, siteId, remindBody.parse(req.body)));
  },
  approveLate: async (req: Request, res: Response): Promise<void> => {
    const { monthKey, siteId } = siteParams.parse(req.params);
    ok(res, await approveSiteLate(subjectOf(req), monthKey, siteId, lateApproveBody.parse(req.body)));
  },
};
