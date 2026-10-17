import type { KeyValueRow } from '../../../_shared';
import { daysBetween, formatDayMonth, formatDayMonthYear, formatFullDate, formatKes, formatWeekdayDayMonth } from '../../_shared/lib/people-dates';
import type { EmployeeFile, ExitReason, PayChangeReason, PayChangeRow, PayView } from '../../_shared/types/people-types';
import { firstName } from './file-model';

/**
 * The label-and-value rows of the file screen, worked out from what the API sent. Pure, so each wording is tested once. Where Paper
 * says "she/her" these say the first name or "they": no pronouns are on file.
 */

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  RESIGNED: 'Resigned',
  END_OF_CONTRACT: 'End of contract',
  DISMISSED: 'Dismissed',
  REDUNDANCY: 'Redundancy',
  RETIRED: 'Retired',
  OTHER: 'Other',
};
export const PAY_REASON_LABELS: Record<PayChangeReason, string> = {
  HIRING: 'Hiring',
  PROBATION_CONFIRMED: 'Probation confirmed',
  PROMOTION: 'Promotion',
  ANNUAL_REVIEW: 'Annual review',
  CORRECTION: 'Correction',
  OTHER: 'Other',
};
const LOGIN_ROLE_LABELS: Record<string, string> = {
  WAITER: 'Waiter', CHEF: 'Chef', BARISTA: 'Barista', STEWARD: 'Steward', HOUSEKEEPING: 'Housekeeping', STORE_ATTENDANT: 'Store attendant',
  MANAGER: 'Branch Manager', STORE_MANAGER: 'Store Manager', ACCOUNTANT: 'Accountant', HR_MANAGER: 'HR Manager', DIRECTOR: 'Director',
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const LOCKED_NOTE = 'Locked for your role';

/** The "Job" panel on Job and pay, and the short list on an onboarding file. */
export function jobRows(file: EmployeeFile): KeyValueRow[] {
  const onProbation = file.probation && !file.probation.confirmedOn && file.status !== 'ONBOARDING';
  const employment = file.employment === 'CASUAL' ? 'Casual, daily' : onProbation ? 'Monthly, on probation' : 'Monthly';
  return [
    { label: 'Position', value: file.position?.name ?? 'Not set' },
    { label: 'Department', value: file.department ? `${file.department.name} · ${file.organization.name}` : file.organization.name },
    { label: 'Reports to', value: file.reportsTo ? `${file.reportsTo.name}${file.reportsTo.isHead ? ' (head)' : ''}` : 'Nobody yet', tone: file.reportsTo ? 'default' : 'muted' },
    { label: 'Employment', value: employment },
    { label: 'Started', value: formatDayMonthYear(file.startDate), mono: true },
    { label: 'Clocks in and out', value: file.tracksTime ? (file.tracksTimeFromPosition ? 'Yes, from their position' : 'Yes, set on this file') : 'No' },
    { label: 'Login role', value: file.hasLogin ? (LOGIN_ROLE_LABELS[file.loginRole ?? ''] ?? file.loginRole ?? 'Has a login') : 'No login', tone: file.hasLogin ? 'default' : 'muted' },
  ];
}

/** "Job and leave" beside the onboarding checklist (Paper `SBM-0`). */
export function jobLeaveRows(file: EmployeeFile): KeyValueRow[] {
  const contract = file.contractStatus === 'ACTIVE' ? 'Monthly, contract on file' : file.employment === 'CASUAL' ? 'Casual, daily' : 'Monthly, no contract yet';
  const rows: KeyValueRow[] = [
    { label: 'Position', value: file.position?.name ?? 'Not set' },
    { label: 'Employment', value: contract },
    { label: 'Tracks time', value: file.tracksTime ? 'Yes' : 'No' },
  ];
  if (file.employment === 'MONTHLY') rows.push({ label: 'Annual leave', value: 'Default policy', mono: true });
  if (file.probation) rows.push({ label: 'Probation ends', value: formatFullDate(file.probation.endsOn) });
  return rows;
}

/** "About {first}" for someone who may not see pay or IDs: phone, emergency contact, then the locked rows. */
export function aboutRows(file: EmployeeFile): KeyValueRow[] {
  const rows: KeyValueRow[] = [
    { label: 'Phone', value: file.personalPhone ?? 'Not added yet', mono: Boolean(file.personalPhone), tone: file.personalPhone ? 'default' : 'warning' },
    {
      label: 'Emergency contact',
      value: file.emergencyContact ? `${file.emergencyContact.name}${file.emergencyContact.relation ? ` (${file.emergencyContact.relation})` : ''} · ${file.emergencyContact.phone}` : 'Not added yet',
      tone: file.emergencyContact ? 'default' : 'warning',
    },
  ];
  if (file.locked.includes('ids')) rows.push({ label: 'National ID', value: LOCKED_NOTE, tone: 'muted' });
  if (file.locked.includes('pay')) rows.push({ label: 'Pay and bank', value: LOCKED_NOTE, tone: 'muted' });
  return rows;
}

export const ABOUT_NOTE = 'You see the job, time, leave and conduct of your own site. HR and the Accountant see pay. Your openings of this file are logged.';

/** "The exit" panel on an exited file. */
export function exitRows(file: EmployeeFile): KeyValueRow[] {
  const exit = file.exit;
  if (!exit) return [];
  const [, month] = exit.lastDay.split('-');
  const monthName = MONTHS[Number(month) - 1] ?? '';
  return [
    { label: 'Last day', value: formatFullDate(exit.lastDay), mono: true },
    { label: 'Reason', value: EXIT_REASON_LABELS[exit.reason] },
    { label: 'Final pay', value: `In the ${monthName} pay run`, tone: 'success' },
    { label: 'Uniform and keys', value: exit.uniformReturned ? 'Returned' : 'Not yet returned', tone: exit.uniformReturned ? 'success' : 'warning' },
    { label: 'Exited by', value: `${exit.exitedByName ?? 'Someone'}${exit.recordedOn ? ` · ${formatDayMonth(exit.recordedOn)}` : ''}` },
  ];
}

export interface ExitBanner {
  title: string;
  line: string;
  daysLeft: number;
  canUndo: boolean;
}

/** The sand banner at the top of an exited file. `daysLeft` counts to the last day you can undo. */
export function exitBanner(file: EmployeeFile, today: string): ExitBanner | null {
  const exit = file.exit;
  if (!exit) return null;
  const first = firstName(file.name);
  const daysLeft = Math.max(0, daysBetween(today, exit.undoUntil));
  const until = formatWeekdayDayMonth(exit.undoUntil);
  const after = formatDayMonth(exit.undoUntil);
  return {
    title: exit.canUndo ? `${first} left on ${formatWeekdayDayMonth(exit.lastDay)}. You can still undo this until ${until}.` : `${first} left on ${formatWeekdayDayMonth(exit.lastDay)}. The undo window has closed.`,
    line: exit.canUndo
      ? `Undoing restores their login, their rota shifts and their place in the department, exactly as before. After ${after} the same file is reopened with Rehire instead.`
      : 'The same file is reopened with Rehire. Their old pay, leave and history stay.',
    daysLeft,
    canUndo: exit.canUndo,
  };
}

/** The pay amount in force, and the day it starts when that day has not come yet (the owner's rule: never show a future amount as today's). */
export function payAmountLine(pay: PayView, today: string): { text: string; startsOn: string | null } {
  if (!pay.amount) return { text: 'Not set yet', startsOn: null };
  const unit = pay.payType === 'DAILY_RATE' ? 'day' : 'month';
  const approved = pay.history.filter((h) => h.status === 'APPROVED');
  const inForce = approved.some((h) => h.effectiveFrom <= today);
  const next = approved.filter((h) => h.effectiveFrom > today).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  const startsOn = !inForce && next ? next.effectiveFrom : null;
  return { text: `${formatKes(pay.amount)} / ${unit}`, startsOn };
}

export function payRows(pay: PayView, contractStatus: EmployeeFile['contractStatus'], today: string): KeyValueRow[] {
  const line = payAmountLine(pay, today);
  const monthly = pay.payType === 'MONTHLY_SALARY';
  return [
    { label: 'Basic pay', value: line.startsOn ? `${line.text} · starts ${formatWeekdayDayMonth(line.startsOn)}` : line.text, mono: true, tone: line.startsOn ? 'warning' : 'default' },
    { label: 'Statutory deductions', value: monthly ? 'NSSF, SHIF, Housing levy, PAYE' : 'None on a daily rate' },
    { label: 'Overtime rule', value: pay.overtimeEligible ? 'Company standard · set by the Director' : 'Not eligible for overtime', tone: pay.overtimeEligible ? 'default' : 'muted' },
    { label: 'Lateness rule', value: monthly && contractStatus === 'NONE' ? 'Company default · no contract yet' : 'Company default · set by the Director', tone: monthly && contractStatus === 'NONE' ? 'warning' : 'default' },
  ];
}

export interface PayHistoryLine {
  id: string;
  from: string;
  amount: string;
  by: string;
  reason: string;
  tone: 'success' | 'warning' | 'error' | 'muted';
}

/** Newest first; a waiting, declined or cancelled change says so next to its reason. */
export function payHistoryLines(history: PayChangeRow[]): PayHistoryLine[] {
  return [...history]
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    .map((h) => ({
      id: h.id,
      from: formatDayMonthYear(h.effectiveFrom),
      amount: formatKes(h.amount),
      by: h.requestedByName ?? 'System',
      reason: h.status === 'APPROVED' ? PAY_REASON_LABELS[h.reason] : `${PAY_REASON_LABELS[h.reason]} · ${h.status === 'PENDING' ? 'waiting for the Director' : h.status === 'DECLINED' ? 'declined' : 'cancelled'}`,
      tone: h.status === 'APPROVED' ? 'success' : h.status === 'PENDING' ? 'warning' : h.status === 'DECLINED' ? 'error' : 'muted',
    }));
}

export type OverviewVariant = 'exited' | 'onboarding' | 'branch' | 'hr';

/** Which Overview to draw. A viewer who may not see the file's completeness (no pay, bank or IDs) gets the site view. */
export function overviewVariant(file: EmployeeFile): OverviewVariant {
  if (file.status === 'EXITED') return 'exited';
  if (file.completeness === null) return 'branch';
  return file.status === 'ONBOARDING' ? 'onboarding' : 'hr';
}

/** A masked value for display: the API sends "•••• 5678"; a value that is not there reads "Not on file". */
export const maskedOrMissing = (value: string | null | undefined): string => (value ? value : 'Not on file');
