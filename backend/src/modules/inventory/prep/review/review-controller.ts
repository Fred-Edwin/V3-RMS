import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { reviewService } from './review-service';
import { exportQuerySchema, needsLookQuerySchema, reviewRunParamSchema } from './review-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const reviewController = {
  needsLook: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await reviewService.needsLook(actor, needsLookQuerySchema.parse(req.query)) });
  },

  count: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await reviewService.count(requireActor(req)) });
  },

  review: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = reviewRunParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await reviewService.review(actor, id), message: 'Run marked reviewed' });
  },

  exportCsv: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { fileName, csv } = await reviewService.exportCsv(actor, exportQuerySchema.parse(req.query));
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  },
};
