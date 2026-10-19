import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { decideRequest } from './request-decide-service';
import { createRequest, myRequests, requestDetail, requestInbox, withdrawRequest } from './requests-service';
import { createRequestBody, inboxQuery, myRequestsQuery, requestDecisionBody, requestParams } from './requests-validators';

export const requestsController = {
  create: async (req: Request, res: Response): Promise<void> => {
    ok(res, await createRequest(subjectOf(req), createRequestBody.parse(req.body)), 201);
  },
  withdraw: async (req: Request, res: Response): Promise<void> => {
    ok(res, await withdrawRequest(subjectOf(req), requestParams.parse(req.params).id));
  },
  mine: async (req: Request, res: Response): Promise<void> => {
    ok(res, await myRequests(subjectOf(req), myRequestsQuery.parse(req.query).state));
  },
  detail: async (req: Request, res: Response): Promise<void> => {
    ok(res, await requestDetail(subjectOf(req), requestParams.parse(req.params).id));
  },
  inbox: async (req: Request, res: Response): Promise<void> => {
    ok(res, await requestInbox(subjectOf(req), inboxQuery.parse(req.query)));
  },
  decide: async (req: Request, res: Response): Promise<void> => {
    ok(res, await decideRequest(subjectOf(req), requestParams.parse(req.params).id, requestDecisionBody.parse(req.body)));
  },
};
