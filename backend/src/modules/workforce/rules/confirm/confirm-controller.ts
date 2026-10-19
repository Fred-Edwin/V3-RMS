import type { Request, Response } from 'express';
import { ok, subjectOf } from '../rules-http';
import { VersionParamsSchema } from '../versions/versions-validators';
import { confirmVersion } from './confirm-service';
import { ConfirmBodySchema } from './confirm-validators';

export const confirmController = {
  confirm: async (req: Request, res: Response): Promise<void> => {
    const { id } = VersionParamsSchema.parse(req.params);
    const done = await confirmVersion(subjectOf(req), id, ConfirmBodySchema.parse(req.body ?? {}));
    ok(res, { version: done.version });
  },
};
