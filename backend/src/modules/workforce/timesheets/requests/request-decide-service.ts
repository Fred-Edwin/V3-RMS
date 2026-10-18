import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { personInScope } from '../../attendance/attendance-scope';
import { resolveActor, told } from '../../people/people-context';
import { refreshPeriod } from '../assemble/assemble-service';
import { timesheetDaysRepository } from '../days/timesheet-days-repository';
import { periodsRepository } from '../periods/periods-repository';
import { asJson, eventOf, timesheetEntry } from '../timesheets-audit';
import { applyClockRequest } from './clock-apply';
import { isClockKind } from './requests-rules';
import { requestsRepository } from './requests-repository';
import type { RequestDecisionBody } from './requests-validators';
import { viewRequests, type RequestView } from './requests-view';
import type { RequestRow } from '../timesheets.types';

/**
 * Who may answer a request. The first approver is the person it waits on (and anyone with the same reach); a clock
 * correction needs the right to fix time (Branch or Store Manager, HR, System Admin); "clocked out by mistake" belongs to the
 * Branch or Store Manager and the System Admin, and to HR once it has moved there; pay questions belong to HR.
 */
function assertMayAnswer(subject: AccessSubject, request: RequestRow): void {
  const wide = scopeOf(subject, 'timesheet.approve') === 'all';
  if (request.kind === 'PAY_OTHER' && !wide) throw new ForbiddenError('Pay questions are answered by HR.', 'HR_ONLY');
  if (request.kind === 'CLOCKED_OUT_BY_MISTAKE' && !workforceCan(subject, 'clock_mistake.resolve') && !(wide && request.escalatedAt !== null)) {
    throw new ForbiddenError('Only the Branch Manager or the System Admin answers a clock-out mistake (HR once it has moved there).', 'MISTAKE_NOT_YOURS');
  }
  if (isClockKind(request.kind) && !workforceCan(subject, 'time.fix')) {
    throw new ForbiddenError('Only the Branch Manager, HR or the System Admin can correct a clock time.', 'CANNOT_FIX_TIME');
  }
}

/**
 * Answer a request (Chapter 9, step 3): accept, or decline with a reason. Accepting a clock request makes the correction
 * through the attendance fix door (new rows pointing at the old; the old value stays in the history) and the person sees
 * before and after. A closed period refuses the correction (HR reopens it first). Nobody answers their own.
 */
export async function decideRequest(subject: AccessSubject, id: string, body: RequestDecisionBody, now: Date = new Date()): Promise<RequestView> {
  const request = await requestsRepository.findAnywhere(id);
  if (!request) throw new NotFoundError('Request not found');
  const person = await personInScope(subject, 'timesheet.approve', request.employeeId, 'write');
  assertMayAnswer(subject, request);
  if (request.state !== 'WAITING') throw new ConflictError('This request has been answered already.', 'ALREADY_ANSWERED');
  const ctx = await resolveActor(subject);
  const approving = body.outcome === 'APPROVE';
  const reason = body.reason ?? (approving ? 'Request accepted' : '');

  const applied = approving && isClockKind(request.kind) ? await applyClockRequest(subject, request, reason, now) : null;
  if (applied) {
    const period = await periodsRepository.containing(request.siteId, request.shiftDate);
    if (period) await refreshPeriod(period, now, true);
  }
  const day = await timesheetDaysRepository.byPersonDate(request.siteId, request.employeeId, request.shiftDate);
  const answerAfter: Record<string, unknown> = {
    outcome: body.outcome,
    ...(applied ? { before: applied.before, after: applied.after } : {}),
    day: day ? { status: day.status, workedMinutes: day.workedMinutes, minutesLate: day.minutesLate } : null,
  };

  await runAudited(async (tx) => {
    const claimed = await requestsRepository.answer(tx, request.id, {
      state: approving ? 'APPROVED' : 'DECLINED',
      decidedById: subject.id,
      decidedAt: now,
      decisionReason: body.reason ?? null,
      answerAfter,
      appliedEventId: applied?.eventIds[0] ?? null,
    });
    if (!claimed) throw new ConflictError('This request has been answered already.', 'ALREADY_ANSWERED');
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: request.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.request_decided',
      subjectId: request.employeeId,
      userId: person.userId,
      before: asJson({ requestId: request.id, kind: request.kind, date: request.shiftDate, recorded: request.recorded, requested: request.requested }),
      after: asJson({ requestId: request.id, outcome: body.outcome, corrections: applied?.eventIds.length, before: applied?.before, after: applied?.after }),
      reason: body.reason ?? null,
    });
    const event = eventOf('time_request.decided', { siteId: request.siteId, requestId: request.id, employeeId: request.employeeId, userId: person.userId, kind: request.kind, outcome: approving ? 'APPROVED' : 'DECLINED', decidedById: subject.id }, now);
    return { result: undefined, entries: [entry], events: [event] };
  });
  await told([person.userId], 'time_request.decided', { kind: request.kind, outcome: body.outcome });
  const fresh = await requestsRepository.findAnywhere(request.id);
  return (await viewRequests([fresh ?? request], now))[0] as RequestView;
}
