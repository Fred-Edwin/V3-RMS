import { ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor, told } from '../../people/people-context';
import { eventOf, timeEntry } from '../attendance-audit';
import { personInScope } from '../attendance-scope';
import type { EntryRow, EventRow, PersonRow } from '../attendance.types';
import { clockRepository, type Db } from '../clock/clock-repository';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { groupDay } from '../days/person-day';
import { switchRepository } from '../switch/switch-repository';
import { planFix, type DayNumbers, type FixPlan, type FixRequest } from './fixes-plan';
import type { FixInput } from './fixes-validators';
import { assertPeriodOpen } from './period-lock';

export interface FixView {
  employeeId: string;
  date: string;
  action: FixInput['action'];
  /** The day before and after, in minutes. Overtime beyond the end goes to approval in slice 4; this only reports it. */
  before: DayNumbers | null;
  after: DayNumbers | null;
}
export interface FixResult extends FixView {
  eventId: string;
}

interface Prepared {
  person: PersonRow;
  companyId: string;
  entry: EntryRow | null;
  events: EventRow[];
  plan: FixPlan;
}

const requestOf = (input: FixInput): FixRequest =>
  input.action === 'EDIT' ? { action: 'EDIT', eventId: input.eventId, at: input.at } : input.action === 'ADD' ? { action: 'ADD', type: input.type, at: input.at } : { action: 'VOID', eventId: input.eventId };

async function prepare(subject: AccessSubject, input: FixInput, now: Date, db?: Db): Promise<Prepared> {
  const person = await personInScope(subject, 'time.fix', input.employeeId, 'write');
  if (!(await switchRepository.isEnabled(person.siteId, db))) throw new ConflictError('The new clock is not switched on for this branch.', 'ATTENDANCE_NOT_ENABLED');
  await assertPeriodOpen(subject, { siteId: person.siteId, employeeId: person.id, date: input.date });

  const site = await daysRepository.siteFacts(person.siteId, db);
  if (!site) throw new NotFoundError('Site not found');
  const data = await daysRepository.loadDayData(person.siteId, input.date, input.date, [person.id], db);
  const groups = groupDay(person.id, input.date, data);

  let entry: EntryRow | null;
  if (input.rotaEntryId) {
    entry = groups.entries.find((e) => e.id === input.rotaEntryId) ?? null;
    if (!entry) throw new NotFoundError('That shift is not on this person\'s day');
  } else if (input.action === 'ADD') {
    if (groups.entries.length > 1) throw new ValidationError('This person has two shifts that day; say which one', 'ENTRY_REQUIRED');
    entry = groups.entries[0] ?? null;
  } else {
    const target = data.events.find((e) => e.id === input.eventId);
    entry = groups.entries.find((e) => e.id === target?.rotaEntryId) ?? (groups.entries.length === 1 ? (groups.entries[0] ?? null) : null);
  }
  const events = entry ? (groups.byEntry.get(entry.id) ?? []) : groups.unscheduled;
  const rules = await attendanceRulesFor(person.siteId, input.date);
  return { person, companyId: site.companyId, entry, events, plan: planFix({ entry, events, request: requestOf(input), shiftDate: input.date, rules, now }) };
}

const viewOf = (input: FixInput, plan: FixPlan): FixView => ({ employeeId: input.employeeId, date: input.date, action: input.action, before: plan.before, after: plan.after });

/** "Paid time changes from 8 h to 8 h 40 min": the day before and after, with nothing saved. */
export async function previewFix(subject: AccessSubject, input: FixInput, now: Date = new Date()): Promise<FixView> {
  return viewOf(input, (await prepare(subject, input, now)).plan);
}

/**
 * Fixing time (Chapter 7). The correction is a new row that points at the old one, so the old value stays visible in the
 * history; nothing is edited or deleted. The reason is required, the audit entry holds before and after (times only),
 * a closed pay period is refused unless the actor is HR, and the person is told.
 */
export async function applyFix(subject: AccessSubject, input: FixInput, now: Date = new Date()): Promise<FixResult> {
  const ctx = await resolveActor(subject);
  const result = await runAudited(async (tx) => {
    const { person, companyId, entry, plan } = await prepare(subject, input, now, tx);
    await clockRepository.lockEmployee(tx, person.id);
    const { draft } = plan;
    const event = await clockRepository.insert(tx, {
      siteId: person.siteId,
      employeeId: person.id,
      rotaEntryId: draft.rotaEntryId,
      shiftDate: input.date,
      type: draft.type,
      source: 'MANAGER',
      occurredAt: draft.occurredAt,
      serverAt: now,
      correctsEventId: draft.correctsEventId,
      voidsCorrected: draft.voidsCorrected,
      reasonCode: 'FIX',
      reason: input.reason,
      recordedById: subject.id,
    });
    const audit = timeEntry({
      companyId,
      siteId: person.siteId,
      actor: ctx.auditActor,
      action: 'attendance.time_fixed',
      employeeId: person.id,
      userId: person.userId,
      before: { action: input.action, shift: entry?.templateName ?? null, was: draft.was, day: plan.before },
      after: { at: draft.occurredAt.toISOString(), voided: draft.voidsCorrected, day: plan.after },
      reason: input.reason,
    });
    const fixed = eventOf(
      'attendance.fixed',
      {
        siteId: person.siteId,
        employeeId: person.id,
        userId: person.userId,
        shiftDate: input.date,
        fixedById: subject.id,
        kind: input.action,
        workedMinutesBefore: plan.before?.workedMinutes ?? 0,
        workedMinutesAfter: plan.after?.workedMinutes ?? 0,
        afterEndMinutesBefore: plan.before?.afterEndMinutes ?? 0,
        afterEndMinutesAfter: plan.after?.afterEndMinutes ?? 0,
      },
      now,
    );
    return { result: { person, view: { ...viewOf(input, plan), eventId: event.id } }, entries: [audit], events: [fixed] };
  });
  await told([result.person.userId], 'attendance.fixed', { date: input.date, action: input.action });
  return result.view;
}
