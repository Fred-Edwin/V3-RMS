import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { lock, setFirstCode, unlock } from './unlock-service';
import { deviceLabelOf } from './unlock-rules';
import { firstCodeBody, lockBody, unlockBody } from './unlock-validators';

const label = (req: Request): string | null => deviceLabelOf(req.header('user-agent'));

export const unlockController = {
  unlock: async (req: Request, res: Response): Promise<void> => ok(res, await unlock(subjectOf(req), unlockBody.parse(req.body), label(req))),
  setCode: async (req: Request, res: Response): Promise<void> => ok(res, await setFirstCode(subjectOf(req), firstCodeBody.parse(req.body), label(req)), 201),
  lock: async (req: Request, res: Response): Promise<void> => {
    await lock(subjectOf(req), lockBody.parse(req.body).deviceId);
    ok(res, { locked: true });
  },
};
