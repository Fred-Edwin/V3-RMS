import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import type { AttendanceRuleSet } from '../attendance.types';

/** The ATTENDANCE and LATENESS rule values in force for a site on a day (a site override of lateness wins). */
export async function attendanceRulesFor(siteId: string, date: NairobiDate): Promise<AttendanceRuleSet> {
  const [attendance, lateness] = await Promise.all([
    getEffectiveRuleGroup(siteId, date, 'ATTENDANCE'),
    getEffectiveRuleGroup(siteId, date, 'LATENESS'),
  ]);
  return { attendance: attendance.values, lateness: lateness.values };
}
