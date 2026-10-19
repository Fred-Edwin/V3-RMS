import { createHash } from 'node:crypto';
import { makeUpMinutes, overtimeCandidate } from '../../_shared/time/overtime';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { EntryDay } from '../../attendance/attendance.types';
import type { DayAssessment, DayReason, OvertimeFigures } from '../timesheets.types';

export interface AssessRules {
  graceMinutes: number; // LATENESS: also how far a clock-out may sit from the scheduled end and still "match the rota"
  makeUpSameDay: boolean;
  serviceTailMinutes: number;
}

export interface AssessInput {
  date: NairobiDate;
  today: NairobiDate;
  entries: readonly EntryDay[];
  /** Events with no shift on the day to belong to (worked without being on the rota). */
  unscheduledCount: number;
  /** Per shift: the system could see open orders or tickets at the scheduled end. */
  openWork: ReadonlyMap<string, boolean>;
  rules: AssessRules;
}

const isFinal = (entry: EntryDay): boolean => entry.hours.status === 'CLOSED' || entry.hours.status === 'AUTO_CLOSED';

/**
 * Rule (Chapter 8): a day matches the rota when, for every shift, the person clocked in within the grace, clocked out
 * within the grace of the scheduled end, nobody edited it, the phone's clock was right and nothing was left open. A
 * matching day whose shifts are all over approves itself (AUTO_APPROVED); a matching day still in progress is MATCHED.
 * Anything else is NEEDS_LOOK with the reasons. Time after the end beyond the grace is overtime: fully covered by the
 * service tail it needs no one; otherwise the day needs a look. Returns null when there is nothing to show yet (a shift
 * that has not started or is not over with no clock-in).
 * Feeds on: lateness.graceMinutes, lateness.makeUpSameDay, overtime.serviceTailMinutes.
 */
export function assessDay(input: AssessInput): DayAssessment | null {
  const { entries, rules, date, today } = input;
  const reasons = new Set<DayReason>();
  const total: OvertimeFigures = { rawMinutes: 0, serviceTailMinutes: 0, autoMinutes: 0, needsMinutes: 0, openWorkAtEnd: false };
  let hasOvertime = false;
  const sum = { scheduled: 0, worked: 0, late: 0, afterGrace: 0, leftEarly: 0, afterEnd: 0 };
  let show = input.unscheduledCount > 0;

  if (entries.length === 0 && input.unscheduledCount > 0) reasons.add('UNSCHEDULED');

  for (const entry of entries) {
    const { hours } = entry;
    sum.scheduled += hours.scheduledMinutes;
    if (hours.status === 'NO_CLOCK') {
      if (entry.state === 'MISSED') {
        show = true;
        reasons.add('ABSENT');
      }
      continue;
    }
    show = true;
    sum.worked += hours.workedMinutes;
    sum.leftEarly += hours.leftEarlyMinutes;
    sum.afterEnd += hours.afterEndMinutes;
    if (hours.lateness) {
      sum.late += hours.lateness.minutesLate;
      sum.afterGrace += hours.lateness.minutesAfterGrace;
      if (hours.lateness.countsAsLate) reasons.add('LATE');
    }
    if (hours.status === 'OPEN' && date < today) reasons.add('OPEN_SHIFT');
    if (hours.status === 'AUTO_CLOSED' && !entry.flags.reviewed) reasons.add('AUTO_CLOSED');
    if (hours.leftEarlyMinutes > rules.graceMinutes) reasons.add('LEFT_EARLY');
    if (entry.flags.fixed) reasons.add('EDITED');
    if (entry.flags.skew) reasons.add('PHONE_CLOCK');

    if (hours.afterEndMinutes > rules.graceMinutes) {
      const openWork = input.openWork.get(entry.entryId) ?? false;
      const made = makeUpMinutes(hours, rules);
      const candidate = overtimeCandidate(hours, entry.shift, { openWorkAtShiftEnd: openWork, preApprovedUntil: null }, made, rules);
      if (candidate) {
        total.rawMinutes += candidate.rawMinutes;
        total.serviceTailMinutes += candidate.serviceTailMinutes;
        total.autoMinutes += candidate.autoRecognisedMinutes;
        total.needsMinutes += candidate.needsApprovalMinutes;
        total.openWorkAtEnd = total.openWorkAtEnd || openWork;
        hasOvertime = true;
      }
    }
  }
  if (!show) return null;
  const overtime = hasOvertime ? total : null;
  if (overtime && overtime.needsMinutes > 0) reasons.add('OVERTIME');

  const final = date < today || (entries.length > 0 && entries.every(isFinal));
  const list = [...reasons].sort();
  const status = list.length > 0 ? 'NEEDS_LOOK' : final ? 'AUTO_APPROVED' : 'MATCHED';
  const evidenceHash = createHash('sha256')
    .update(JSON.stringify([sum, list, overtime, input.unscheduledCount, entries.map((e) => [e.entryId, e.hours.status, e.clockedInAt?.getTime() ?? null, e.clockedOutAt?.getTime() ?? null])]))
    .digest('hex')
    .slice(0, 24);

  return {
    status,
    reasons: list,
    final,
    scheduledMinutes: sum.scheduled,
    workedMinutes: sum.worked,
    minutesLate: sum.late,
    minutesAfterGrace: sum.afterGrace,
    leftEarlyMinutes: sum.leftEarly,
    afterEndMinutes: sum.afterEnd,
    overtime,
    evidenceHash,
  };
}
