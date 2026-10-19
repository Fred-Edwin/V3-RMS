import { weekStart, type IsoWeekday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { PersonDay } from '../../attendance/attendance.types';
import { assessDay, type AssessRules } from '../days/day-assess';
import { resolveDay, weekStatus, type OvertimeAnswer } from '../days/day-merge';
import type { DayWrite } from '../days/timesheet-days-repository';
import { nextOvertime, overtimeLimits } from '../overtime/overtime-plan';
import type { OvertimeWrite } from '../overtime/overtime-repository';
import type { DayAssessment, DayRow, OvertimeRow } from '../timesheets.types';

export interface PlanRules extends AssessRules {
  weeklyCapMinutes: number | null;
  branchBudgetMinutesPerPeriod: number | null;
}

export type ShiftEvidence = OvertimeRow['evidence'];
export const NO_EVIDENCE: ShiftEvidence = { openWorkAtEnd: false, ordersTaken: 0, ticketsCleared: 0, openOrdersAtEnd: 0 };

export interface PlanInput {
  periodId: string;
  siteId: string;
  today: NairobiDate;
  weekStartsOn: IsoWeekday;
  days: readonly PersonDay[];
  /** Days of the neighbouring period that share a Monday to Sunday week with this one: they count towards the weekly cap only. */
  neighbourDays?: readonly PersonDay[];
  /** Per rostered shift (entry id): what the person was doing in the extra time. */
  evidence: ReadonlyMap<string, ShiftEvidence>;
  storedDays: readonly DayRow[];
  storedOvertime: readonly OvertimeRow[];
  rules: PlanRules;
}

export interface WeekWrite {
  employeeId: string;
  weekStart: NairobiDate;
  status: DayRow['status'];
  scheduledMinutes: number;
  workedMinutes: number;
}

export interface Plan {
  days: DayWrite[];
  overtime: OvertimeWrite[];
  /** Overtime items to take away because the day no longer holds overtime and nobody had decided them. */
  removals: { employeeId: string; date: NairobiDate }[];
  weeks: WeekWrite[];
  /** Days that became AUTO_APPROVED in this run (the system's own approvals; one audit entry for the batch). */
  newlyAutoApproved: number;
}

const key = (employeeId: string, date: NairobiDate): string => `${employeeId}|${date}`;

/** The evidence of a day: the shift's counts, with "open work" true if any shift had it. */
function dayEvidence(day: PersonDay, evidence: ReadonlyMap<string, ShiftEvidence>): ShiftEvidence {
  return day.entries.reduce<ShiftEvidence>((total, entry) => {
    const found = evidence.get(entry.entryId) ?? NO_EVIDENCE;
    return {
      openWorkAtEnd: total.openWorkAtEnd || found.openWorkAtEnd,
      ordersTaken: total.ordersTaken + found.ordersTaken,
      ticketsCleared: total.ticketsCleared + found.ticketsCleared,
      openOrdersAtEnd: total.openOrdersAtEnd + found.openOrdersAtEnd,
    };
  }, NO_EVIDENCE);
}

/**
 * Pure: from the days built out of the rota and the clock events, work out what the timesheet tables should hold. The
 * system approves the days that match; the rest need a person. Running it again over what it just produced changes
 * nothing, so a refresh is safe to repeat. Money never enters: only minutes.
 */
export function planTimesheet(input: PlanInput): Plan {
  const { periodId, siteId, rules, weekStartsOn } = input;
  const storedDays = new Map(input.storedDays.map((row) => [key(row.employeeId, row.shiftDate), row] as const));
  const storedOvertime = new Map(input.storedOvertime.map((row) => [key(row.employeeId, row.shiftDate), row] as const));

  const assessed = new Map<string, { day: PersonDay; result: DayAssessment }>();
  for (const day of input.days) {
    const openWork = new Map(day.entries.map((entry) => [entry.entryId, (input.evidence.get(entry.entryId) ?? NO_EVIDENCE).openWorkAtEnd] as const));
    const result = assessDay({ date: day.date, today: input.today, entries: day.entries, unscheduledCount: day.unscheduled.length, openWork, rules });
    if (result) assessed.set(key(day.person.id, day.date), { day, result });
  }

  // Overtime limits need the week's total and the branch's use, so they are worked out over everything first. A week that
  // runs into the neighbouring period counts its days there too (read-only: they add to the week's total, nothing is written).
  const weekOvertime = new Map<string, number>();
  for (const day of input.neighbourDays ?? []) {
    const openWork = new Map(day.entries.map((entry) => [entry.entryId, false] as const));
    const result = assessDay({ date: day.date, today: input.today, entries: day.entries, unscheduledCount: day.unscheduled.length, openWork, rules });
    if (!result?.overtime) continue;
    const k = `${day.person.id}|${weekStart(day.date, weekStartsOn)}`;
    weekOvertime.set(k, (weekOvertime.get(k) ?? 0) + result.overtime.rawMinutes);
  }
  let branchUsed = 0;
  for (const { day, result } of assessed.values()) {
    if (!result.overtime) continue;
    const k = `${day.person.id}|${weekStart(day.date, weekStartsOn)}`;
    weekOvertime.set(k, (weekOvertime.get(k) ?? 0) + result.overtime.rawMinutes);
    if (storedOvertime.get(key(day.person.id, day.date))?.status !== 'DECLINED') branchUsed += result.overtime.autoMinutes + result.overtime.needsMinutes;
  }

  const plan: Plan = { days: [], overtime: [], removals: [], weeks: [], newlyAutoApproved: 0 };
  const changedPeople = new Set<string>();
  const finalStatus = new Map<string, DayRow['status']>();
  const dayFacts = new Map<string, { scheduled: number; worked: number }>();

  for (const [k, { day, result }] of assessed) {
    const employeeId = day.person.id;
    const stored = storedDays.get(k) ?? null;
    let answer: OvertimeAnswer | null = null;

    if (result.overtime) {
      const item = storedOvertime.get(k) ?? null;
      const next = nextOvertime(item, result.overtime);
      const limits = overtimeLimits({
        weekMinutes: weekOvertime.get(`${employeeId}|${weekStart(day.date, weekStartsOn)}`) ?? 0,
        needsMinutes: result.overtime.needsMinutes,
        branchUsedMinutes: branchUsed,
        rules: { weeklyCapMinutes: rules.weeklyCapMinutes, branchBudgetMinutesPerPeriod: rules.branchBudgetMinutesPerPeriod },
      });
      const write: OvertimeWrite = {
        periodId,
        siteId,
        employeeId,
        shiftDate: day.date,
        rawMinutes: result.overtime.rawMinutes,
        serviceTailMinutes: result.overtime.serviceTailMinutes,
        autoMinutes: result.overtime.autoMinutes,
        needsMinutes: result.overtime.needsMinutes,
        authorisedMinutes: next.authorisedMinutes,
        status: next.status,
        evidence: { ...dayEvidence(day, input.evidence), openWorkAtEnd: result.overtime.openWorkAtEnd },
        limits,
        clearDecision: next.clearDecision,
      };
      const same =
        item !== null &&
        item.periodId === periodId &&
        item.status === write.status &&
        item.rawMinutes === write.rawMinutes &&
        item.autoMinutes === write.autoMinutes &&
        item.needsMinutes === write.needsMinutes &&
        item.authorisedMinutes === write.authorisedMinutes &&
        JSON.stringify(item.limits) === JSON.stringify(write.limits) &&
        JSON.stringify(item.evidence) === JSON.stringify(write.evidence);
      if (!same) plan.overtime.push(write);
      if ((next.status === 'APPROVED' || next.status === 'APPROVED_PART' || next.status === 'DECLINED') && item?.decidedById && item.decidedAt) {
        answer = { by: item.decidedById, at: item.decidedAt, reason: item.decisionReason };
      }
    } else if (storedOvertime.has(k)) {
      plan.removals.push({ employeeId, date: day.date });
    }

    const resolved = resolveDay(stored, result, answer);
    const unchanged =
      stored !== null &&
      stored.status === resolved.status &&
      stored.evidenceHash === result.evidenceHash &&
      stored.reasons.join() === resolved.reasons.join() &&
      stored.periodId === periodId &&
      (resolved.decision === 'KEEP' ||
        (resolved.decision === 'CLEAR' && stored.decidedById === null) ||
        (typeof resolved.decision === 'object' && stored.decidedById === resolved.decision.by));
    finalStatus.set(k, resolved.status);
    dayFacts.set(k, { scheduled: result.scheduledMinutes, worked: result.workedMinutes });
    if (unchanged) continue;

    changedPeople.add(employeeId);
    if (resolved.status === 'AUTO_APPROVED' && stored?.status !== 'AUTO_APPROVED') plan.newlyAutoApproved += 1;
    plan.days.push({
      periodId,
      siteId,
      employeeId,
      shiftDate: day.date,
      status: resolved.status,
      reasons: resolved.reasons,
      scheduledMinutes: result.scheduledMinutes,
      workedMinutes: result.workedMinutes,
      minutesLate: result.minutesLate,
      minutesAfterGrace: result.minutesAfterGrace,
      leftEarlyMinutes: result.leftEarlyMinutes,
      afterEndMinutes: result.afterEndMinutes,
      evidenceHash: result.evidenceHash,
      decision: resolved.decision,
    });
  }

  // Weeks follow their days; only people whose days changed get their weeks written again.
  const byWeek = new Map<string, { employeeId: string; weekStart: NairobiDate; statuses: DayRow['status'][]; scheduled: number; worked: number }>();
  for (const [k, status] of finalStatus) {
    const [employeeId, date] = k.split('|') as [string, NairobiDate];
    if (!changedPeople.has(employeeId)) continue;
    const start = weekStart(date, weekStartsOn);
    const week = byWeek.get(`${employeeId}|${start}`) ?? { employeeId, weekStart: start, statuses: [], scheduled: 0, worked: 0 };
    week.statuses.push(status);
    week.scheduled += dayFacts.get(k)?.scheduled ?? 0;
    week.worked += dayFacts.get(k)?.worked ?? 0;
    byWeek.set(`${employeeId}|${start}`, week);
  }
  plan.weeks = [...byWeek.values()].map((w) => ({ employeeId: w.employeeId, weekStart: w.weekStart, status: weekStatus(w.statuses), scheduledMinutes: w.scheduled, workedMinutes: w.worked }));
  return plan;
}
