import type { Request, Response } from 'express';
import { ok, subjectOf } from '../rota/rota-http';
import { notificationInboxService as inbox } from './notification-inbox-service';
import { listQuery, readBody } from './notification-validators';

export const notificationController = {
  list: async (req: Request, res: Response): Promise<void> => ok(res, await inbox.list(subjectOf(req).id, listQuery.parse(req.query))),
  unreadCount: async (req: Request, res: Response): Promise<void> => ok(res, await inbox.unreadCount(subjectOf(req).id)),
  read: async (req: Request, res: Response): Promise<void> => ok(res, await inbox.markRead(subjectOf(req).id, readBody.parse(req.body).ids)),
  readAll: async (req: Request, res: Response): Promise<void> => ok(res, await inbox.markAllRead(subjectOf(req).id)),
};
