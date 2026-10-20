import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok, subjectOf } from '../rota/rota-http';
import { alertCounts, clearAlert, listAlerts, startAlerts } from './alerts/alerts-service';
import { phoneLabelOf, placeLabelOf } from './devices/device-label';
import { answerCurrentPhone, confirmPhone, listPhones, phoneSeen, removePhone } from './devices/devices-service';
import { resetPassword, resetPasswordSchema, securityState } from './session/reset-service';
import { wasntMe } from './session/wasnt-me-service';
import { alertsQuery, answerBody, clearBody, idParam, seenBody, wasntMeBody } from './security-validators';

const headerDevice = (req: Request): string | null => {
  const parsed = z.string().regex(/^[A-Za-z0-9._-]{8,64}$/).safeParse(req.header('x-device-id'));
  return parsed.success ? parsed.data : null;
};
const labelsOf = (req: Request) => ({ deviceLabel: phoneLabelOf(req.header('user-agent')), placeLabel: placeLabelOf((name) => req.header(name)) });

export const securityController = {
  phones: async (req: Request, res: Response): Promise<void> => ok(res, await listPhones(subjectOf(req), headerDevice(req))),
  seen: async (req: Request, res: Response): Promise<void> => {
    const { deviceLabel, placeLabel } = labelsOf(req);
    ok(res, await phoneSeen(subjectOf(req), { deviceId: seenBody.parse(req.body).deviceId, label: deviceLabel, placeLabel }));
  },
  answer: async (req: Request, res: Response): Promise<void> => {
    const body = answerBody.parse(req.body);
    ok(res, await answerCurrentPhone(subjectOf(req), body.deviceId, body.answer));
  },
  confirm: async (req: Request, res: Response): Promise<void> => ok(res, await confirmPhone(subjectOf(req), idParam.parse(req.params).id, headerDevice(req))),
  remove: async (req: Request, res: Response): Promise<void> => ok(res, await removePhone(subjectOf(req), idParam.parse(req.params).id, headerDevice(req))),

  alerts: async (req: Request, res: Response): Promise<void> => ok(res, await listAlerts(subjectOf(req), alertsQuery.parse(req.query))),
  counts: async (req: Request, res: Response): Promise<void> => ok(res, await alertCounts(subjectOf(req))),
  clear: async (req: Request, res: Response): Promise<void> => ok(res, await clearAlert(subjectOf(req), idParam.parse(req.params).id, clearBody.parse(req.body))),
  start: async (req: Request, res: Response): Promise<void> => ok(res, await startAlerts(subjectOf(req))),

  wasntMe: async (req: Request, res: Response): Promise<void> => ok(res, await wasntMe(subjectOf(req), wasntMeBody.parse(req.body), labelsOf(req))),
  reset: async (req: Request, res: Response): Promise<void> => ok(res, await resetPassword(subjectOf(req), resetPasswordSchema.parse(req.body))),
  state: async (req: Request, res: Response): Promise<void> => ok(res, await securityState(subjectOf(req))),
};
