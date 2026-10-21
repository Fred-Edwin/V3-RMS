import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { teamService } from './team-service';
import { TeamQuerySchema } from './team-validators';

export const teamController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const subject = req.workforceSubject ?? req.user;
    if (!subject) throw new UnauthorizedError('Authentication required');
    const page = await teamService.list(subject, TeamQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data: page.data, pagination: page.pagination, counts: page.counts });
  },
};
