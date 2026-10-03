import type { Request, Response } from 'express';
import { incidentService } from '../services/incident-service';
import { IncidentQuerySchema } from '../validators/incident-schemas';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export const incidentController = {
  getIncidents: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const isDirector = req.user.role === 'DIRECTOR';

    // Directors may query across all branches (organizationId = null) or filter by branchId
    if (!isDirector && !req.user.siteId) {
      throw new ForbiddenError('Branch context required');
    }

    const query = IncidentQuerySchema.parse(req.query);
    const siteId = isDirector ? null : (req.user.siteId ?? null);
    const result = await incidentService.getMany(siteId, query);

    res.status(200).json({
      success: true,
      data: result.incidents,
      pagination: result.pagination,
    });
  },
};
