import type { HomeKpi } from '../types/role-home-types';

/**
 * Home draws only what the menu can reach. While the branch's new clock is off, the menu has no Leave, Timesheets, Shifts or Today board
 * (the `needsAttendance` rows), so a number that only counts work there is left out and a number that merely links there stops linking.
 */
const TIME_PREFIXES: readonly string[] = ['/app/workforce/leave', '/app/workforce/timesheets', '/app/workforce/schedule', '/app/workforce/today'];
const WORK_CARDS: readonly string[] = ['leave-waiting', 'timesheets'];

const isTimeHref = (href: string | null): boolean => href !== null && TIME_PREFIXES.some((p) => href === p || href.startsWith(`${p}/`) || href.startsWith(`${p}?`));

export function reachableKpis(kpis: readonly HomeKpi[], attendanceOn: boolean): HomeKpi[] {
  if (attendanceOn) return [...kpis];
  return kpis.filter((k) => !WORK_CARDS.includes(k.key)).map((k) => (isTimeHref(k.href) ? { ...k, href: null } : k));
}
