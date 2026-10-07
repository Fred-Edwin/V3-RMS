import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { itemsService } from './items-service';
import { stockItemsQuerySchema } from './items-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const itemsController = {
  /** S2 */
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await itemsService.list(actor, stockItemsQuerySchema.parse(req.query)) });
  },
};
