import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { recordService } from './record-service';
import { checkRequestSchema, recordRequestSchema } from './record-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const recordController = {
  outputs: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await recordService.outputs(requireActor(req)) });
  },

  prepAgain: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await recordService.prepAgain(requireActor(req)) });
  },

  check: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await recordService.check(actor, checkRequestSchema.parse(req.body)) });
  },

  record: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { run, replayed } = await recordService.record(actor, recordRequestSchema.parse(req.body));
    res.status(replayed ? 200 : 201).json({ success: true, data: run, ...(replayed ? { replayed: true } : { message: 'Prep run recorded' }) });
  },
};
