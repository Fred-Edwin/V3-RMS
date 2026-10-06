import type { LatenessRules, OvertimeRules } from '../../rules/rules-schemas';
import { shiftInstants } from './lateness';
import { weekStart, type IsoWeekday, type NairobiDate } from './nairobi-time';
import type { DayHours, ShiftWindow } from './time-types';

const MS_PER_MINUTE = 60_000;

export interface OvertimeEvidence {
  /** The system could see open orders or tickets at the scheduled end (shift-end snapshot). No open work: no tail. */
  openWorkAtShiftEnd: boolean;
  /** The manager extended the shift in advance (pre-approval). */
  preApprovedUntil: Date | null;
}

export interface OvertimeCandidate {
  shiftDate: NairobiDate;
  rawMinutes: number; // afterEndMinutes minus any minutes used to make up lateness
  serviceTailMinutes: number; // recognised automatically (only with open work)
  preApprovedMinutes: number; // covered by an advance extension
  autoRecognisedMinutes: number; // max(serviceTail, preApproved); the two cover the same minutes, they do not add
  needsApprovalMinutes: number; // rawMinutes minus autoRecognised: a manager decides these
  basis: 'NONE' | 'SERVICE_TAIL' | 'PRE_APPROVED';
}

/**
 * Minutes after the end that a lateness policy "make up the time the same day" consumes:
 * min(minutesAfterGrace, afterEndMinutes) when lateness.makeUpSameDay is on, else 0. These minutes are not overtime.
 * Feeds on: lateness.makeUpSameDay.
 */
export function makeUpMinutes(day: DayHours, rules: Pick<LatenessRules, 'makeUpSameDay'>): number {
  if (!rules.makeUpSameDay) return 0;
  return Math.min(day.lateness?.minutesAfterGrace ?? 0, day.afterEndMinutes);
}

/**
 * Rule (proposal 5.5, decision D10): null unless the day is CLOSED or AUTO_CLOSED and rawMinutes > 0.
 * serviceTail = min(raw, overtime.serviceTailMinutes) only when evidence.openWorkAtShiftEnd. preApproved = minutes
 * between the scheduled end and preApprovedUntil, between 0 and raw. Order value is never an input.
 * Feeds on: overtime.serviceTailMinutes.
 */
export function overtimeCandidate(
  day: DayHours,
  shift: ShiftWindow,
  evidence: OvertimeEvidence,
  madeUpMinutes: number,
  rules: Pick<OvertimeRules, 'serviceTailMinutes'>,
): OvertimeCandidate | null {
  if (day.status !== 'CLOSED' && day.status !== 'AUTO_CLOSED') return null;
  const rawMinutes = day.afterEndMinutes - madeUpMinutes;
  if (rawMinutes <= 0) return null;

  const serviceTailMinutes = evidence.openWorkAtShiftEnd ? Math.min(rawMinutes, rules.serviceTailMinutes) : 0;
  let preApprovedMinutes = 0;
  if (evidence.preApprovedUntil) {
    const { end } = shiftInstants(shift);
    const extended = Math.floor((evidence.preApprovedUntil.getTime() - end.getTime()) / MS_PER_MINUTE);
    preApprovedMinutes = Math.min(Math.max(0, extended), rawMinutes);
  }
  const autoRecognisedMinutes = Math.max(serviceTailMinutes, preApprovedMinutes);
  const basis = autoRecognisedMinutes === 0 ? 'NONE' : preApprovedMinutes >= serviceTailMinutes ? 'PRE_APPROVED' : 'SERVICE_TAIL';
  return {
    shiftDate: day.shiftDate,
    rawMinutes,
    serviceTailMinutes,
    preApprovedMinutes,
    autoRecognisedMinutes,
    needsApprovalMinutes: rawMinutes - autoRecognisedMinutes,
    basis,
  };
}

export interface WeeklyOvertime {
  weekStart: NairobiDate;
  candidateMinutes: number; // sum of rawMinutes in the week
  capMinutes: number | null;
  overCapMinutes: number; // max(0, candidate - cap); never auto-recognised, always goes to a manager
}

/** Groups by the week containing shiftDate. Feeds on: overtime.weeklyCapMinutes, week.weekStartsOn. */
export function weeklyOvertime(
  candidates: readonly OvertimeCandidate[],
  weekStartsOn: IsoWeekday,
  rules: Pick<OvertimeRules, 'weeklyCapMinutes'>,
): WeeklyOvertime[] {
  const byWeek = new Map<NairobiDate, number>();
  for (const candidate of candidates) {
    const key = weekStart(candidate.shiftDate, weekStartsOn);
    byWeek.set(key, (byWeek.get(key) ?? 0) + candidate.rawMinutes);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, candidateMinutes]) => ({
      weekStart: week,
      candidateMinutes,
      capMinutes: rules.weeklyCapMinutes,
      overCapMinutes: rules.weeklyCapMinutes === null ? 0 : Math.max(0, candidateMinutes - rules.weeklyCapMinutes),
    }));
}
