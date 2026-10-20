import type { Request, Response } from 'express';
import { deviceLabel, ok, subjectOf } from '../_shared/conduct-http';
import { idParams, appealBody, decisionBody, decisionPreviewBody } from '../notices/notices-validators';
import { appealNotice } from './appeal-service';
import { decideNotice, previewDecision } from './decision-service';

export const appealsController = {
  appeal: async (req: Request, res: Response): Promise<void> => ok(res, await appealNotice(subjectOf(req), idParams.parse(req.params).id, appealBody.parse(req.body), deviceLabel(req))),
  decision: async (req: Request, res: Response): Promise<void> => ok(res, await decideNotice(subjectOf(req), idParams.parse(req.params).id, decisionBody.parse(req.body), deviceLabel(req))),
  preview: async (req: Request, res: Response): Promise<void> => ok(res, await previewDecision(subjectOf(req), idParams.parse(req.params).id, decisionPreviewBody.parse(req.body).outcome)),
};
