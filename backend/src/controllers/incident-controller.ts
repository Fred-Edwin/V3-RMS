import type { Request, Response } from 'express';
import { incidentService } from '../services/incident-service';
import { IncidentQuerySchema } from '../validators/incident-schemas';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export const incidentController = {
  getIncidents: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!req.user.organizationId) {
      throw new ForbiddenError('Branch context required');
    }

    const query = IncidentQuerySchema.parse(req.query);
    const result = await incidentService.getMany(req.user.organizationId, query);

    res.status(200).json({
      success: true,
      data: result.incidents,
      pagination: result.pagination,
    });
  },
};
