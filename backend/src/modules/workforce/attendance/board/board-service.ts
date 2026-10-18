import { ValidationError } from '../../../../utils/errors';
import { addDays, instantAt, nairobiToday, parseClockTime, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { gridScope } from '../../rota/rota-scope';
import { weeksRepository } from '../../rota/weeks/weeks-repository';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { switchRepository } from '../switch/switch-repository';
import { buildBoard, type BoardView } from './board-view';
import type { BoardQuery } from './board-validators';

/**
 * The Today board: who is in, late or not in, by department, as of now. Scope is the rota's: a head sees the departments
 * they head, a Branch or Store Manager their site, HR, the Director and the System Admin the site they name. A past day
 * can be looked at; a future day cannot. A site still on the old clock answers `enabled: false` and no data, never a
 * board that shows everyone as absent.
 */
export async function todayBoard(subject: AccessSubject, query: BoardQuery, now: Date = new Date()): Promise<BoardView> {
  const scope = gridScope(subject, 'today.read', query.siteId);
  const today = nairobiToday(now);
  const date: NairobiDate = query.date ?? today;
  if (date > today) throw new ValidationError('The board shows today and earlier days', 'DATE_IN_FUTURE');

  const empty = (enabled: boolean): BoardView => ({
    enabled,
    siteId: scope.siteId,
    date,
    asOf: '',
    tiles: { onShift: { count: 0, expected: 0 }, late: { count: 0, minutesPastGrace: 0 }, notIn: { count: 0 }, onLeave: { count: 0, available: false } },
    departments: [],
    people: [],
    attention: [],
  });
  if (!(await switchRepository.isEnabled(scope.siteId))) return empty(false);

  const departmentIds = scope.kind === 'departments' ? scope.departmentIds : null;
  const [people, departments, rules, data] = await Promise.all([
    daysRepository.peopleOnSite(scope.siteId, date, departmentIds),
    weeksRepository.departmentsWithHeads(scope.siteId, departmentIds, toDateColumn(date)),
    attendanceRulesFor(scope.siteId, date),
    daysRepository.loadDayData(scope.siteId, addDays(date, -1), date, null),
  ]);
  const asOf = date === today ? now : instantAt(addDays(date, 1), parseClockTime('00:00')); // a past day is judged as it ended
  return buildBoard({ siteId: scope.siteId, date, people, departments, data, rules, now: asOf });
}
