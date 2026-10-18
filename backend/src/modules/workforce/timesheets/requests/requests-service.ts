import { ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { daysBetween, nairobiToday, parseNairobiDate } from '../../_shared/time/nairobi-time';
import { inScope, scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { daysRepository } from '../../attendance/days/days-repository';
import { switchRepository } from '../../attendance/switch/switch-repository';
import { resolveActor, told } from '../../people/people-context';
import { eventOf, timesheetEntry } from '../timesheets-audit';
import { viewerFor } from '../timesheets-scope';
import { loadSnapshot, recordedOf } from './day-snapshot';
import { firstApprover, REPORT_WINDOW_DAYS } from './requests-rules';
import { requestsRepository } from './requests-repository';
import type { CreateRequestBody, InboxQuery } from './requests-validators';
import { viewRequests, type RequestView } from './requests-view';

/** What the person says it should be. Times as instants, minutes as numbers; no money. */
function requestedOf(body: CreateRequestBody): Record<string, unknown> {
  switch (body.kind) {
    case 'CLOCK_TIME_WRONG':
      return { type: body.type, at: body.at };
    case 'WORKED_NOT_RECORDED':
      return { clockIn: body.clockIn, clockOut: body.clockOut };
    case 'CLOCKED_OUT_BY_MISTAKE':
      return body.at ? { at: body.at } : {};
    case 'OVERTIME_MISSING':
      return body.minutes ? { minutes: body.minutes } : {};
    default:
      return {};
  }
}

/**
 * Report a problem (Chapter 9, step 2) and "clocked out by mistake": the person says what a recorded time should be. Nothing
 * changes until someone answers ("Your time stays as recorded"). One open request of a kind per day, so a double tap makes one.
 * It waits on the Branch Manager (the Store Manager at the hub), or on HR for pay questions and for a manager's own.
 */
export async function createRequest(subject: AccessSubject, body: CreateRequestBody, now: Date = new Date()): Promise<RequestView> {
  const person = await daysRepository.personByUserId(subject.id);
  if (!person || !person.tracksTime) throw new NotFoundError('You do not clock in');
  if (!(await switchRepository.isEnabled(person.siteId))) throw new ConflictError('The new clock is not switched on for your branch.', 'ATTENDANCE_NOT_ENABLED');
  const date = parseNairobiDate(body.date);
  const today = nairobiToday(now);
  if (date > today) throw new ValidationError('That day has not happened yet', 'DATE_IN_FUTURE');
  if (daysBetween(date, today) > REPORT_WINDOW_DAYS) throw new ValidationError(`You can report a day up to ${REPORT_WINDOW_DAYS} days back. Ask HR.`, 'DATE_TOO_OLD');

  const open = await requestsRepository.openOfKind(person.id, body.kind, date);
  if (open) return (await viewRequests([open], now))[0] as RequestView;

  const snapshot = await loadSnapshot(person.siteId, person.id, date, now);
  if (body.kind === 'CLOCKED_OUT_BY_MISTAKE' && !snapshot.entry?.clockedOutAt) throw new ConflictError('There is no clock-out on that day to take away.', 'NOTHING_TO_REVERSE');

  const role = firstApprover(body.kind, subject.role);
  const candidates = await requestsRepository.approverCandidates(role === 'HR_MANAGER' ? null : person.siteId, [role]);
  const waitingOnUserId = candidates[0]?.id ?? null;
  const ctx = await resolveActor(subject);

  const created = await runAudited(async (tx) => {
    const row = await requestsRepository.create(tx, {
      siteId: person.siteId,
      employeeId: person.id,
      kind: body.kind,
      shiftDate: date,
      note: body.note,
      recorded: recordedOf(snapshot),
      requested: requestedOf(body),
      waitingOnRole: role,
      waitingOnUserId,
    });
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: person.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.request_created',
      subjectId: person.id,
      userId: person.userId,
      after: { requestId: row.id, kind: body.kind, date, waitingOn: role },
      reason: body.note,
    });
    const event = eventOf('time_request.created', { siteId: person.siteId, requestId: row.id, employeeId: person.id, userId: person.userId, kind: body.kind, waitingOnRole: role, waitingOnUserId }, now);
    return { result: row, entries: [entry], events: [event] };
  });
  await told([waitingOnUserId], 'time_request.created', { kind: body.kind, date });
  return (await viewRequests([created], now))[0] as RequestView;
}

/** Take a request back while it is still waiting. Only its owner can. */
export async function withdrawRequest(subject: AccessSubject, id: string, now: Date = new Date()): Promise<RequestView> {
  const person = await daysRepository.personByUserId(subject.id);
  const request = await requestsRepository.findAnywhere(id);
  if (!person || !request || request.employeeId !== person.id) throw new NotFoundError('Request not found');
  const ctx = await resolveActor(subject);
  await runAudited(async (tx) => {
    if (!(await requestsRepository.withdraw(tx, id, person.id))) throw new ConflictError('That request has been answered already.', 'NOT_WAITING');
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: request.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.request_withdrawn',
      subjectId: person.id,
      userId: person.userId,
      before: { requestId: id, state: 'WAITING' },
      after: { requestId: id, state: 'WITHDRAWN' },
    });
    return { result: undefined, entries: [entry], events: [eventOf('time_request.withdrawn', { siteId: request.siteId, requestId: id, employeeId: person.id }, now)] };
  });
  const fresh = await requestsRepository.findAnywhere(id);
  return (await viewRequests([fresh ?? request], now))[0] as RequestView;
}

/** My requests (Chapter 9, step 3): waiting, escalated to HR after 3 days, answered with before and after. */
export async function myRequests(subject: AccessSubject, state: 'OPEN' | 'ALL', now: Date = new Date()): Promise<{ requests: RequestView[] }> {
  const person = await daysRepository.personByUserId(subject.id);
  if (!person) return { requests: [] };
  const rows = await requestsRepository.ofPerson(person.id, state === 'OPEN' ? ['WAITING'] : ['WAITING', 'APPROVED', 'DECLINED', 'WITHDRAWN'], 50);
  return { requests: await viewRequests(rows, now) };
}

/** One request, to its owner or to anyone who may read timesheets for that person. Another branch answers 404. */
export async function requestDetail(subject: AccessSubject, id: string, now: Date = new Date()): Promise<RequestView> {
  const request = await requestsRepository.findAnywhere(id);
  if (!request) throw new NotFoundError('Request not found');
  const mine = await daysRepository.personByUserId(subject.id);
  if (mine?.id !== request.employeeId) {
    const person = await daysRepository.personAnywhere(request.employeeId);
    if (!person || !inScope(subject, 'timesheet.read', { userId: person.userId, siteId: person.siteId, departmentId: person.departmentId })) throw new NotFoundError('Request not found');
  }
  return (await viewRequests([request], now))[0] as RequestView;
}

/** The inbox of a branch (managers, heads for their departments, HR and the Director for all): oldest waiting first. */
export async function requestInbox(subject: AccessSubject, query: InboxQuery, now: Date = new Date()) {
  const viewer = viewerFor(subject, 'timesheet.read', query.siteId);
  const states = query.state === 'WAITING' ? (['WAITING'] as const) : query.state === 'ANSWERED' ? (['APPROVED', 'DECLINED', 'WITHDRAWN'] as const) : (['WAITING', 'APPROVED', 'DECLINED', 'WITHDRAWN'] as const);
  const page = await requestsRepository.page(viewer.siteId, { states, departmentIds: viewer.departmentIds, search: query.search }, (query.page - 1) * query.pageSize, query.pageSize);
  const views = await viewRequests(page.rows.map((r) => r.request), now);
  return {
    rows: views.map((view, i) => ({ ...view, person: { id: page.rows[i]!.person.id, name: page.rows[i]!.person.name, departmentName: page.rows[i]!.person.department?.name ?? null } })),
    page: query.page,
    pageSize: query.pageSize,
    total: page.total,
    canAct: scopeOf(subject, 'timesheet.approve') !== null,
  };
}
