import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { countService } from './count-service';
import {
  ApproveCountSchema,
  CountLineParamsSchema,
  CountParamsSchema,
  DecideLineSchema,
  ListCountsQuerySchema,
  ReturnCountSchema,
  SaveCountLinesSchema,
  SpotCountSchema,
  SubmitCountSchema,
} from './count-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const countController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const data = await countService.list(requireActor(req), ListCountsQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  getToday: async (req: Request, res: Response): Promise<void> => {
    const data = await countService.getToday(requireActor(req));
    res.status(200).json({ success: true, data });
  },

  /** Role-split: the attendant gets the blind projection, the Store Manager the full view. */
  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = CountParamsSchema.parse(req.params);
    const data =
      actor.role === 'STORE_ATTENDANT'
        ? await countService.getForAttendant(actor, id)
        : await countService.getForVerifier(actor, id);
    res.status(200).json({ success: true, data });
  },

  saveLines: async (req: Request, res: Response): Promise<void> => {
    const { id } = CountParamsSchema.parse(req.params);
    const data = await countService.saveLines(requireActor(req), id, SaveCountLinesSchema.parse(req.body));
    res.status(200).json({ success: true, data });
  },

  submit: async (req: Request, res: Response): Promise<void> => {
    const { id } = CountParamsSchema.parse(req.params);
    const { pin } = SubmitCountSchema.parse(req.body);
    const data = await countService.submit(requireActor(req), id, pin);
    res.status(200).json({ success: true, data, message: 'Count submitted' });
  },

  decideLine: async (req: Request, res: Response): Promise<void> => {
    const { id, lineId } = CountLineParamsSchema.parse(req.params);
    const data = await countService.decideLine(requireActor(req), id, lineId, DecideLineSchema.parse(req.body));
    res.status(200).json({ success: true, data });
  },

  returnCount: async (req: Request, res: Response): Promise<void> => {
    const { id } = CountParamsSchema.parse(req.params);
    const { note } = ReturnCountSchema.parse(req.body);
    const data = await countService.returnCount(requireActor(req), id, note);
    res.status(200).json({ success: true, data, message: 'Count sent back' });
  },

  approve: async (req: Request, res: Response): Promise<void> => {
    const { id } = CountParamsSchema.parse(req.params);
    const { pin } = ApproveCountSchema.parse(req.body);
    const data = await countService.approve(requireActor(req), id, pin);
    res.status(200).json({ success: true, data, message: 'Count verified' });
  },

  createSpotCount: async (req: Request, res: Response): Promise<void> => {
    const data = await countService.createSpotCount(requireActor(req), SpotCountSchema.parse(req.body));
    res.status(201).json({ success: true, data, message: 'Spot count saved' });
  },

  print: async (req: Request, res: Response): Promise<void> => {
    const { id } = CountParamsSchema.parse(req.params);
    const data = await countService.print(requireActor(req), id);
    res.status(200).json({ success: true, data });
  },
};
