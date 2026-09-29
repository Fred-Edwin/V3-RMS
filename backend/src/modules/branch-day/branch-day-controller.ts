import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { branchDayService } from './branch-day-service';
import { AcceptOpeningSchema, BranchDayParamsSchema, HistoryQuerySchema, CloseDaySchema, DepartmentParamsSchema, ReopenDaySchema, SaveDepartmentLinesSchema } from './branch-day-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const branchDayController = {
  getOverview: async (req: Request, res: Response): Promise<void> => {
    const { id } = BranchDayParamsSchema.parse(req.params);
    const data = await branchDayService.getOverview(requireActor(req), id);
    res.status(200).json({ success: true, data });
  },

  getHistory: async (req: Request, res: Response): Promise<void> => {
    const data = await branchDayService.getHistory(requireActor(req), HistoryQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  getDetail: async (req: Request, res: Response): Promise<void> => {
    const { id } = BranchDayParamsSchema.parse(req.params);
    const data = await branchDayService.getDetail(requireActor(req), id);
    res.status(200).json({ success: true, data });
  },

  getOpening: async (req: Request, res: Response): Promise<void> => {
    const data = await branchDayService.getOpening(requireActor(req));
    res.status(200).json({ success: true, data });
  },

  acceptOpening: async (req: Request, res: Response): Promise<void> => {
    const data = await branchDayService.acceptOpening(requireActor(req), AcceptOpeningSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Opening accepted' });
  },

  getToday: async (req: Request, res: Response): Promise<void> => {
    const data = await branchDayService.getToday(requireActor(req));
    res.status(200).json({ success: true, data });
  },

  getDepartment: async (req: Request, res: Response): Promise<void> => {
    const { id, tag } = DepartmentParamsSchema.parse(req.params);
    const data = await branchDayService.getDepartment(requireActor(req), id, tag);
    res.status(200).json({ success: true, data });
  },

  saveLines: async (req: Request, res: Response): Promise<void> => {
    const { id, tag } = DepartmentParamsSchema.parse(req.params);
    const data = await branchDayService.saveLines(requireActor(req), id, tag, SaveDepartmentLinesSchema.parse(req.body));
    res.status(200).json({ success: true, data });
  },

  close: async (req: Request, res: Response): Promise<void> => {
    const { id } = BranchDayParamsSchema.parse(req.params);
    const data = await branchDayService.close(requireActor(req), id, CloseDaySchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Day closed' });
  },

  reopen: async (req: Request, res: Response): Promise<void> => {
    const { id } = BranchDayParamsSchema.parse(req.params);
    const data = await branchDayService.reopen(requireActor(req), id, ReopenDaySchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Day reopened' });
  },

  getDocument: async (req: Request, res: Response): Promise<void> => {
    const { id } = BranchDayParamsSchema.parse(req.params);
    const data = await branchDayService.getDocument(requireActor(req), id);
    res.status(200).json({ success: true, data });
  },
};
