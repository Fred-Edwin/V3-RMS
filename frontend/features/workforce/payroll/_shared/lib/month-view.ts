import type { MonthCapabilities, MonthListRow, MonthState, MonthView, StageView, TabKey } from '../types/month-types';
import { dayMonth, kes, monthName, plural } from './format';

/** The pure rules behind the Payroll page: which month opens, which tabs are on, what the one brown button says, how a stage reads. */

export const TAB_LABELS: Record<TabKey, string> = {
  timesheets: 'Timesheets',
  rules: 'Rules applied',
  tax: 'Tax and deductions',
  casual: 'Casual pay',
  totals: 'Totals',
  payslips: 'Payslips',
};
export const TAB_ORDER: readonly TabKey[] = ['timesheets', 'rules', 'tax', 'casual', 'totals', 'payslips'];
export const TAB_OFF_REASON = 'Available once the month is calculated';

export const isTab = (value: string | null): value is TabKey => value !== null && (TAB_ORDER as readonly string[]).includes(value);

/** The month that needs someone: the oldest that is not Paid (the list is newest first), else the newest. */
export function defaultMonth(rows: readonly MonthListRow[]): string | null {
  const unpaid = rows.filter((r) => r.state !== 'PAID');
  return (unpaid[unpaid.length - 1] ?? rows[0])?.monthKey ?? null;
}

/** The tab to show: the one asked for if it is on, else Timesheets. */
export const activeTab = (asked: string | null, enabled: readonly TabKey[]): TabKey => (isTab(asked) && enabled.includes(asked) ? asked : 'timesheets');

export const STATE_TAG: Record<MonthState, { tone: 'neutral' | 'warning' | 'success'; label: string }> = {
  OPEN: { tone: 'neutral', label: 'Open' },
  WAITING: { tone: 'warning', label: 'Waiting' },
  IN_REVIEW: { tone: 'warning', label: 'In review' },
  TO_APPROVE: { tone: 'warning', label: 'To approve' },
  TO_PUBLISH: { tone: 'warning', label: 'To publish' },
  PUBLISHED: { tone: 'warning', label: 'To pay' },
  PAID: { tone: 'success', label: 'Paid' },
};

/** The grey line under a month in the list (S-shell table). */
export function listLine(row: MonthListRow): string {
  const net = row.netPay ? `net ${kes(row.netPay)}` : '';
  switch (row.state) {
    case 'OPEN':
      return row.estimate ? `Earned so far: ${kes(row.estimate.earnedSoFar)}` : 'Not worked out yet';
    case 'WAITING':
      return `${row.sitesApproved.approved} of ${row.sitesApproved.total} sites approved`;
    case 'IN_REVIEW':
      return `Calculated · ${net}`;
    case 'TO_APPROVE':
      return `Reviewed by HR · ${net}`;
    case 'TO_PUBLISH':
      return `Approved · ${net}`;
    case 'PUBLISHED':
      return `Published · ${net}`;
    case 'PAID':
      return `Paid · ${net}`;
  }
}

export type HeaderAction = 'SEND' | 'APPROVE' | 'PUBLISH' | 'MARK_PAID';

/** The one brown button for this month and viewer, from the server's capabilities (never a role name). */
export function headerAction(state: MonthState, can: MonthCapabilities): HeaderAction | null {
  if (state === 'IN_REVIEW' && can.canSendToAccountant) return 'SEND';
  if (state === 'TO_APPROVE' && can.canApprove) return 'APPROVE';
  if (state === 'TO_PUBLISH' && can.canPublish) return 'PUBLISH';
  if (state === 'PUBLISHED' && can.canPay) return 'MARK_PAID';
  return null;
}

export function headerActionLabel(action: HeaderAction, monthKey: string): string {
  switch (action) {
    case 'SEND':
      return 'Send to the Accountant';
    case 'APPROVE':
      return 'Approve the payroll';
    case 'PUBLISH':
      return 'Publish the payslips';
    case 'MARK_PAID':
      return `Mark ${monthName(monthKey)} as paid`;
  }
}

/** Why the Send button is off, as text under it; null when it can be pressed. */
export function sendBlockedReason(open: number, blocking: number): string | null {
  if (blocking > 0) return blocking === 1 ? 'Resolve the 1 line that blocks the month.' : `Resolve the ${blocking} lines that block the month.`;
  if (open > 0) return `Check the ${plural(open, 'line')} still open.`;
  return null;
}

/** The stage line's caption under each name (S-shell). */
export function stageCaption(stage: StageView): string | null {
  if (stage.status === 'TODO') return null;
  const when = stage.at ? dayMonth(stage.at) : null;
  if (stage.key === 'TIMESHEETS') return stage.text;
  if (stage.status === 'CURRENT') return stage.text ?? (stage.who ? `${stage.who} to act` : null);
  return [stage.who, when].filter(Boolean).join(' · ') || null;
}

/** What a screen reader hears for one stage: "Stage 3 of 6, Reviewed, in progress, HR, 5 lines". */
export function stageSpoken(stage: StageView): string {
  const status = stage.status === 'DONE' ? 'done' : stage.status === 'CURRENT' ? 'in progress' : 'to come';
  return ['Stage ' + stage.number + ' of 6', stage.name, status, stageCaption(stage)].filter(Boolean).join(', ');
}

/** True when the month can no longer change. */
export const isLocked = (view: Pick<MonthView, 'state' | 'lockedAt'>): boolean => view.state === 'PAID' || Boolean(view.lockedAt);

/** The server's words for the codes a payroll write can answer, so a refusal reads in plain English and offers the right next step. */
export const REFUSAL_WORDS: Record<string, string> = {
  CHANGED_UNDERNEATH: 'This changed while you were looking. Check it again.',
  PAYSLIP_CHANGED: 'This payslip changed while you were looking. Check it again.',
  PIN_INVALID: 'That PIN is not right.',
  PIN_LOCKED: 'Too many wrong PINs. Wait ten minutes and try again.',
  MONTH_LOCKED: 'This month is paid and locked. Nothing can be changed now.',
  ALREADY_PAID: 'Someone marked this month paid a moment ago.',
  ALREADY_PUBLISHED: 'Someone published this month a moment ago.',
  ALREADY_APPROVED: 'Someone approved this month a moment ago.',
  SELF_APPROVAL: 'You prepared this month, so someone else must approve it.',
  SELF_CORRECTION: 'You cannot correct your own payslip. The other payroll role does it.',
  BANK_FILE_REQUIRED: 'Download the bank file first.',
  BANK_FILE_CHANGED: 'The bank file changed after you opened this. Download the new one.',
  PEOPLE_CANNOT_BE_PAID: 'Some people have no bank account. Fix that first.',
  BLOCKING_LINES: 'A line still blocks the month. Resolve it first.',
  HAND_CHECK_REQUIRED: 'Tick that you checked at least 3 payslips by hand.',
  NO_CHANGE: 'This changes nothing.',
  NEGATIVE_NET: 'This would make the net pay negative.',
  EXPORT_TOO_LARGE: 'This month is too big to export in one go. Ask the developer.',
  EXPORT_RATE_LIMIT: 'Too many exports just now. Wait a few minutes and try again.',
  BANK_FILE_RATE_LIMIT: 'Too many downloads just now. Wait a few minutes and try again.',
  EXPORT_TOO_SLOW: 'The file took too long to make. Try again.',
  REMINDED_RECENTLY: 'That site was reminded in the last 24 hours.',
};

/** Codes after which the screen should reload what it shows, because the month moved. */
export const STALE_CODES: readonly string[] = ['CHANGED_UNDERNEATH', 'PAYSLIP_CHANGED', 'BANK_FILE_CHANGED', 'MONTH_LOCKED', 'ALREADY_PAID', 'ALREADY_PUBLISHED', 'ALREADY_APPROVED'];

export const refusalWords = (code: string, serverMessage: string): string => REFUSAL_WORDS[code] ?? (serverMessage || 'That did not go through. Nothing was changed.');
