import type { Request, Response } from 'express';
import { deviceLabel, ok, subjectOf } from '../_shared/conduct-http';
import { conductBadge } from '../needs-you/badge-service';
import { noticeDetail } from './detail-service';
import { draftFor, searchPeople, witnessOptions } from './draft-service';
import { fileTab } from './file-service';
import { issueNotice } from './issue-service';
import { listNotices } from './list-service';
import { myNotices } from './me-service';
import { recordNotSigned } from './not-signed-service';
import { draftQuery, idParams, issueBody, listQuery, notSignedBody, peopleQuery, signBody, witnessBody, witnessQuery } from './notices-validators';
import { signNotice } from './sign-service';
import { answerWitness, witnessCard } from './witness-service';

export const noticesController = {
  me: async (req: Request, res: Response): Promise<void> => ok(res, await myNotices(subjectOf(req))),
  badge: async (req: Request, res: Response): Promise<void> => ok(res, await conductBadge(subjectOf(req))),
  list: async (req: Request, res: Response): Promise<void> => ok(res, await listNotices(subjectOf(req), listQuery.parse(req.query))),
  people: async (req: Request, res: Response): Promise<void> => ok(res, await searchPeople(subjectOf(req), peopleQuery.parse(req.query).q)),
  draft: async (req: Request, res: Response): Promise<void> => ok(res, await draftFor(subjectOf(req), draftQuery.parse(req.query))),
  issue: async (req: Request, res: Response): Promise<void> => ok(res, await issueNotice(subjectOf(req), issueBody.parse(req.body), deviceLabel(req)), 201),
  detail: async (req: Request, res: Response): Promise<void> => ok(res, await noticeDetail(subjectOf(req), idParams.parse(req.params).id)),
  sign: async (req: Request, res: Response): Promise<void> => ok(res, await signNotice(subjectOf(req), idParams.parse(req.params).id, signBody.parse(req.body), deviceLabel(req))),
  notSigned: async (req: Request, res: Response): Promise<void> => ok(res, await recordNotSigned(subjectOf(req), idParams.parse(req.params).id, notSignedBody.parse(req.body), deviceLabel(req))),
  witnessOptions: async (req: Request, res: Response): Promise<void> => {
    const { id } = idParams.parse(req.params);
    ok(res, await witnessOptions(subjectOf(req), id, witnessQuery.parse({ ...req.query, noticeId: id }).q));
  },
  witnessCard: async (req: Request, res: Response): Promise<void> => ok(res, await witnessCard(subjectOf(req), idParams.parse(req.params).id)),
  witness: async (req: Request, res: Response): Promise<void> => ok(res, await answerWitness(subjectOf(req), idParams.parse(req.params).id, witnessBody.parse(req.body), deviceLabel(req))),
  file: async (req: Request, res: Response): Promise<void> => ok(res, await fileTab(subjectOf(req), idParams.parse(req.params).id)),
};
