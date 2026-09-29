import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { thresholdsService } from './thresholds-service';
import { UpdateBranchThresholdsSchema, UpdateDirectorThresholdSchema, UpdateStoreThresholdsSchema } from './thresholds-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const thresholdsController = {
  get: async (req: Request, res: Response): Promise<void> => {
    const data = await thresholdsService.get(requireActor(req));
    res.status(200).json({ success: true, data });
  },

  /** The Zod schema is chosen by role: neither side can send the other's fields (strict → 400). */
  update: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data =
      actor.role === 'MANAGER'
        ? await thresholdsService.updateBranch(actor, UpdateBranchThresholdsSchema.parse(req.body))
        : await thresholdsService.updateStore(actor, UpdateStoreThresholdsSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Thresholds saved' });
  },

  updateDirector: async (req: Request, res: Response): Promise<void> => {
    const data = await thresholdsService.updateDirector(requireActor(req), UpdateDirectorThresholdSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Director alert amount saved' });
  },
};
