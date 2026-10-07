import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { fixService } from './fix-service';
import { cancelRequestSchema, correctRequestSchema, runIdParamSchema } from './fix-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const fixController = {
  correct: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = runIdParamSchema.parse(req.params);
    const { run, replayed } = await fixService.correct(actor, id, correctRequestSchema.parse(req.body));
    res.status(replayed ? 200 : 201).json({ success: true, data: run, ...(replayed ? { replayed: true } : { message: 'Prep run corrected' }) });
  },

  cancel: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = runIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await fixService.cancel(actor, id, cancelRequestSchema.parse(req.body)), message: 'Prep run cancelled' });
  },

  cancelPreview: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = runIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await fixService.cancelPreview(actor, id) });
  },
};
