import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { logService } from './log-service';
import { logWasteInputSchema, wasteItemsQuerySchema } from './log-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const logController = {
  /** W1 */
  listItems: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = await logService.listItems(actor, wasteItemsQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  /** W2: 201 for a new batch, 200 when the same key was sent before. */
  log: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { result, replayed } = await logService.log(actor, logWasteInputSchema.parse(req.body));
    res.status(replayed ? 200 : 201).json({ success: true, data: result, ...(replayed ? {} : { message: 'Waste logged' }) });
  },
};
