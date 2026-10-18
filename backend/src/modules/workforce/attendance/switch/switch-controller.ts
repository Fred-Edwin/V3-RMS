import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok, subjectOf } from '../../rota/rota-http';
import { gridScope } from '../../rota/rota-scope';
import { getSwitch, listSwitches, setSwitch } from './switch-service';

const getQuery = z.object({ siteId: z.string().uuid().optional() }).strict();
const setBody = z.object({ siteId: z.string().uuid(), enabled: z.boolean() }).strict();

export const switchController = {
  /** Anyone who reads the Today board may see whether the new clock is on for their branch. */
  get: async (req: Request, res: Response): Promise<void> => {
    const subject = subjectOf(req);
    ok(res, await getSwitch(gridScope(subject, 'today.read', getQuery.parse(req.query).siteId).siteId));
  },
  /** Every site in the caller's reach with its switch (S3). */
  list: async (req: Request, res: Response): Promise<void> => {
    ok(res, { sites: await listSwitches(subjectOf(req)) });
  },
  set: async (req: Request, res: Response): Promise<void> => {
    const body = setBody.parse(req.body);
    ok(res, await setSwitch(subjectOf(req), body.siteId, body.enabled));
  },
};
