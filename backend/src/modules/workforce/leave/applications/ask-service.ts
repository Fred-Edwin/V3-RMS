import { ConflictError, ForbiddenError, ValidationError } from '../../../../utils/errors';
import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { balancesOf } from '../balances/balance-service';
import { rulesToday } from '../balances/rules-loader';
import { applicationsRepository } from '../data/applications-repository';
import { eventsRepository } from '../data/events-repository';
import { dbOf, peopleRepository, type LeavePerson } from '../data/people-repository';
import { leaveYearOf } from '../engine/leave-days';
import { routeFor } from '../engine/leave-routing';
import type { DeciderRole } from '../leave.constants';
import { asJson, eventOf, leaveEntry } from '../leave-audit';
import { deciderUserIds, tell } from '../leave-notify';
import type { AskBody, PreviewBody } from '../leave-validators';
import { DECIDER_WORDS, snapshotOfType } from '../leave-words';
import { assessAsk, type AskAssessment, type AskError } from './ask-check';
import { anyTight } from '../engine/leave-cover';
import { loadCover } from './cover-service';
import { summaryOf, type ApplicationSummary } from './application-summary';

/** The signed-in person's employee file; a login with none is not on the leave policy. */
export async function requirePerson(subject: AccessSubject): Promise<LeavePerson> {
  const person = await peopleRepository.byUserId(subject.id);
  if (!person) throw new ForbiddenError('You are not on the leave policy yet. Ask HR.', 'NO_EMPLOYEE_FILE');
  return person;
}

export interface PreviewResult {
  typeCode: string;
  days: number;
  returnOn: string;
  left: number | null;
  leftAfter: number | null;
  shortfall: number;
  suggestedTail: number;
  tailAllowed: boolean;
  /** Only yes or no: the person asking never sees counts or names (L15). */
  tight: boolean;
  sickNote: boolean;
  /** Who will decide, in words ("Branch Manager"). */
  sendTo: string;
  errors: { code: string; message: string; details?: Record<string, unknown> }[];
}

const failWith = (error: AskError): never => {
  throw error.kind === 'state' ? new ConflictError(error.message, error.code, error.details) : new ValidationError(error.message, error.code, error.details);
};

/** Who gets the request: the routed role, unless nobody holds it at the site, then HR so the request never sits unseen. */
async function routingFor(person: LeavePerson, approvedBy: 'MANAGER' | 'HR'): Promise<{ role: DeciderRole; stage: 'MANAGER' | 'HR' | 'DIRECTOR'; fellBack: boolean }> {
  const routed = routeFor(person.role ?? 'WAITER', person.siteKind, approvedBy);
  if (routed.stage !== 'MANAGER') return { ...routed, fellBack: false };
  if ((await deciderUserIds(routed.role, person)).length > 0) return { ...routed, fellBack: false };
  logger.warn({ siteId: person.siteId, role: routed.role }, 'leave: no active manager at the site, request routed to HR');
  return { role: 'HR_MANAGER', stage: 'HR', fellBack: true };
}

/** The preview: no side effects, the same checks as the send (M4). */
export async function previewAsk(subject: AccessSubject, body: PreviewBody, now: Date = new Date()): Promise<PreviewResult> {
  const person = await requirePerson(subject);
  const today = nairobiToday(now);
  const requestable = (await balancesOf(person, leaveYearOf(body.start), now)).requestable.find((type) => type.code === body.typeCode);
  const overlap = body.end >= body.start ? await applicationsRepository.overlapping(dbOf(), person.id, body.start, body.end) : null;
  const assessed = assessAsk({ person, requestable, ask: body, overlap, today });
  const tight = assessed.errors.length === 0 && body.end >= body.start ? anyTight((await loadCover(person, body.start, body.end, now)).days) : false;
  const route = person.role ? await routingFor(person, requestable?.approvedBy ?? 'MANAGER') : null;
  return {
    typeCode: body.typeCode,
    days: assessed.days,
    returnOn: assessed.returnOn,
    left: assessed.left,
    leftAfter: assessed.leftAfter,
    shortfall: assessed.shortfall,
    suggestedTail: assessed.suggestedTail,
    tailAllowed: assessed.tailAllowed,
    tight,
    sickNote: assessed.sickNote,
    sendTo: route ? DECIDER_WORDS[route.role] : DECIDER_WORDS.HR_MANAGER,
    errors: assessed.errors.map(({ code, message, details }) => ({ code, message, ...(details ? { details } : {}) })),
  };
}

export interface AskResult {
  application: ApplicationSummary;
  /** True when this answers a repeat of the same Idempotency-Key. */
  repeat: boolean;
}

/**
 * Send a request (M5). One transaction takes a lock on the person, so two requests that overlap (a double tap, two phones) cannot both
 * pass; the same key returns the first result. Routing is decided here, never by the client. The audit entry is the last write.
 */
export async function createAsk(subject: AccessSubject, body: AskBody, key: string, now: Date = new Date()): Promise<AskResult> {
  const person = await requirePerson(subject);
  if (!person.role) throw new ForbiddenError('Your account has no role yet', 'NO_ROLE');
  const earlier = await applicationsRepository.byKey(person.id, key);
  if (earlier) return { application: summaryOf(earlier, now), repeat: true };

  const ctx = await resolveActor(subject);
  const rules = await rulesToday(person.siteId, now);
  const typeRule = rules.leaveTypes.find((type) => type.code === body.typeCode);

  let routedRole: DeciderRole = 'MANAGER';
  const done = await runAudited<AskResult>(async (tx) => {
    await applicationsRepository.lockPerson(tx, person.id);
    const again = await applicationsRepository.byKey(person.id, key, tx);
    if (again) return { result: { application: summaryOf(again, now), repeat: true }, entries: [] };

    const requestable = (await balancesOf(person, leaveYearOf(body.start), now, tx)).requestable.find((type) => type.code === body.typeCode);
    const overlap = body.end >= body.start ? await applicationsRepository.overlapping(tx, person.id, body.start, body.end) : null;
    const assessed: AskAssessment = assessAsk({ person, requestable, ask: body, overlap, today: nairobiToday(now) });
    const first = assessed.errors[0];
    if (first) failWith(first);
    if (!typeRule || !requestable) throw new ValidationError('That kind of leave is not available to you.', 'TYPE_UNKNOWN');
    if (typeRule.requiresReason && !body.note) throw new ValidationError(`Say why (needed for ${typeRule.label.toLowerCase()}).`, 'REASON_REQUIRED');

    const route = await routingFor(person, typeRule.approvedBy);
    routedRole = route.role;
    const created = await applicationsRepository.create(tx, {
      companyId: person.companyId, siteId: person.siteId, employeeId: person.id, typeCode: typeRule.code, type: snapshotOfType(typeRule),
      start: body.start, end: body.end, days: assessed.days, unpaidTailDays: assessed.appliedTail, note: body.note || null,
      stage: route.stage, routedToRole: route.role, askedAt: now, idempotencyKey: key,
    });
    await eventsRepository.add(tx, { applicationId: created.id, kind: 'ASKED', at: now, byUser: subject.id, role: subject.role });
    const entry = leaveEntry({
      companyId: ctx.companyId, siteId: person.siteId, actor: ctx.auditActor, action: 'leave.requested', subjectId: created.id, userId: person.userId,
      after: asJson({ type: typeRule.code, start: body.start, end: body.end, days: assessed.days, unpaidTailDays: assessed.appliedTail, routedTo: route.role, noteGiven: Boolean(body.note), ...(route.fellBack ? { routedToHrBecauseNoManager: true } : {}) }),
    });
    const event = eventOf('leave.requested', { siteId: person.siteId, requestId: created.id, employeeId: person.id }, now);
    return { result: { application: summaryOf(created, now), repeat: false }, entries: [entry], events: [event] };
  });

  if (!done.repeat) await tell(await deciderUserIds(routedRole, person), 'leave.asked', { id: done.application.id }, `leave.asked:${done.application.id}`);
  return done;
}
