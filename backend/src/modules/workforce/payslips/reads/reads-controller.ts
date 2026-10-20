import type { Request, Response } from 'express';
import { nairobiToday, parseNairobiDate } from '../../_shared/time/nairobi-time';
import { ok, subjectOf } from '../../rota/rota-http';
import { placeLabelOf } from '../../security';
import type { PayslipFile } from '../documents/document-service';
import { generateP9, myP9Document, myP9Status, confirmP9Format } from '../p9/p9-service';
import { DEVICE_HEADER } from '../unlock/unlock-middleware';
import { deviceLabelOf } from '../unlock/unlock-rules';
import { detail, documentOf, history, home, list, versionsOf, type Phone } from './reads-service';
import { documentAny, openAny, openingsOfDay } from './others-service';
import { confirmBody, dayQuery, detailQuery, documentQuery, historyQuery, idParams, p9PersonParams, phoneHeader, yearParams } from './reads-validators';

const phone = (req: Request): Phone => ({ id: phoneHeader.parse(req.header(DEVICE_HEADER)), label: deviceLabelOf(req.header('user-agent')), placeLabel: placeLabelOf((name) => req.header(name)) });
const label = (req: Request): string | null => deviceLabelOf(req.header('user-agent'));

/** The stored file, inline, never cached by anything between the server and the phone. */
const sendPdf = (res: Response, file: { bytes: Buffer; filename: string }): void => {
  res.status(200).set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${file.filename}"`, 'Cache-Control': 'private, no-store', 'Content-Length': String(file.bytes.length) }).send(file.bytes);
};

export const readsController = {
  list: async (req: Request, res: Response): Promise<void> => ok(res, await list(subjectOf(req))),
  home: async (req: Request, res: Response): Promise<void> => ok(res, await home(subjectOf(req))),
  history: async (req: Request, res: Response): Promise<void> => ok(res, await history(subjectOf(req), historyQuery.parse(req.query).year ?? null)),
  detail: async (req: Request, res: Response): Promise<void> => ok(res, await detail(subjectOf(req), idParams.parse(req.params).id, detailQuery.parse(req.query).v ?? null, phone(req))),
  versions: async (req: Request, res: Response): Promise<void> => ok(res, await versionsOf(subjectOf(req), idParams.parse(req.params).id)),
  document: async (req: Request, res: Response): Promise<void> => {
    const q = documentQuery.parse(req.query);
    const file: PayslipFile = await documentOf(subjectOf(req), idParams.parse(req.params).id, q.v ?? null, q.purpose, phone(req));
    sendPdf(res, file);
  },
  p9Status: async (req: Request, res: Response): Promise<void> => ok(res, await myP9Status(subjectOf(req), yearParams.parse(req.params).year)),
  p9Document: async (req: Request, res: Response): Promise<void> => sendPdf(res, await myP9Document(subjectOf(req), yearParams.parse(req.params).year, label(req))),

  // HR and the Accountant, from the Payroll page: no staff code, every opening audited (PD5)
  openAny: async (req: Request, res: Response): Promise<void> => ok(res, await openAny(subjectOf(req), idParams.parse(req.params).id, detailQuery.parse(req.query).v ?? null, label(req))),
  documentAny: async (req: Request, res: Response): Promise<void> => {
    const q = documentQuery.parse(req.query);
    sendPdf(res, await documentAny(subjectOf(req), idParams.parse(req.params).id, q.v ?? null, q.purpose, label(req)));
  },
  openings: async (req: Request, res: Response): Promise<void> => {
    const day = dayQuery.parse(req.query).day;
    ok(res, await openingsOfDay(subjectOf(req), day ? parseNairobiDate(day) : nairobiToday(new Date())));
  },
  p9Generate: async (req: Request, res: Response): Promise<void> => {
    const p = p9PersonParams.parse(req.params);
    sendPdf(res, await generateP9(subjectOf(req), p.year, p.employeeId, label(req)));
  },
  p9Confirm: async (req: Request, res: Response): Promise<void> => ok(res, await confirmP9Format(subjectOf(req), confirmBody.parse(req.body).pin)),
};
