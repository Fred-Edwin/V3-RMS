import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { printService } from './print-service';
import { countDetailParamsSchema } from './print-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const printController = {
  record: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await printService.record(requireActor(req), id) });
  },
  blankSheet: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await printService.blankSheet(requireActor(req)) });
  },
};
