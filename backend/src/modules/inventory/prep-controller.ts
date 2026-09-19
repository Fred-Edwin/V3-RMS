import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { prepService } from './prep-service';
import { IdParamSchema } from './inventory-validators';
import {
  CreatePrepRunSchema,
  ListPrepRunsQuerySchema,
  PrepSummaryQuerySchema,
} from './prep-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const prepController = {
  listPrepRuns: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListPrepRunsQuerySchema.parse(req.query);
    const data = await prepService.listPrepRuns(actor, query);
    res.status(200).json({ success: true, data });
  },

  getPrepRun: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await prepService.getPrepRun(actor, id);
    res.status(200).json({ success: true, data });
  },

  createPrepRun: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreatePrepRunSchema.parse(req.body);
    const data = await prepService.createPrepRun(actor, input);
    res.status(201).json({ success: true, data, message: 'Prep run recorded' });
  },

  getPrepSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = PrepSummaryQuerySchema.parse(req.query);
    const data = await prepService.getPrepSummary(actor, query);
    res.status(200).json({ success: true, data });
  },

  getTypicalYield: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await prepService.getTypicalYield(actor, id);
    res.status(200).json({ success: true, data });
  },
};
