import type { Request, Response } from 'express';
import { NotFoundError, UnauthorizedError } from '../../../utils/errors';
import { nairobiToday, parseNairobiDate } from '../_shared/time/nairobi-time';
import { rulesService } from './rules-service';
import { EffectiveQuerySchema, VersionsParamsSchema, VersionsQuerySchema } from './rules-validators';

export const rulesController = {
  effective: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = EffectiveQuerySchema.parse(req.query);
    const date = query.date ? parseNairobiDate(query.date) : nairobiToday(new Date());
    const data = await rulesService.getEffective(req.user, query.siteId, date);
    res.status(200).json({ success: true, data });
  },

  versions: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const params = VersionsParamsSchema.safeParse(req.params);
    if (!params.success) throw new NotFoundError('Unknown rule group');
    const query = VersionsQuerySchema.parse(req.query);
    const data = await rulesService.listVersions(req.user, params.data.group, query.siteId ?? null);
    res.status(200).json({ success: true, data });
  },
};
