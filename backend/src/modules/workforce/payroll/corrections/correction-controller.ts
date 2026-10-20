import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok, subjectOf } from '../../rota/rota-http';
import { correctBody, payslipParams, previewBody } from './correction-validators';
import { correctPayslip, correctionInputs, previewCorrection } from './correction-service';

const versionQuery = z.object({ version: z.coerce.number().int().min(1) }).strict();

export const correctionController = {
  inputs: async (req: Request, res: Response): Promise<void> => {
    const p = payslipParams.parse(req.params);
    ok(res, await correctionInputs(subjectOf(req), p.monthKey, p.payslipId, versionQuery.parse(req.query).version));
  },
  preview: async (req: Request, res: Response): Promise<void> => {
    const p = payslipParams.parse(req.params);
    ok(res, await previewCorrection(subjectOf(req), p.monthKey, p.payslipId, previewBody.parse(req.body)));
  },
  correct: async (req: Request, res: Response): Promise<void> => {
    const p = payslipParams.parse(req.params);
    ok(res, await correctPayslip(subjectOf(req), p.monthKey, p.payslipId, correctBody.parse(req.body)));
  },
};
