import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { assertInScope, type AccessSubject } from '../../_shared/workforce-access';
import { resolveActor, type ActorCtx } from '../../people/people-context';
import { applicationsRepository, type ApplicationRow } from '../data/applications-repository';
import { dbOf, peopleRepository, type LeavePerson } from '../data/people-repository';
import { currentDecider, movesToHrAt, refusalFor } from '../engine/leave-routing';
import { deciderUserIds } from '../leave-notify';
import { roleWord } from '../leave-words';

export interface DecisionContext {
  app: ApplicationRow;
  person: LeavePerson;
  ctx: ActorCtx;
}

/**
 * Loads a request for someone who may decide it. A request the caller cannot see answers 404 with the same body as a missing one
 * (the person, the site and the scope are checked against `leave.approve`); the 403 reasons come later, once they may know it exists.
 */
export async function loadDecision(subject: AccessSubject, id: string): Promise<DecisionContext> {
  const ctx = await resolveActor(subject);
  const app = await applicationsRepository.byId(ctx.companyId, id);
  const person = app ? await peopleRepository.byId(ctx.companyId, app.employeeId) : null;
  if (!app || !person) throw new NotFoundError('That leave request was not found', 'LEAVE_NOT_FOUND');
  assertInScope(subject, 'leave.approve', { userId: person.userId, siteId: person.siteId, departmentId: person.departmentId }, 'not_found');
  return { app, person, ctx };
}

/** 409 when it was answered already (who, when, what) or the screen is looking at an old version. */
export async function assertWaitingAndFresh(app: ApplicationRow, expectedVersion: number): Promise<void> {
  if (app.status !== 'WAITING') {
    const decider = app.decidedBy ?? app.cancelledBy;
    const who = decider ? (await peopleRepository.userNames([decider])).get(decider) : undefined;
    throw new ConflictError('Someone answered this request a moment ago.', 'ALREADY_DECIDED', {
      outcome: app.status,
      by: who ? { name: who.name, role: roleWord(who.role) } : null,
      at: (app.decidedAt ?? app.cancelledAt)?.toISOString() ?? null,
    });
  }
  if (app.version !== expectedVersion) throw new ConflictError('This request changed while you were looking. It has been reloaded.', 'STALE_REQUEST', { version: app.version });
}

/** 403 with a reason code: your own request, not with you yet (HR before the 72 hours), or not your decision. */
export async function assertMayDecide(subject: AccessSubject, app: ApplicationRow, person: LeavePerson, now: Date): Promise<void> {
  // The System Admin is a fallback only: allowed when nobody holds the deciding role (L34, spec section 5).
  const holders = subject.role === 'SYSTEM_ADMIN' ? await deciderUserIds(currentDecider(app, now), person) : [];
  const refusal = refusalFor({ application: app, actorRole: subject.role, actorIsSubject: person.userId === subject.id, sameSite: subject.siteId === app.siteId, roleHolderExists: holders.length > 0, now });
  if (refusal === 'OWN_REQUEST') throw new ForbiddenError('You cannot decide your own leave.', 'OWN_REQUEST');
  if (refusal === 'NOT_WITH_YOU_YET') throw new ForbiddenError(`With the ${roleWord(app.routedToRole)}. It moves to HR on ${movesToHrAt(app.askedAt).toISOString()}.`, 'NOT_WITH_YOU_YET', { movesToHrAt: movesToHrAt(app.askedAt).toISOString() });
  if (refusal === 'NOT_YOUR_DECISION') throw new ForbiddenError('This request is not yours to decide.', 'NOT_YOUR_DECISION');
}

/** The same request inside a transaction, after taking its row lock, or 404 if it vanished. */
export async function lockedApplication(tx: Parameters<typeof applicationsRepository.lock>[0], companyId: string, id: string): Promise<ApplicationRow> {
  await applicationsRepository.lock(tx, id);
  const fresh = await applicationsRepository.byId(companyId, id, dbOf(tx));
  if (!fresh) throw new NotFoundError('That leave request was not found', 'LEAVE_NOT_FOUND');
  return fresh;
}
