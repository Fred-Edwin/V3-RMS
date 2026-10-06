import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { needsRestockingService } from './needs-restocking-service';
import { CatalogQuerySchema, NeedsQuerySchema } from './needs-restocking-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const needsRestockingController = {
  getNeeds: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await needsRestockingService.getNeeds(actor, NeedsQuerySchema.parse(req.query)) });
  },

  getCatalog: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await needsRestockingService.getCatalog(actor, CatalogQuerySchema.parse(req.query)) });
  },
};
