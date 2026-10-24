import { ValidationError } from '../../../../utils/errors';
import { addDays, instantAt, nairobiToday, parseClockTime, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { onLeaveAt } from '../../leave/reads/away-on';
import { resolveActor } from '../../people/people-context';
import { gridScope } from '../../rota/rota-scope';
import { weeksRepository } from '../../rota/weeks/weeks-repository';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { switchRepository } from '../switch/switch-repository';
import { timeTabRepository } from '../time-tab/time-tab-repository';
import { fixedAfterTheDay, PAST_DAY, whoCanSwitch, type BoardMode } from './board-mode';
import { buildBoard, type BoardView } from './board-view';
import type { BoardQuery } from './board-validators';

export type BoardRead = BoardView & BoardMode;

/**
 * The Today board: who is in, late or not in, by department, as of now. Scope is the rota's: a head sees the departments
 * they head, a Branch or Store Manager their site, HR, the Director and the System Admin the site they name. A past day
 * can be looked at (read only: `readOnly`, no clock-for, past-day wording); a future day cannot. A site whose clock is off
 * answers `enabled: false` and `clock.on: false` with no people, never a board that shows everyone as absent; On leave
 * stays real, because leave does not depend on the clock.
 */
export async function todayBoard(subject: AccessSubject, query: BoardQuery, now: Date = new Date()): Promise<BoardRead> {
  const scope = gridScope(subject, 'today.read', query.siteId);
  const today = nairobiToday(now);
  const date: NairobiDate = query.date ?? today;
  if (date > today) throw new ValidationError('The board shows today and earlier days', 'DATE_IN_FUTURE');
  const readOnly = date < today;
  const departmentIds = scope.kind === 'departments' ? scope.departmentIds : null;

  const [clockOn, siteName, companyId] = await Promise.all([
    switchRepository.isEnabled(scope.siteId),
    timeTabRepository.siteName(scope.siteId),
    resolveActor(subject).then((actor) => actor.companyId),
  ]);
  const away = await onLeaveAt(scope.siteId, companyId, date, departmentIds); // real whether or not the clock is on
  const mode = (fixed: BoardMode['fixedAfterTheDay']): BoardMode => ({
    readOnly,
    actions: { clockFor: !readOnly && clockOn && workforceCan(subject, 'today.act'), fixTime: clockOn && workforceCan(subject, 'time.fix') },
    clock: { on: clockOn, siteName, canSwitch: workforceCan(subject, 'attendance.switch'), whoCanSwitch: whoCanSwitch() },
    pastDay: readOnly ? PAST_DAY : null,
    fixedAfterTheDay: fixed,
  });

  if (!clockOn) {
    return {
      enabled: false,
      siteId: scope.siteId,
      date,
      asOf: '',
      tiles: { onShift: { count: 0, expected: 0 }, late: { count: 0, minutesPastGrace: 0 }, notIn: { count: 0 }, onLeave: { count: away.count, available: true } },
      departments: [],
      people: [],
      attention: [],
      ...mode([]),
    };
  }

  const [people, departments, rules, data] = await Promise.all([
    daysRepository.peopleOnSite(scope.siteId, date, departmentIds),
    weeksRepository.departmentsWithHeads(scope.siteId, departmentIds, toDateColumn(date)),
    attendanceRulesFor(scope.siteId, date),
    daysRepository.loadDayData(scope.siteId, addDays(date, -1), date, null),
  ]);
  const asOf = readOnly ? instantAt(addDays(date, 1), parseClockTime('00:00')) : now; // a past day is judged as it ended
  const view = buildBoard({ siteId: scope.siteId, date, people, departments, data, rules, now: asOf });
  const fixed = readOnly ? fixedAfterTheDay(date, data, new Map(people.map((p) => [p.id, p.name] as const))) : [];
  return {
    ...view,
    asOf: readOnly ? '' : view.asOf, // no "expected by 00:00" on a day that has ended
    tiles: { ...view.tiles, onLeave: { count: away.count, available: true } },
    ...mode(fixed),
  };
}
