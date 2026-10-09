import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { discrepanciesService } from './discrepancies-service';
import { discrepancyParamsSchema, findingPreviewQuerySchema, listDiscrepanciesQuerySchema, recordFindingInputSchema, reverseFindingInputSchema } from './discrepancies-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const discrepanciesController = {
  list: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await discrepanciesService.list(requireActor(req), listDiscrepanciesQuerySchema.parse(req.query)) });
  },

  getFile: async (req: Request, res: Response): Promise<void> => {
    const { id } = discrepancyParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await discrepanciesService.getFile(requireActor(req), id) });
  },

  findingPreview: async (req: Request, res: Response): Promise<void> => {
    const { id } = discrepancyParamsSchema.parse(req.params);
    const { finding } = findingPreviewQuerySchema.parse(req.query);
    res.status(200).json({ success: true, data: await discrepanciesService.findingPreview(requireActor(req), id, finding) });
  },

  recordFinding: async (req: Request, res: Response): Promise<void> => {
    const { id } = discrepancyParamsSchema.parse(req.params);
    const input = recordFindingInputSchema.parse(req.body);
    const data = await discrepanciesService.recordFinding(requireActor(req), id, input);
    res.status(data.replayed ? 200 : 201).json({ success: true, data });
  },

  reverse: async (req: Request, res: Response): Promise<void> => {
    const { id } = discrepancyParamsSchema.parse(req.params);
    const input = reverseFindingInputSchema.parse(req.body);
    res.status(200).json({ success: true, data: await discrepanciesService.reverse(requireActor(req), id, input) });
  },
};
