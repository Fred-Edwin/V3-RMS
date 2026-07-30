import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { stockCountService } from '../services/stock-count-service';
import {
  CreateStockCountSchema,
  StockCountIdParamSchema,
  StockCountListQuerySchema,
  SubmitStockCountSchema,
} from '../validators/stock-count-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const stockCountController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { locationId, status } = StockCountListQuerySchema.parse(req.query);
    const counts = await stockCountService.list(actor, { locationId, status });
    res.status(200).json({ success: true, data: counts });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = StockCountIdParamSchema.parse(req.params);
    const count = await stockCountService.getById(actor, id);
    res.status(200).json({ success: true, data: count });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateStockCountSchema.parse(req.body);
    const count = await stockCountService.create(actor, data);
    res.status(201).json({ success: true, data: count, message: 'Stock count session created successfully' });
  },

  submit: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = StockCountIdParamSchema.parse(req.params);
    const data = SubmitStockCountSchema.parse(req.body);
    const count = await stockCountService.submitCounts(actor, id, data.lines);
    res.status(200).json({ success: true, data: count, message: 'Stock count submitted successfully' });
  },

  approve: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = StockCountIdParamSchema.parse(req.params);
    const count = await stockCountService.approve(actor, id);
    res.status(200).json({ success: true, data: count, message: 'Stock count approved successfully' });
  },

  correctLines: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = StockCountIdParamSchema.parse(req.params);
    const data = SubmitStockCountSchema.parse(req.body);
    const count = await stockCountService.correctLines(actor, id, data.lines);
    res.status(200).json({ success: true, data: count, message: 'Counted quantities updated' });
  },
};
