import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { phoneLabelOf } from '../security';
import { attachWorkforceSubject } from '../people/people-subject';
import { ok, subjectOf } from '../rota/rota-http';
import { checkDocument, checkSignedIn, noteFailedCheck, reportBody, reportMismatch, verifyParams, verifyQuery, type CheckerContext } from './verify-service';

const who = (req: Request): CheckerContext => ({ address: req.ip ?? 'unknown', deviceLabel: phoneLabelOf(req.header('user-agent')) });

/** PUBLIC: no authenticate. Never cached, never indexed; the answer is role and date only (owner decision O3). */
export const publicVerifyRouter = Router();
publicVerifyRouter.get('/verify/:kind/:number', async (req: Request, res: Response) => {
  const p = verifyParams.safeParse(req.params);
  const q = verifyQuery.safeParse(req.query);
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  const checked = await checkDocument(p.success ? p.data.kind : '', p.success ? p.data.number : '', q.success ? q.data.h : undefined, who(req));
  if (checked.recorded === 'HASH_MISMATCH' && checked.row) void noteFailedCheck(checked.row, new Date());
  res.status(checked.answer.outcome === 'RATE_LIMITED' ? 429 : 200).json({ success: true, data: checked.answer });
});

/** Signed in: adds the signer's name, the Open button and the "Tell the ..." report. */
export const workforceVerifyRouter = Router();
const signedIn = [authenticate, attachWorkforceSubject] as const;
workforceVerifyRouter.get('/workforce/documents/verify/:kind/:number', ...signedIn, async (req: Request, res: Response) => {
  const p = verifyParams.parse(req.params);
  res.set('Cache-Control', 'no-store');
  ok(res, await checkSignedIn(subjectOf(req), p.kind, p.number, verifyQuery.parse(req.query).h, who(req)));
});
workforceVerifyRouter.post('/workforce/documents/verify/:kind/:number/report', ...signedIn, async (req: Request, res: Response) => {
  const p = verifyParams.parse(req.params);
  ok(res, await reportMismatch(subjectOf(req), p.kind, p.number, reportBody.parse(req.body)));
});
