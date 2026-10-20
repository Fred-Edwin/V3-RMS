import { NotFoundError } from '../../../../utils/errors';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { summaryOf, type ApplicationSummary } from '../applications/application-summary';
import { balancesOf } from '../balances/balance-service';
import { applicationsRepository, type ApplicationRow } from '../data/applications-repository';
import { eventsRepository } from '../data/events-repository';
import { dbOf, peopleRepository, type LeavePerson } from '../data/people-repository';
import { leaveYearOf } from '../engine/leave-days';
import { managerMayCancel, personMayCancel } from '../engine/leave-phase';
import { movesToHrAt, willMoveToHr } from '../engine/leave-routing';
import { buildSteps, type LeaveStep } from '../engine/leave-steps';
import { roleWord } from '../leave-words';
import { slipCode } from '../slip/slip-snapshot';
import { assertCanOpen, routedToMe } from './read-scope';

export interface ApplicationDetail {
  application: ApplicationSummary & { slipCode: string | null };
  person: { id: string; name: string; roleLabel: string; department: string | null; site: string; head: string | null };
  note: string | null;
  decision: { reasonCode: string | null; note: string | null; byRole: string | null; at: string | null } | null;
  steps: LeaveStep[];
  figures: { asked: number; leftNow: number | null; ifApproved: number | null } | { before: number | null; taken: number; after: number | null };
  can: { cancel: boolean; askAgain: boolean; slip: boolean; approve: boolean; decline: boolean; cancelApproved: boolean };
  /** Why Approve is not offered to a reader who could otherwise see it ("With the Branch Manager. It moves to HR on ..."). */
  whyNot: string | null;
}

const mayCancelAsManager = (subject: AccessSubject, app: ApplicationRow, person: LeavePerson): boolean =>
  person.userId !== subject.id && (subject.role === 'HR_MANAGER' || ((subject.role === 'MANAGER' || subject.role === 'STORE_MANAGER') && subject.siteId === app.siteId));

/** M3: one request in full. A request the caller may not open answers 404 with the same body as a missing one. */
export async function applicationDetail(subject: AccessSubject, id: string, now: Date = new Date()): Promise<ApplicationDetail> {
  const ctx = await resolveActor(subject);
  const app = await applicationsRepository.byId(ctx.companyId, id);
  const person = app ? await peopleRepository.byId(ctx.companyId, app.employeeId) : null;
  if (!app || !person) throw new NotFoundError('That leave request was not found', 'LEAVE_NOT_FOUND');
  const access = assertCanOpen(subject, person);
  const today = nairobiToday(now);

  const [events, balances, head] = await Promise.all([
    eventsRepository.forApplication(dbOf(), app.id),
    balancesOf(person, leaveYearOf(app.start), now),
    person.departmentId ? peopleRepository.headOf(person.departmentId, today) : Promise.resolve(null),
  ]);
  const left = balances.requestable.find((type) => type.code === app.typeCode)?.left ?? null;
  const taken = app.days - app.unpaidTailDays;
  const frozen = app.status === 'APPROVED' || (app.status === 'CANCELLED' && app.balanceBefore !== null);
  const figures: ApplicationDetail['figures'] = frozen
    ? { before: app.balanceBefore, taken, after: app.balanceAfter }
    : { asked: app.days, leftNow: left, ifApproved: left === null ? null : Math.max(0, left - taken) };

  const mine = access === 'own';
  const mine2me = !mine && routedToMe(app, person.userId, subject, now);
  const futureApproval = app.start >= today;
  const holdsForHr = !mine && subject.role === 'HR_MANAGER' && willMoveToHr(app, now);
  return {
    application: { ...summaryOf(app, now), slipCode: app.slipNumber === null ? null : slipCode(app.slipNumber) },
    person: {
      id: person.id, name: person.name, roleLabel: person.positionName ?? roleWord(person.role), department: person.departmentName, site: person.siteName,
      head: head && head.employeeId !== person.id ? head.name : null,
    },
    note: app.note,
    decision: app.decidedAt || app.cancelledAt ? { reasonCode: app.decisionReasonCode ?? app.cancelReason, note: app.decisionNote, byRole: roleWord(app.deciderRole), at: (app.decidedAt ?? app.cancelledAt)?.toISOString() ?? null } : null,
    steps: buildSteps({ app, personUserId: person.userId, events, now, today }),
    figures,
    can: {
      cancel: mine ? personMayCancel(app, today) : false,
      askAgain: mine && (app.status === 'DECLINED' || app.status === 'CANCELLED'),
      slip: app.slipNumber !== null,
      approve: mine2me && futureApproval,
      decline: mine2me,
      cancelApproved: !mine && managerMayCancel(app, today) && mayCancelAsManager(subject, app, person),
    },
    whyNot: holdsForHr ? `With the ${roleWord(app.routedToRole)}. It moves to HR on ${movesToHrAt(app.askedAt).toISOString()}.` : null,
  };
}
