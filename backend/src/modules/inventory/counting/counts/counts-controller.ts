import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { countsService } from './counts-service';
import { countDetailParamsSchema, countsListQuerySchema, countsSummaryQuerySchema, pagerQuerySchema } from './counts-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const countsController = {
  summary: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await countsService.summary(requireActor(req), countsSummaryQuerySchema.parse(req.query)) });
  },
  list: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await countsService.list(requireActor(req), countsListQuerySchema.parse(req.query)) });
  },
  flagged: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await countsService.flagged(requireActor(req), pagerQuerySchema.parse(req.query)) });
  },
  repeatShortfalls: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await countsService.repeatShortfalls(requireActor(req), pagerQuerySchema.parse(req.query)) });
  },
  detail: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await countsService.detail(requireActor(req), id) });
  },
};
