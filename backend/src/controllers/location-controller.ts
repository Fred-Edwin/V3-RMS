import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { locationService } from '../services/location-service';
import { LocationIdParamSchema } from '../validators/location-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const locationController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const locations = await locationService.list(actor);
    res.status(200).json({ success: true, data: locations });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = LocationIdParamSchema.parse(req.params);
    const location = await locationService.getById(actor, id);
    res.status(200).json({ success: true, data: location });
  },
};
