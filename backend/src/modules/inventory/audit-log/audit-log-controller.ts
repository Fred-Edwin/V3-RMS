import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { auditLogService } from './audit-log-service';
import { AuditLogQuerySchema } from './audit-log-validators';

export const auditLogController = {
  list: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = AuditLogQuerySchema.parse(req.query);
    const data = await auditLogService.list(req.user, query);
    res.status(200).json({ success: true, data });
  },
};
