import { NotFoundError } from '../../../../utils/errors';
import { addDays, weekStart, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { attendanceRulesFor } from '../../attendance/days/day-rules';
import { daysRepository } from '../../attendance/days/days-repository';
import { personInScope } from '../../attendance/attendance-scope';
import { weekRulesFor } from '../assemble/assemble-service';
import type { Decider } from '../approval/decided-by';
import { dayFactsOf } from '../months/people/person-day-facts';
import { periodsRepository } from '../periods/periods-repository';
import { decisionCapability } from '../timesheets-scope';
import type { OvertimeRow } from '../timesheets.types';
import { overtimeRepository } from './overtime-repository';
import { partRange } from './overtime-plan';

export interface OvertimeDetail {
  id: string;
  version: number;
  status: OvertimeRow['status'];
  shiftDate: NairobiDate;
  person: { id: string; name: string; role: string | null; department: string | null };
  site: { id: string; name: string };
  plannedStart: string | null;
  plannedEnd: string | null;
  workedStart: string | null;
  workedEnd: string | null;
  /** Minutes worked after the shift end that needed a decision; `autoMinutes` were covered by the service tail. */
  extraMinutes: number;
  autoMinutes: number;
  authorisedMinutes: number;
  part: { min: number; max: number; step: number } | null;
  /** Counts only; never takings. */
  evidence: {
    reasonGiven: string | null;
    openWork: { at: string | null; orders: number } | null;
    colleagues: { team: string | null; rostered: number; present: number };
    ordersTaken: number;
    ticketsCleared: number;
    askedInAdvance: boolean;
    headNote: { by: Decider | null; text: string; at: string } | null;
  };
  limits: { weekMinutes: number; weekCapMinutes: number | null; monthMinutes: number; branchWeekMinutes: number; branchBudgetMinutes: number | null; branchUsedMinutes: number };
  decision: { by: Decider | null; at: string; reason: string | null } | null;
  month: { state: 'OPEN' | 'APPROVED' };
  /** The viewer may decide it now (right capability, not their own, month not approved). */
  canDecide: boolean;
  canNote: boolean;
}

/**
 * One overtime item with the evidence beside it (spec S6): planned and worked times, why from the record, the limits. Reads only;
 * the evidence is counts, never the takings of any order.
 */
export async function overtimeDetail(subject: AccessSubject, id: string): Promise<OvertimeDetail> {
  const item = await overtimeRepository.byIdAnywhere(id);
  if (!item) throw new NotFoundError('Overtime not found');
  const person = await personInScope(subject, 'timesheet.read', item.employeeId, 'read');
  const period = await periodsRepository.find(item.siteId, item.periodId);
  if (!period) throw new NotFoundError('Period not found');
  const [data, rules, week, site] = await Promise.all([
    daysRepository.loadDayData(item.siteId, item.shiftDate, item.shiftDate, null),
    attendanceRulesFor(item.siteId, item.shiftDate),
    weekRulesFor(item.siteId, item.shiftDate),
    periodsRepository.siteName(item.siteId),
  ]);
  const mine = { ...data, entries: data.entries.filter((e) => e.employeeId === item.employeeId), events: data.events.filter((e) => e.employeeId === item.employeeId) };
  const facts = dayFactsOf(item.employeeId, [item.shiftDate], mine, rules, new Date()).get(item.shiftDate);
  const entry = mine.entries[0];
  const answer = entry ? data.answers.find((a) => a.rotaEntryId === entry.id) : undefined;

  const colleagueIds = [...new Set(data.entries.map((e) => e.employeeId))];
  const colleagues = (await daysRepository.peopleByIds(item.siteId, colleagueIds)).filter((p) => p.departmentId !== null && p.departmentId === person.departmentId);
  const present = new Set(data.events.filter((e) => e.type === 'IN').map((e) => e.employeeId));

  const weekFrom = weekStart(item.shiftDate, week.weekStartsOn);
  const [monthItems, weekItems] = await Promise.all([overtimeRepository.ofPerson(item.siteId, item.employeeId, period.start, period.end), overtimeRepository.inRange(item.siteId, weekFrom, addDays(weekFrom, 6))]);
  const sum = (list: readonly OvertimeRow[]): number => list.reduce((total, row) => total + row.rawMinutes, 0);

  const ids = [item.decidedById, item.headNote?.byId].filter((v): v is string => typeof v === 'string');
  const names = await periodsRepository.people(ids);
  const ownerUserId = person.userId;
  const ownerRole = ownerUserId ? ((await periodsRepository.people([ownerUserId])).get(ownerUserId)?.role ?? null) : null;
  const capability = decisionCapability(ownerRole, 'overtime.approve');
  const sameSite = scopeOf(subject, capability) === 'all' || subject.siteId === item.siteId;
  const open = period.state !== 'APPROVED';

  return {
    id: item.id,
    version: item.version,
    status: item.status,
    shiftDate: item.shiftDate,
    person: { id: person.id, name: person.name, role: ownerRole, department: person.departmentName },
    site: { id: item.siteId, name: site },
    plannedStart: facts?.plannedStart ?? entry?.startTime ?? null,
    plannedEnd: facts?.plannedEnd ?? entry?.endTime ?? null,
    workedStart: facts?.clockIn ?? null,
    workedEnd: facts?.clockOut ?? null,
    extraMinutes: item.needsMinutes,
    autoMinutes: item.autoMinutes,
    authorisedMinutes: item.authorisedMinutes,
    part: item.needsMinutes > 0 ? (() => { const r = partRange(item.needsMinutes); return r ? { ...r, step: 5 } : null; })() : null,
    evidence: {
      reasonGiven: answer?.reasonCode ?? null,
      openWork: item.evidence.openWorkAtEnd ? { at: facts?.plannedEnd ?? entry?.endTime ?? null, orders: item.evidence.openOrdersAtEnd } : null,
      colleagues: { team: person.departmentName, rostered: colleagues.filter((p) => data.entries.some((e) => e.employeeId === p.id)).length, present: colleagues.filter((p) => present.has(p.id)).length },
      ordersTaken: item.evidence.ordersTaken,
      ticketsCleared: item.evidence.ticketsCleared,
      askedInAdvance: false,
      headNote: item.headNote ? { by: names.get(item.headNote.byId) ?? null, text: item.headNote.text, at: item.headNote.at } : null,
    },
    limits: {
      weekMinutes: item.limits.weekMinutes,
      weekCapMinutes: item.limits.weeklyCapMinutes,
      monthMinutes: sum(monthItems),
      branchWeekMinutes: sum(weekItems),
      branchBudgetMinutes: item.limits.branchBudgetMinutes,
      branchUsedMinutes: item.limits.branchUsedMinutes,
    },
    decision: item.decidedById && item.decidedAt ? { by: names.get(item.decidedById) ?? null, at: item.decidedAt.toISOString(), reason: item.decisionReason } : null,
    month: { state: open ? 'OPEN' : 'APPROVED' },
    canDecide: open && item.needsMinutes > 0 && scopeOf(subject, capability) !== null && sameSite && person.userId !== subject.id,
    canNote: open && item.status === 'PENDING' && item.headNote === null && scopeOf(subject, 'overtime.note') !== null,
  };
}
