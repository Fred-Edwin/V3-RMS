import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { overtimeDetail } from './overtime-detail-service';
import { noteOvertime } from './overtime-note-service';
import { decideOvertime, listOvertime } from './overtime-service';
import { overtimeDecisionBody, overtimeListQuery, overtimeNoteBody, overtimeParams } from './overtime-validators';

export const overtimeController = {
  list: async (req: Request, res: Response): Promise<void> => {
    ok(res, await listOvertime(subjectOf(req), overtimeListQuery.parse(req.query)));
  },
  detail: async (req: Request, res: Response): Promise<void> => {
    ok(res, await overtimeDetail(subjectOf(req), overtimeParams.parse(req.params).id));
  },
  decide: async (req: Request, res: Response): Promise<void> => {
    ok(res, await decideOvertime(subjectOf(req), overtimeParams.parse(req.params).id, overtimeDecisionBody.parse(req.body)));
  },
  note: async (req: Request, res: Response): Promise<void> => {
    ok(res, await noteOvertime(subjectOf(req), overtimeParams.parse(req.params).id, overtimeNoteBody.parse(req.body)));
  },
};
