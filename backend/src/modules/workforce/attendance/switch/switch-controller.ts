import type { Request, Response } from 'express';
import { z } from 'zod';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { ok, subjectOf } from '../../rota/rota-http';
import { gridScope } from '../../rota/rota-scope';
import { getSwitch, listSwitches, setSwitch } from './switch-service';

const getQuery = z.object({ siteId: z.string().uuid().optional() }).strict();
/** Switching a branch on or off is a signed act: the caller's own PIN goes through the shared PIN door (pauses after wrong tries, never a lockout). */
const setBody = z.object({ siteId: z.string().uuid(), enabled: z.boolean(), pin: z.string().regex(/^\d{4}$/, 'The PIN is 4 digits') }).strict();

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
    const subject = subjectOf(req);
    await verifySignerPin(subject.id, body.pin);
    ok(res, await setSwitch(subject, body.siteId, body.enabled));
  },
};
