import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { approveMonth } from '../approval/approve-service';
import { approveBody } from '../approval/approval-validators';
import { exportMonth } from '../exports/exports-service';
import { exportBody } from '../exports/exports-validators';
import { getMonth, listMonths, listPeople } from './months-service';
import { monthParams, monthQuery, monthsQuery, peopleQuery, personDaysQuery, personParams, personQuery } from './months-validators';
import { personDays, personDrawer } from './person-month';

export const monthsController = {
  list: async (req: Request, res: Response): Promise<void> => {
    ok(res, await listMonths(subjectOf(req), monthsQuery.parse(req.query)));
  },
  get: async (req: Request, res: Response): Promise<void> => {
    ok(res, await getMonth(subjectOf(req), monthParams.parse(req.params).monthKey, monthQuery.parse(req.query)));
  },
  people: async (req: Request, res: Response): Promise<void> => {
    ok(res, await listPeople(subjectOf(req), monthParams.parse(req.params).monthKey, peopleQuery.parse(req.query)));
  },
  person: async (req: Request, res: Response): Promise<void> => {
    const { monthKey, employeeId } = personParams.parse(req.params);
    ok(res, await personDrawer(subjectOf(req), monthKey, employeeId, personQuery.parse(req.query)));
  },
  personDays: async (req: Request, res: Response): Promise<void> => {
    const { monthKey, employeeId } = personParams.parse(req.params);
    ok(res, await personDays(subjectOf(req), monthKey, employeeId, personDaysQuery.parse(req.query)));
  },
  approve: async (req: Request, res: Response): Promise<void> => {
    ok(res, await approveMonth(subjectOf(req), monthParams.parse(req.params).monthKey, approveBody.parse(req.body)));
  },
  /** The file itself: a PDF or an Excel workbook. The document number (if approved) also travels in a header. */
  export: async (req: Request, res: Response): Promise<void> => {
    const file = await exportMonth(subjectOf(req), monthParams.parse(req.params).monthKey, exportBody.parse(req.body));
    res.status(200);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Document-Number');
    if (file.documentNumber) res.setHeader('X-Document-Number', file.documentNumber);
    res.send(file.buffer);
  },
};
