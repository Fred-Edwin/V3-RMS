import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { settingsService } from './settings-service';
import { settingsPreviewQuerySchema, updateDirectorAlertInputSchema, updateSettingsInputSchema } from './settings-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const settingsController = {
  get: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await settingsService.get(requireActor(req)) });
  },

  preview: async (req: Request, res: Response): Promise<void> => {
    const query = settingsPreviewQuerySchema.parse(req.query);
    res.status(200).json({ success: true, data: await settingsService.preview(requireActor(req), query) });
  },

  updateRange: async (req: Request, res: Response): Promise<void> => {
    const data = await settingsService.updateRange(requireActor(req), updateSettingsInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Count settings saved' });
  },

  updateDirectorAlert: async (req: Request, res: Response): Promise<void> => {
    const data = await settingsService.updateDirectorAlert(requireActor(req), updateDirectorAlertInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Director alert amount saved' });
  },
};
