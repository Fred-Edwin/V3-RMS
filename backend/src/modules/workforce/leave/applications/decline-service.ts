import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { applicationsRepository, type ApplicationRow } from '../data/applications-repository';
import { eventsRepository } from '../data/events-repository';
import { dbOf } from '../data/people-repository';
import { asJson, eventOf, leaveEntry } from '../leave-audit';
import { tell } from '../leave-notify';
import type { DeclineBody } from '../leave-validators';
import { summaryOf, type ApplicationSummary } from './application-summary';
import { assertMayDecide, assertWaitingAndFresh, loadDecision, lockedApplication } from './decide-guard';

export interface DeclineResult {
  application: ApplicationSummary;
  repeat: boolean;
}

/**
 * Decline (D4). No PIN: nothing is signed, no balance moves and the person may ask again (owner decision O2, L24). A reason chip is
 * always required and the person sees it; the note is kept on the request and never copied into the audit log (only "note given").
 * The same checks as approve, in the same order, and the same Idempotency-Key rule.
 */
export async function declineLeave(subject: AccessSubject, id: string, body: DeclineBody, key: string, now: Date = new Date()): Promise<DeclineResult> {
  const { app, person, ctx } = await loadDecision(subject, id);
  if ((await eventsRepository.byKey(dbOf(), app.id, key)) && app.status === 'DECLINED') return { application: summaryOf(app, now), repeat: true };

  await assertWaitingAndFresh(app, body.expectedVersion);
  await assertMayDecide(subject, app, person, now);

  const done = await runAudited<DeclineResult>(async (tx) => {
    const locked = await lockedApplication(tx, ctx.companyId, app.id);
    await assertWaitingAndFresh(locked, body.expectedVersion);
    const changed = await applicationsRepository.update(tx, locked.id, locked.version, {
      status: 'DECLINED', decidedAt: now, decidedBy: subject.id, deciderRole: subject.role, decisionReasonCode: body.reasonCode, decisionNote: body.note || null,
    });
    if (!changed) throw new ConflictError('This request changed while you were looking. It has been reloaded.', 'STALE_REQUEST');
    await eventsRepository.add(tx, { applicationId: locked.id, kind: 'DECLINED', at: now, byUser: subject.id, role: subject.role, idempotencyKey: key });
    const entry = leaveEntry({
      companyId: ctx.companyId, siteId: locked.siteId, actor: ctx.auditActor, action: 'leave.declined', subjectId: locked.id, userId: person.userId,
      before: asJson({ status: 'WAITING' }),
      after: asJson({ status: 'DECLINED', type: locked.typeCode, start: locked.start, end: locked.end, days: locked.days, reasonCode: body.reasonCode, noteGiven: Boolean(body.note), deciderRole: subject.role }),
    });
    const event = eventOf('leave.decided', { siteId: locked.siteId, requestId: locked.id, employeeId: person.id, outcome: 'DECLINED' }, now);
    const updated = (await applicationsRepository.byId(ctx.companyId, locked.id, tx)) as ApplicationRow;
    return { result: { application: summaryOf(updated, now), repeat: false }, entries: [entry], events: [event] };
  });

  await tell([person.userId], 'leave.declined', { id: app.id });
  return done;
}
