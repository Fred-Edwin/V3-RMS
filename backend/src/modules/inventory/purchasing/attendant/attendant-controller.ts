import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { attendantService } from './attendant-service';
import { HistoryQuerySchema, IdParamSchema, MarkReadSchema, MyOrdersQuerySchema, NoticesQuerySchema, RestockLevelsQuerySchema, SearchQuerySchema } from './attendant-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const attendantController = {
  getHome: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await attendantService.getHome(requireActor(req)) });
  },

  getBadges: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await attendantService.getBadges(requireActor(req)) });
  },

  getMyOrders: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await attendantService.getMyOrders(requireActor(req), MyOrdersQuerySchema.parse(req.query)) });
  },

  getHistory: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await attendantService.getHistory(requireActor(req), HistoryQuerySchema.parse(req.query)) });
  },

  search: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await attendantService.search(requireActor(req), SearchQuerySchema.parse(req.query).q) });
  },

  getSupplier: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await attendantService.getSupplier(requireActor(req), IdParamSchema.parse(req.params).id) });
  },

  getRestockLevels: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await attendantService.getRestockLevels(requireActor(req), RestockLevelsQuerySchema.parse(req.query)) });
  },

  getNotices: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await attendantService.getNotices(requireActor(req), NoticesQuerySchema.parse(req.query)) });
  },

  markNoticesRead: async (req: Request, res: Response): Promise<void> => {
    await attendantService.markNoticesRead(requireActor(req), MarkReadSchema.parse(req.body).keys);
    res.status(204).send();
  },

  markAllNoticesRead: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: { marked: await attendantService.markAllNoticesRead(requireActor(req)) } });
  },
};
