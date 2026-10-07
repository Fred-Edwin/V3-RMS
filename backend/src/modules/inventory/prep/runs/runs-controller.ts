import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { runsService } from './runs-service';
import { runIdParamSchema, runsQuerySchema } from './runs-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const runsController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await runsService.list(actor, runsQuerySchema.parse(req.query)) });
  },

  get: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = runIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await runsService.get(actor, id) });
  },
};
