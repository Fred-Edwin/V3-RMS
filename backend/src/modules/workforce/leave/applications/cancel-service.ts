import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { withdrawDocument } from '../../_shared/documents/register-document';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { assertInScope, type AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { applicationsRepository, type ApplicationRow } from '../data/applications-repository';
import { eventsRepository } from '../data/events-repository';
import { dbOf, peopleRepository } from '../data/people-repository';
import { managerMayCancel, personMayCancel } from '../engine/leave-phase';
import { currentDecider } from '../engine/leave-routing';
import { asJson, leaveEntry } from '../leave-audit';
import { deciderUserIds, headUserId, tell } from '../leave-notify';
import type { CancelBody } from '../leave-validators';
import { roleWord } from '../leave-words';
import { slipCode } from '../slip/slip-snapshot';
import { summaryOf, type ApplicationSummary } from './application-summary';
import { lockedApplication } from './decide-guard';

export interface CancelResult {
  application: ApplicationSummary;
  repeat: boolean;
}

const SITE_MANAGERS = ['MANAGER', 'STORE_MANAGER'];

/**
 * Cancel (M6, L23). The person cancels their own request while it waits, or while it is approved and has not started: no PIN, no reason.
 * A manager of the site (or HR) may cancel an APPROVED request that has not started, because it voids a signed slip: reason chip and
 * PIN are required. A leave in progress or finished cannot be cancelled (HR adjusts the balance instead). The days go back to the
 * balance by themselves (balances count approved requests only); the rota days stay empty. Repeats are harmless.
 */
export async function cancelLeave(subject: AccessSubject, id: string, body: CancelBody, key: string, now: Date = new Date()): Promise<CancelResult> {
  const ctx = await resolveActor(subject);
  const app = await applicationsRepository.byId(ctx.companyId, id);
  const person = app ? await peopleRepository.byId(ctx.companyId, app.employeeId) : null;
  if (!app || !person) throw new NotFoundError('That leave request was not found', 'LEAVE_NOT_FOUND');
  const own = person.userId === subject.id;
  if (!own) assertInScope(subject, 'leave.approve', { userId: person.userId, siteId: person.siteId, departmentId: person.departmentId }, 'not_found');

  if (app.status === 'CANCELLED' && (own ? app.cancelledBy === subject.id : (await eventsRepository.byKey(dbOf(), app.id, key)) !== null)) return { application: summaryOf(app, now), repeat: true };
  const today = nairobiToday(now);
  assertCancellable(app, own, subject, today);
  if (!own) {
    if (!body.reasonCode) throw new ValidationError('Choose why the leave is cancelled.', 'CANCEL_REASON_REQUIRED');
    if (!body.pin) throw new ValidationError('Enter your PIN to sign.', 'PIN_REQUIRED');
    await verifySignerPin(subject.id, body.pin, now.getTime());
  }

  const wasApproved = app.status === 'APPROVED';
  const done = await runAudited<CancelResult>(async (tx) => {
    const locked = await lockedApplication(tx, ctx.companyId, app.id);
    if (locked.status === 'CANCELLED') return { result: { application: summaryOf(locked, now), repeat: true }, entries: [] };
    assertCancellable(locked, own, subject, today);
    const changed = await applicationsRepository.update(tx, locked.id, locked.version, {
      status: 'CANCELLED', cancelledAt: now, cancelledBy: subject.id, cancelReason: own ? 'PERSON_ASKED' : (body.reasonCode as string), ...(body.note ? { decisionNote: body.note } : {}),
    });
    if (!changed) throw new ConflictError('This request changed while you were looking. It has been reloaded.', 'STALE_REQUEST');
    await eventsRepository.add(tx, { applicationId: locked.id, kind: 'CANCELLED', at: now, byUser: subject.id, role: subject.role, idempotencyKey: key });
    const entries = [
      leaveEntry({
        companyId: ctx.companyId, siteId: locked.siteId, actor: ctx.auditActor, action: 'leave.cancelled', subjectId: locked.id, userId: person.userId,
        before: asJson({ status: locked.status }),
        after: asJson({ status: 'CANCELLED', type: locked.typeCode, start: locked.start, end: locked.end, days: locked.days, by: own ? 'PERSON' : 'MANAGER', reasonCode: own ? null : body.reasonCode, noteGiven: Boolean(body.note), method: own ? null : 'PIN', ...(wasApproved ? { daysReturned: locked.days - locked.unpaidTailDays } : {}) }),
      }),
    ];
    if (wasApproved && locked.slipNumber !== null) {
      // The slip keeps its number; the index (and so the verify page) reads it as voided from this moment.
      await withdrawDocument(tx, { companyId: ctx.companyId, number: slipCode(locked.slipNumber), byRole: roleWord(subject.role), at: now });
      entries.push(leaveEntry({ companyId: ctx.companyId, siteId: locked.siteId, actor: ctx.auditActor, action: 'leave.slip_cancelled_stamped', subjectId: locked.id, userId: person.userId, after: asJson({ slipNumber: locked.slipNumber }) }));
    }
    const updated = (await applicationsRepository.byId(ctx.companyId, locked.id, tx)) as ApplicationRow;
    return { result: { application: summaryOf(updated, now), repeat: false }, entries };
  });

  if (!done.repeat) await tellCancelled({ app, own, wasApproved, today, person });
  return done;
}

function assertCancellable(app: ApplicationRow, own: boolean, subject: AccessSubject, today: ReturnType<typeof nairobiToday>): void {
  if (own) {
    if (!personMayCancel(app, today)) throw new ForbiddenError('This leave can no longer be cancelled here. Ask HR.', 'NOT_CANCELLABLE');
    return;
  }
  const mayRole = subject.role === 'HR_MANAGER' || (SITE_MANAGERS.includes(subject.role) && subject.siteId === app.siteId);
  if (!mayRole) throw new ForbiddenError('This request is not yours to cancel.', 'NOT_YOUR_DECISION');
  if (!managerMayCancel(app, today)) throw new ForbiddenError('Only approved leave that has not started can be cancelled.', 'NOT_CANCELLABLE');
}

async function tellCancelled(args: { app: ApplicationRow; own: boolean; wasApproved: boolean; today: ReturnType<typeof nairobiToday>; person: NonNullable<Awaited<ReturnType<typeof peopleRepository.byId>>> }): Promise<void> {
  const { app, own, wasApproved, today, person } = args;
  const head = wasApproved ? await headUserId(person, today) : null;
  if (own) {
    const deciders = await deciderUserIds(currentDecider(app, new Date()), person);
    await tell([...deciders, head], 'leave.cancelled_by_person', { id: app.id });
    return;
  }
  await tell([person.userId], 'leave.cancelled_by_manager', { id: app.id });
  await tell([head, ...(await deciderUserIds(person.siteKind === 'CENTRAL_STORE' ? 'STORE_MANAGER' : 'MANAGER', person))], 'leave.cancelled_plan_days', { id: app.id });
}
