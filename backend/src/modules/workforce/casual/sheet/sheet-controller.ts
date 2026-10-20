import type { Request, Response } from 'express';
import { z } from 'zod';
import { ForbiddenError } from '../../../../utils/errors';
import { workforceCan } from '../../_shared/workforce-access';
import { ok, subjectOf } from '../../rota/rota-http';
import { resolveActor } from '../../people/people-context';
import { recentQuery, sheetParams, sheetQuery, workersQuery } from '../recording/recording-validators';
import { documentPdf, previewPdf } from './sheet-document-service';
import { getById, getDay, listRecent, listWorkers, monthSummary, waiting } from './sheet-service';

const monthParams = z.object({ monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a month like 2026-09') }).strict();

const sendPdf = (res: Response, bytes: Buffer, filename: string): void => {
  res.status(200).set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': 'private, no-store', 'Content-Length': String(bytes.length) }).send(bytes);
};

export const sheetController = {
  day: async (req: Request, res: Response): Promise<void> => ok(res, await getDay(subjectOf(req), sheetQuery.parse(req.query))),
  byId: async (req: Request, res: Response): Promise<void> => ok(res, await getById(subjectOf(req), sheetParams.parse(req.params).id)),
  workers: async (req: Request, res: Response): Promise<void> => ok(res, await listWorkers(subjectOf(req), workersQuery.parse(req.query))),
  recent: async (req: Request, res: Response): Promise<void> => ok(res, await listRecent(subjectOf(req), recentQuery.parse(req.query))),
  waiting: async (req: Request, res: Response): Promise<void> => ok(res, await waiting(subjectOf(req))),
  preview: async (req: Request, res: Response): Promise<void> => sendPdf(res, await previewPdf(subjectOf(req), sheetParams.parse(req.params).id), 'CPS-draft.pdf'),
  document: async (req: Request, res: Response): Promise<void> => {
    const { bytes, number } = await documentPdf(subjectOf(req), sheetParams.parse(req.params).id);
    sendPdf(res, bytes, `${number}.pdf`);
  },
  /** Payroll's Casual pay tab (PD27): the approved sheets of a month, outside gross, net and the bank file. */
  monthSummary: async (req: Request, res: Response): Promise<void> => {
    const subject = subjectOf(req);
    if (!workforceCan(subject, 'payroll.read')) throw new ForbiddenError('You do not have permission to perform this action');
    ok(res, await monthSummary((await resolveActor(subject)).companyId, monthParams.parse(req.params).monthKey));
  },
};
