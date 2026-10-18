import type { WorkforceKpiCell } from '../../../../_shared';
import { formatDayMonth, formatDayMonthYear } from '../../../_shared/lib/people-dates';
import type { DepartmentPerson, DepartmentView } from '../../_shared/types/org-types';

/** The words of one department's page (Paper Chapter 3 step 02). Pure. "On shift", "waiting on the head" and "heads on leave" arrive with later slices. */

export const PEOPLE_PER_PAGE = 8;

export function departmentKpis(d: DepartmentView): WorkforceKpiCell[] {
  const positions = d.positions.filter((p) => p.isActive);
  return [
    { key: 'people', label: 'PEOPLE', value: String(d.peoplePage.total), detail: 'on the monthly list' },
    { key: 'casual', label: 'CASUAL POOL', value: String(d.casualPool.total), detail: 'paid by the day, no login' },
    { key: 'waiting', label: 'WAITING ON THE HEAD', value: '–', detail: 'arrives with Approvals' },
    { key: 'positions', label: 'POSITIONS', value: String(positions.length), detail: positions.slice(0, 3).map((p) => p.name).join(', ') || 'none offered yet' },
  ];
}

export const departmentSubtitle = (d: DepartmentView): string => [d.organizationName, d.description].filter(Boolean).join('. ') + (d.description ? '' : '.');

/** "Monthly", "Casual" or "Onboarding": what the Employment column says. */
export function employmentWord(p: DepartmentPerson): string {
  if (p.status === 'ONBOARDING') return 'Onboarding';
  if (p.status === 'NOTICE') return 'On notice';
  return p.payType === 'DAILY_RATE' ? 'Casual' : 'Monthly';
}

export const headSince = (since: string): string => `SINCE ${formatDayMonthYear(since).toUpperCase()}`;

/** The line under the people table when only some are shown. */
export const moreLine = (shown: number, total: number): string => (total > shown ? `${total - shown} more. Open the full list to see everyone.` : '');

export const actingLine = (name: string, returnsOn: string | null): string => `${name} is acting head${returnsOn ? ` until ${formatDayMonth(returnsOn)}` : ''}.`;

export const dailyRateLine = (rate: string | null | undefined): string | null => {
  if (rate === undefined || rate === null) return null;
  const whole = Number(rate);
  return Number.isFinite(whole) ? `KES ${whole.toLocaleString('en-KE')} / day` : null;
};
