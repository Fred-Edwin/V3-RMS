import type { Request, Response } from 'express';
import { ok, subjectOf } from '../rota/rota-http';
import { cancelLeave } from './applications/cancel-service';
import { approveLeave } from './applications/approve-service';
import { createAsk, previewAsk } from './applications/ask-service';
import { declineLeave } from './applications/decline-service';
import { adjustBalance, previewAdjust } from './balances/adjust-service';
import { balanceDrawer, balancesList } from './balances/balances-read-service';
import { awayBetween } from './reads/away-service';
import { leaveBadge, leaveNeedsYou } from './reads/badge-service';
import { leaveCalendar } from './reads/calendar-service';
import { applicationDetail } from './reads/detail-service';
import { myApplications, myOverview } from './reads/mine-service';
import { requestsList } from './reads/requests-service';
import { rotaPanel } from './reads/rota-panel-service';
import { slipOf, slipPdf } from './slip/slip-service';
import {
  adjustBody, adjustPreviewBody, approveBody, askBody, awayQuery, balancesQuery, calendarQuery, cancelBody, declineBody, employeeParams, idParams, idempotencyKeyOf,
  mineQuery, needsYouQuery, overviewQuery, previewBody, requestsQuery,
} from './leave-validators';

/** Thin: parse, call one service, answer. Rules live in the services. */
export const leaveController = {
  overview: async (req: Request, res: Response): Promise<void> => ok(res, await myOverview(subjectOf(req), overviewQuery.parse(req.query).year)),
  mine: async (req: Request, res: Response): Promise<void> => ok(res, await myApplications(subjectOf(req), mineQuery.parse(req.query))),
  detail: async (req: Request, res: Response): Promise<void> => ok(res, await applicationDetail(subjectOf(req), idParams.parse(req.params).id)),
  preview: async (req: Request, res: Response): Promise<void> => ok(res, await previewAsk(subjectOf(req), previewBody.parse(req.body))),
  ask: async (req: Request, res: Response): Promise<void> => {
    const result = await createAsk(subjectOf(req), askBody.parse(req.body), idempotencyKeyOf(req));
    ok(res, result, result.repeat ? 200 : 201);
  },
  cancel: async (req: Request, res: Response): Promise<void> => ok(res, await cancelLeave(subjectOf(req), idParams.parse(req.params).id, cancelBody.parse(req.body ?? {}), idempotencyKeyOf(req))),
  requests: async (req: Request, res: Response): Promise<void> => ok(res, await requestsList(subjectOf(req), requestsQuery.parse(req.query))),
  rota: async (req: Request, res: Response): Promise<void> => ok(res, await rotaPanel(subjectOf(req), idParams.parse(req.params).id)),
  approve: async (req: Request, res: Response): Promise<void> => ok(res, await approveLeave(subjectOf(req), idParams.parse(req.params).id, approveBody.parse(req.body), idempotencyKeyOf(req))),
  decline: async (req: Request, res: Response): Promise<void> => ok(res, await declineLeave(subjectOf(req), idParams.parse(req.params).id, declineBody.parse(req.body), idempotencyKeyOf(req))),
  balances: async (req: Request, res: Response): Promise<void> => ok(res, await balancesList(subjectOf(req), balancesQuery.parse(req.query))),
  drawer: async (req: Request, res: Response): Promise<void> => ok(res, await balanceDrawer(subjectOf(req), employeeParams.parse(req.params).employeeId, overviewQuery.parse(req.query).year)),
  adjustPreview: async (req: Request, res: Response): Promise<void> => ok(res, await previewAdjust(subjectOf(req), adjustPreviewBody.parse(req.body))),
  adjust: async (req: Request, res: Response): Promise<void> => {
    const result = await adjustBalance(subjectOf(req), adjustBody.parse(req.body), idempotencyKeyOf(req));
    ok(res, result, result.repeat ? 200 : 201);
  },
  calendar: async (req: Request, res: Response): Promise<void> => ok(res, await leaveCalendar(subjectOf(req), calendarQuery.parse(req.query))),
  slip: async (req: Request, res: Response): Promise<void> => ok(res, await slipOf(subjectOf(req), idParams.parse(req.params).id)),
  slipPdf: async (req: Request, res: Response): Promise<void> => {
    const { buffer, fileName } = await slipPdf(subjectOf(req), idParams.parse(req.params).id);
    res.status(200).set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'private, max-age=300' }).send(buffer);
  },
  badge: async (req: Request, res: Response): Promise<void> => ok(res, await leaveBadge(subjectOf(req))),
  needsYou: async (req: Request, res: Response): Promise<void> => ok(res, await leaveNeedsYou(subjectOf(req), needsYouQuery.parse(req.query).limit)),
  away: async (req: Request, res: Response): Promise<void> => ok(res, await awayBetween(subjectOf(req), awayQuery.parse(req.query))),
};
