import { addDays, formatDayMonth, formatWeekdayDayMonth } from '../../_shared/lib/people-dates';
import type { ExitBody, LoanBody, RehireBody, TransferBody } from '../../_shared/types/people-requests';
import type { EmployeeFile, ExitReason, ImpactLine, Lookups, MovePreview } from '../../_shared/types/people-types';
import { hasErrors, monthName, type Errors } from './dialog-forms';

/** The Move dialog (transfer or exit), Send to another site, and Rehire: their forms, checks, bodies and the "what changes" lines. */

// ---- transfer (W15, W16) ----------------------------------------------------------------------
export interface TransferForm {
  toSiteId: string;
  toDepartmentId: string;
  /** Empty keeps the position (Paper: "Barista (unchanged)"). */
  toPositionId: string;
  startsOn: string;
}

export function validateTransfer(f: TransferForm, file: Pick<EmployeeFile, 'organization' | 'department'>, today: string): Errors<TransferForm> {
  const errors: Errors<TransferForm> = {};
  if (!f.toSiteId) errors.toSiteId = 'Choose where they move to.';
  if (!f.toDepartmentId) errors.toDepartmentId = 'Choose the department.';
  if (f.toSiteId === file.organization.id && f.toDepartmentId === file.department?.id) errors.toDepartmentId = 'They are already in that department.';
  if (!f.startsOn) errors.startsOn = 'Pick the day it starts.';
  else if (f.startsOn < today) errors.startsOn = 'It cannot start in the past.';
  return errors;
}

export const toTransferBody = (f: TransferForm): TransferBody => ({
  toSiteId: f.toSiteId,
  toDepartmentId: f.toDepartmentId,
  startsOn: f.startsOn,
  ...(f.toPositionId ? { toPositionId: f.toPositionId } : {}),
});
export const transferReady = (f: TransferForm, file: Pick<EmployeeFile, 'organization' | 'department'>, today: string): boolean => !hasErrors(validateTransfer(f, file, today));

/** A line from a later slice's impact ("5 shifts removed"): the code in words until that slice writes its own sentence. */
export function impactText(line: ImpactLine): string {
  const words = line.code.toLowerCase().replace(/_/g, ' ');
  return line.count === null ? words : `${line.count} ${words}`;
}

export const longDate = (date: string): string => `${Number(date.split('-')[2])} ${monthName(date)}`;

/** The "what changes" list of a transfer: the new head, then what stays, then who is told. */
export function transferLines(preview: MovePreview, first: string): string[] {
  const lines = preview.impacts.map(impactText);
  if (preview.newReportsTo) lines.push(`${first}'s requests and overtime now go to ${preview.newReportsTo.name}.`);
  lines.push('Pay, leave balance and probation date do not change.');
  return lines;
}

export function toldLine(preview: MovePreview | null, fallback: string): string {
  if (!preview || preview.notified.length === 0) return fallback;
  const names = preview.notified.map((n) => n.name).filter(Boolean);
  return names.length === 0 ? fallback : `${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} told. Written to the audit log with the date.`;
}

// ---- exit (W19 to W22) ------------------------------------------------------------------------
export interface ExitForm {
  lastDay: string;
  reason: ExitReason | '';
  uniformReturned: boolean;
  note: string;
}

export function validateExit(f: ExitForm, today: string): Errors<ExitForm> {
  const errors: Errors<ExitForm> = {};
  if (!f.lastDay) errors.lastDay = 'Pick the last day.';
  else if (f.lastDay < addDays(today, -7)) errors.lastDay = 'The last day cannot be more than a week ago.';
  if (f.reason === '') errors.reason = 'Choose a reason.';
  if (f.reason === 'OTHER' && f.note.trim() === '') errors.note = 'Say what the reason is.';
  return errors;
}

export const toExitBody = (f: ExitForm): ExitBody => ({
  lastDay: f.lastDay,
  reason: f.reason as ExitReason,
  uniformReturned: f.uniformReturned,
  ...(f.note.trim() ? { note: f.note.trim() } : {}),
});

export function exitLines(lastDay: string, undoDays: number, preview: MovePreview | null): string[] {
  const day = lastDay ? longDate(lastDay) : 'the last day';
  return [
    ...(preview?.impacts.map(impactText) ?? []),
    `Their login stops at midnight on ${day}. They leave the rota, and their shifts after that day are cleared.`,
    'The file stays, marked Exited, with all history. Nothing is deleted.',
    `Mistakes can be undone for ${undoDays} days. After that, use Rehire.`,
  ];
}

// ---- send to another site (W17) ---------------------------------------------------------------
export type LoanMode = 'today' | 'until' | 'back';
export interface LoanForm {
  toSiteId: string;
  mode: LoanMode;
  until: string;
}

export function validateLoan(f: LoanForm, today: string): Errors<LoanForm> {
  const errors: Errors<LoanForm> = {};
  if (!f.toSiteId) errors.toSiteId = 'Choose the site.';
  if (f.mode === 'until') {
    if (!f.until) errors.until = 'Pick the last day there.';
    else if (f.until < today) errors.until = 'That day has passed.';
  }
  return errors;
}

export function toLoanBody(f: LoanForm, today: string): LoanBody {
  return { toSiteId: f.toSiteId, from: today, until: f.mode === 'today' ? today : f.mode === 'until' ? f.until : null };
}

export function loanLines(f: LoanForm, siteName: string, homeName: string, first: string, today: string): string[] {
  const ends =
    f.mode === 'back'
      ? `It runs until you bring ${first} back from their file.`
      : `It ends by itself after ${formatWeekdayDayMonth(f.mode === 'today' ? today : f.until || today)} and ${first} goes back to ${homeName}. No approval is needed.`;
  return [
    `${first} can clock in at ${siteName || 'that site'} from now, on that site's rota or as an extra.`,
    `The Branch Manager there sees ${first} on their Today board. Pay, leave and approvals stay with ${first}'s own head.`,
    ends,
  ];
}

// ---- rehire (W23) -----------------------------------------------------------------------------
export interface RehireForm {
  startsOn: string;
}

export function validateRehire(f: RehireForm, today: string): Errors<RehireForm> {
  if (!f.startsOn) return { startsOn: 'Pick the new start day.' };
  return f.startsOn < today ? { startsOn: 'It cannot start in the past.' } : {};
}
export const toRehireBody = (f: RehireForm): RehireBody => ({ startsOn: f.startsOn });

// ---- choices ----------------------------------------------------------------------------------
export function transferSites(lookups: Lookups, currentSiteId: string): { value: string; label: string }[] {
  return lookups.organizations.filter((o) => o.id !== currentSiteId || lookups.departments.some((d) => d.organizationId === o.id && d.isActive)).map((o) => ({ value: o.id, label: o.name }));
}

export const dayLabel = (date: string): string => formatDayMonth(date);
