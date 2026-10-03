import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { stockService } from './stock-service';
import { LedgerParamsSchema, LedgerQuerySchema, ListStockQuerySchema } from './stock-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const stockController = {
  listStock: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListStockQuerySchema.parse(req.query);
    const data = await stockService.listStock(actor, query);
    res.status(200).json({ success: true, data });
  },

  getSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = await stockService.getSummary(actor);
    res.status(200).json({ success: true, data });
  },

  getLedger: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { itemId } = LedgerParamsSchema.parse(req.params);
    const query = LedgerQuerySchema.parse(req.query);
    const data = await stockService.getLedger(actor, itemId, query);
    res.status(200).json({ success: true, data });
  },
};
