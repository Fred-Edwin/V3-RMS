import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { branchDayService } from './branch-day-service';
import { BranchDayParamsSchema, CloseDaySchema, DepartmentParamsSchema, ReopenDaySchema, SaveDepartmentLinesSchema } from './branch-day-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const branchDayController = {
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
