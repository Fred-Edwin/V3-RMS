import { nairobiToday } from '../../_shared/time/nairobi-time';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { buildPersonDay } from '../days/person-day';
import { switchRepository } from '../switch/switch-repository';

const OPEN = ['ON_SHIFT', 'PROMPT_DUE', 'STAYING_ON'] as const;

/**
 * The one meaning of "on shift" (owner, 24 Oct 2026): clocked in now and not yet clocked out. "Rostered" is having a shift today;
 * "not started" is rostered and not clocked in yet. My team, Team today and Home all use these three words the same way.
 *
 * Returns the employees who are on shift now at a site, or null while the site is still on the old clock (it has no clock-ins to read,
 * so the caller falls back to "rostered").
 */
export async function employeesOnShiftNow(siteId: string, now: Date = new Date()): Promise<Set<string> | null> {
  if (!(await switchRepository.isEnabled(siteId))) return null;
  const today = nairobiToday(now);
  const [people, rules, data] = await Promise.all([daysRepository.peopleOnSite(siteId, today, null), attendanceRulesFor(siteId, today), daysRepository.loadDayData(siteId, today, today, null)]);
  const inNow = people.filter((person) => buildPersonDay(person, today, data, rules, now).entries.some((e) => OPEN.some((s) => s === e.state) && e.clockedInAt !== null));
  return new Set(inNow.map((person) => person.id));
}
