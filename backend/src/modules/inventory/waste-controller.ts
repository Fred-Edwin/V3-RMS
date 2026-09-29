import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { wasteService } from './waste-service';
import { CreateWasteSchema, ListWasteQuerySchema, WasteItemsQuerySchema } from './waste-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const wasteController = {
  createWaste: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateWasteSchema.parse(req.body);
    const data = await wasteService.createWaste(actor, input);
    res.status(201).json({ success: true, data, message: 'Waste logged' });
  },

  listWaste: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListWasteQuerySchema.parse(req.query);
    const data = await wasteService.listWaste(actor, query);
    res.status(200).json({ success: true, data });
  },

  listItemOptions: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = WasteItemsQuerySchema.parse(req.query);
    const data = await wasteService.listItemOptions(actor, query);
    res.status(200).json({ success: true, data });
  },
};
