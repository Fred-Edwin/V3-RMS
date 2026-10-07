import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { overviewService } from './overview-service';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const overviewController = {
  /** S1 */
  get: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await overviewService.get(actor) });
  },
};
