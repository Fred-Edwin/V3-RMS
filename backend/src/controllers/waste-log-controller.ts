import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { wasteLogService } from '../services/waste-log-service';
import {
  CreateWasteLogSchema,
  WasteLogIdParamSchema,
  WasteLogListQuerySchema,
} from '../validators/waste-log-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const wasteLogController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { locationId, reason } = WasteLogListQuerySchema.parse(req.query);
    const entries = await wasteLogService.list(actor, { locationId, reason });
    res.status(200).json({ success: true, data: entries });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = WasteLogIdParamSchema.parse(req.params);
    const entry = await wasteLogService.getById(actor, id);
    res.status(200).json({ success: true, data: entry });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateWasteLogSchema.parse(req.body);
    const entry = await wasteLogService.create(actor, data);
    res.status(201).json({ success: true, data: entry, message: 'Waste logged successfully' });
  },
};
