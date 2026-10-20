import { dayMonthTime, dayOfDate, people } from '../_shared/lib/format';
import type { MonthSite } from '../_shared/types/month-types';

/** The words of one site row in the Timesheets tab (spec S1). */

export type SiteTone = 'success' | 'warning' | 'muted';

export function siteStatus(site: MonthSite): { word: string; tone: SiteTone } {
  switch (site.timesheetState) {
    case 'APPROVED':
      return { word: 'Approved', tone: 'success' };
    case 'NOT_ON_NEW_SYSTEM':
      return { word: 'Not on the new system yet', tone: 'muted' };
    case 'OPEN':
      return { word: 'Waiting', tone: 'warning' };
    case 'TO_APPROVE':
      return { word: 'Waiting', tone: 'warning' };
  }
}

/** The "When" column: "Since 1 Oct · 18 days", "Month not over yet", the approval time with its number, or the old-payslips line. */
export function siteWhen(site: MonthSite): string {
  if (site.timesheetState === 'NOT_ON_NEW_SYSTEM') return 'Paid by the old payslips';
  if (site.timesheetState === 'APPROVED') return [site.approvedAt ? dayMonthTime(site.approvedAt) : null, site.documentNumber].filter(Boolean).join(' · ');
  if (site.timesheetState === 'OPEN') return 'Month not over yet';
  const days = site.waitingDays ?? 0;
  return `Since ${site.waitingSince ? dayOfDate(site.waitingSince) : '—'} · ${days} ${days === 1 ? 'day' : 'days'}`;
}

/** Under the table: how many people are still paid by the old payslips. */
export function oldSystemLine(sites: readonly MonthSite[]): string | null {
  const off = sites.filter((s) => s.timesheetState === 'NOT_ON_NEW_SYSTEM');
  if (off.length === 0) return null;
  return `${people(off.reduce((t, s) => t + s.headcount, 0))} at ${off.map((s) => s.name).join(' and ')} ${off.length === 1 && off[0]!.headcount === 1 ? 'is' : 'are'} still paid by the old payslips.`;
}

/** The reminder button's state: a time when one was sent in the last 24 hours, else the action. */
export function remindWord(site: MonthSite): { canRemind: boolean; reminded: string | null } {
  if (site.timesheetState !== 'TO_APPROVE') return { canRemind: false, reminded: null };
  return { canRemind: site.canRemindNow === true, reminded: site.canRemindNow === false && site.lastReminderAt ? `Reminded ${dayMonthTime(site.lastReminderAt)}` : null };
}
