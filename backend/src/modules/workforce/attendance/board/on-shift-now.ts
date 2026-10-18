import type { DepartmentTag, UserRole } from '@prisma/client';
import { nairobiToday, toDateColumn } from '../../_shared/time/nairobi-time';
import type { OnShiftPerson } from '../attendance.types';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { buildPersonDay } from '../days/person-day';
import { legacyClockRepository } from '../legacy/legacy-clock-repository';
import { switchRepository } from '../switch/switch-repository';
import { onShiftRepository } from './on-shift-repository';

const OPEN = ['ON_SHIFT', 'PROMPT_DUE', 'STAYING_ON'] as const;

/**
 * Who is clocked in now at a place (the kitchen and barista displays). A switched-on site answers from the new clock; any
 * other site answers from the legacy records exactly as before, so the displays behave the same whichever clock a branch uses.
 */
export async function getOnShiftNow(unit: { siteId: string; departmentTag?: DepartmentTag }, role?: UserRole, now: Date = new Date()): Promise<OnShiftPerson[]> {
  const today = nairobiToday(now);
  let found: OnShiftPerson[];
  if (await switchRepository.isEnabled(unit.siteId)) {
    const [people, rules, data] = await Promise.all([
      daysRepository.peopleOnSite(unit.siteId, today, null),
      attendanceRulesFor(unit.siteId, today),
      daysRepository.loadDayData(unit.siteId, today, today, null),
    ]);
    const clockedIn = people
      .filter((person) => person.userId !== null)
      .flatMap((person) => buildPersonDay(person, today, data, rules, now).entries.filter((e) => OPEN.some((s) => s === e.state) && e.clockedInAt).map((e) => ({ userId: person.userId as string, at: e.clockedInAt as Date })));
    const users = new Map((await onShiftRepository.usersByIds(clockedIn.map((c) => c.userId))).map((u) => [u.id, u] as const));
    found = clockedIn.flatMap(({ userId, at }) => {
      const user = users.get(userId);
      return user ? [{ userId, name: user.name, role: user.role, departmentTag: user.departmentTag, clockedInAt: at.toISOString() }] : [];
    });
  } else {
    const records = await legacyClockRepository.openOn(unit.siteId, toDateColumn(today));
    found = records.flatMap((r) => (r.clockInAt ? [{ userId: r.userId, name: r.user.name, role: r.user.role, departmentTag: r.user.departmentTag, clockedInAt: r.clockInAt.toISOString() }] : []));
  }
  return found.filter((p) => (!unit.departmentTag || p.departmentTag === unit.departmentTag) && (!role || p.role === role));
}
