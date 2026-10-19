import type { Request, Response } from 'express';
import { nairobiToday, parseNairobiDate } from '../../_shared/time/nairobi-time';
import { buildAccessTable } from '../access/access-table';
import { getEffective } from '../resolve/effective-service';
import { groupOf, ok, subjectOf } from '../rules-http';
import { getRulesPage } from './page-service';
import { EffectiveQuerySchema, PageQuerySchema } from './page-validators';

export const pageController = {
  effective: async (req: Request, res: Response): Promise<void> => {
    const query = EffectiveQuerySchema.parse(req.query);
    const date = query.date ? parseNairobiDate(query.date) : nairobiToday(new Date());
    ok(res, await getEffective(subjectOf(req), query.siteId, date));
  },

  page: async (req: Request, res: Response): Promise<void> => {
    const query = PageQuerySchema.parse(req.query);
    ok(res, await getRulesPage(subjectOf(req), groupOf(req), query.siteId ?? null));
  },

  /** The "Who edits what" table, generated from the access table (D30). Any reader of Rules may see it. */
  accessTable: async (_req: Request, res: Response): Promise<void> => {
    ok(res, { rows: buildAccessTable() });
  },
};
