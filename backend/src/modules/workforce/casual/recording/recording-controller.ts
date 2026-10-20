import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { addCorrection, removeCorrection } from './correction-service';
import { addCasual, putLines, sendSheet, takeBack } from './recording-service';
import { correctionBody, correctionParams, newCasualBody, putLinesBody, removeCorrectionBody, sendBody, sheetParams, takeBackBody } from './recording-validators';

export const recordingController = {
  addCasual: async (req: Request, res: Response): Promise<void> => ok(res, await addCasual(subjectOf(req), newCasualBody.parse(req.body)), 201),
  putLines: async (req: Request, res: Response): Promise<void> => ok(res, await putLines(subjectOf(req), putLinesBody.parse(req.body))),
  send: async (req: Request, res: Response): Promise<void> => ok(res, await sendSheet(subjectOf(req), sheetParams.parse(req.params).id, sendBody.parse(req.body))),
  takeBack: async (req: Request, res: Response): Promise<void> => ok(res, await takeBack(subjectOf(req), sheetParams.parse(req.params).id, takeBackBody.parse(req.body))),
  addCorrection: async (req: Request, res: Response): Promise<void> => ok(res, await addCorrection(subjectOf(req), sheetParams.parse(req.params).id, correctionBody.parse(req.body)), 201),
  removeCorrection: async (req: Request, res: Response): Promise<void> => {
    const p = correctionParams.parse(req.params);
    ok(res, await removeCorrection(subjectOf(req), p.id, p.correctionId, removeCorrectionBody.parse(req.body)));
  },
};
