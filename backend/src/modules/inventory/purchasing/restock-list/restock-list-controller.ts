import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { restockListService } from './restock-list-service';
import { RestockLinesSchema, RestockSendSchema } from './restock-list-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const restockListController = {
  review: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await restockListService.review(requireActor(req), RestockLinesSchema.parse(req.body)) });
  },

  send: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await restockListService.send(requireActor(req), RestockSendSchema.parse(req.body)) });
  },
};
