import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { entriesService } from './entries-service';
import { wasteListQuerySchema } from './entries-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const entriesController = {
  /** W3 */
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = await entriesService.list(actor, wasteListQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },
};
