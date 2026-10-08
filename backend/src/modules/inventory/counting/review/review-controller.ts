import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { reviewService } from './review-service';
import { approveInputSchema, countDetailParamsSchema, decisionInputSchema, seenInputSchema } from './review-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const reviewController = {
  decide: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    const data = await reviewService.decide(requireActor(req), id, decisionInputSchema.parse(req.body));
    res.status(200).json({ success: true, data });
  },

  approvePreview: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await reviewService.approvePreview(requireActor(req), id) });
  },

  approve: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    const { detail, replayed } = await reviewService.approve(requireActor(req), id, approveInputSchema.parse(req.body));
    res.status(200).json({ success: true, data: detail, ...(replayed ? { replayed: true } : { message: 'Count approved' }) });
  },

  markSeen: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await reviewService.markSeen(requireActor(req), seenInputSchema.parse(req.body)) });
  },
};
