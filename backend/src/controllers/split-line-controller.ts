import type { Request, Response } from 'express';
import { splitLineService } from '../services/split-line-service';
import { AddSplitLineSchema, routeIdParamSchema } from '../validators/order-schemas';
import { UnauthorizedError } from '../utils/errors';
import { z } from 'zod';

const lineIdParamSchema = z.object({
  id: z.string().uuid(),
  lineId: z.string().uuid(),
});

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const splitLineController = {
  addLine: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const data = AddSplitLineSchema.parse(req.body);
    const line = await splitLineService.addLine(id, data, actor);
    res.status(201).json({ success: true, data: line, message: 'Payment line added' });
  },

  getLines: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const lines = await splitLineService.getLines(id, actor);
    res.status(200).json({ success: true, data: lines });
  },

  removeLine: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, lineId } = lineIdParamSchema.parse(req.params);
    await splitLineService.removeLine(id, lineId, actor);
    res.status(200).json({ success: true, message: 'Payment line removed' });
  },
};
