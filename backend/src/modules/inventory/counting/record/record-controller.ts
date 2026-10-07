import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { recordService } from './record-service';
import {
  checkInputSchema,
  countDetailParamsSchema,
  saveLinesInputSchema,
  sectionOrderInputSchema,
  signInputSchema,
  startCountInputSchema,
  startOptionsQuerySchema,
} from './record-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const recordController = {
  startOptions: async (req: Request, res: Response): Promise<void> => {
    const data = await recordService.startOptions(requireActor(req), startOptionsQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  /** 201 for a new count; a repeated `idempotencyKey` returns the same count with 200. */
  start: async (req: Request, res: Response): Promise<void> => {
    const { detail, replayed } = await recordService.start(requireActor(req), startCountInputSchema.parse(req.body));
    res.status(replayed ? 200 : 201).json({ success: true, data: detail, ...(replayed ? { replayed: true } : { message: 'Count started' }) });
  },

  saveLines: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    const data = await recordService.saveLines(requireActor(req), id, saveLinesInputSchema.parse(req.body));
    res.status(200).json({ success: true, data });
  },

  check: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    const data = await recordService.check(requireActor(req), id, checkInputSchema.parse(req.body ?? {}));
    res.status(200).json({ success: true, data });
  },

  signPreview: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await recordService.signPreview(requireActor(req), id) });
  },

  sign: async (req: Request, res: Response): Promise<void> => {
    const { id } = countDetailParamsSchema.parse(req.params);
    const { detail, replayed } = await recordService.sign(requireActor(req), id, signInputSchema.parse(req.body));
    res.status(200).json({ success: true, data: detail, ...(replayed ? { replayed: true } : { message: 'Count signed' }) });
  },

  setSectionOrder: async (req: Request, res: Response): Promise<void> => {
    const data = await recordService.setSectionOrder(requireActor(req), sectionOrderInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Order for today saved' });
  },
};
