import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok, subjectOf } from '../../rota/rota-http';
import { readEstimate } from '../estimate/estimate-service';
import { payslipDetail, listPayslips, payslipsQuery } from '../reads/payslips-service';
import { casualPay, rulesApplied, taxAndDeductions, totals } from '../reads/tabs-service';
import { monthParams } from '../review/review-validators';
import { getMonth, listMonths } from './months-service';

const monthsQuery = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1), rows: z.coerce.number().int().min(1).max(50).default(5) }).strict();
const payslipParams = monthParams.extend({ payslipId: z.string().uuid() }).strict();

export const monthsController = {
  list: async (req: Request, res: Response): Promise<void> => ok(res, await listMonths(subjectOf(req), monthsQuery.parse(req.query))),
  get: async (req: Request, res: Response): Promise<void> => ok(res, await getMonth(subjectOf(req), monthParams.parse(req.params).monthKey)),
  rulesApplied: async (req: Request, res: Response): Promise<void> => ok(res, await rulesApplied(subjectOf(req), monthParams.parse(req.params).monthKey)),
  tax: async (req: Request, res: Response): Promise<void> => ok(res, await taxAndDeductions(subjectOf(req), monthParams.parse(req.params).monthKey)),
  casual: async (req: Request, res: Response): Promise<void> => ok(res, await casualPay(subjectOf(req), monthParams.parse(req.params).monthKey)),
  totals: async (req: Request, res: Response): Promise<void> => ok(res, await totals(subjectOf(req), monthParams.parse(req.params).monthKey)),
  estimate: async (req: Request, res: Response): Promise<void> => ok(res, await readEstimate(subjectOf(req), monthParams.parse(req.params).monthKey)),
  payslips: async (req: Request, res: Response): Promise<void> => ok(res, await listPayslips(subjectOf(req), monthParams.parse(req.params).monthKey, payslipsQuery.parse(req.query))),
  payslip: async (req: Request, res: Response): Promise<void> => {
    const { monthKey, payslipId } = payslipParams.parse(req.params);
    ok(res, await payslipDetail(subjectOf(req), monthKey, payslipId));
  },
};
