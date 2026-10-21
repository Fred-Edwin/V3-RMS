import type { StatusTagTone } from '../../../_shared';
import { daysBetween, formatDayMonth, formatWeekdayDayMonth, nairobiDay } from '../../_shared/lib/people-dates';
import type { EmployeeFile, FilePart, FileRequestKind } from '../../_shared/types/people-types';

/**
 * What the employee file shows, worked out from the file the API sent. Pure: components draw these, and every button comes from
 * `file.actions` (the server's answer for this viewer), never from a role name. Words follow Paper Chapter 4 and Chapter 2 step 7.
 */

export type FileTabKey = 'overview' | 'job-pay' | 'time' | 'leave' | 'documents' | 'conduct' | 'activity';

export interface FileTab {
  value: FileTabKey;
  label: string;
  /** Time, Leave and Conduct are built by later slices; their tabs are drawn but wait. */
  disabled?: boolean;
}

/** Tabs by what the viewer may see: Job and pay needs pay, Documents needs documents (a Branch Manager has neither). */
export function tabsFor(file: Pick<EmployeeFile, 'locked'>, show: { conduct?: boolean } = {}): FileTab[] {
  const tabs: FileTab[] = [{ value: 'overview', label: 'Overview' }];
  if (!file.locked.includes('pay')) tabs.push({ value: 'job-pay', label: 'Job and pay' });
  tabs.push({ value: 'time', label: 'Time', disabled: true }, { value: 'leave', label: 'Leave', disabled: true });
  if (!file.locked.includes('documents')) tabs.push({ value: 'documents', label: 'Documents' });
  // Conduct (Segment 5): offered only to a reader with `discipline.read` (hidden by omission otherwise). Left out of `show`, it keeps its old "waits" look.
  if (show.conduct === undefined) tabs.push({ value: 'conduct', label: 'Conduct', disabled: true });
  else if (show.conduct) tabs.push({ value: 'conduct', label: 'Conduct' });
  tabs.push({ value: 'activity', label: 'Activity' });
  return tabs;
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

export interface HeaderTag {
  key: string;
  label: string;
  tone: StatusTagTone;
}

/** The tags at the right of the name: status, then employment, then clocking, then the contract. */
export function headerTags(file: EmployeeFile, today: string): HeaderTag[] {
  const tags: HeaderTag[] = [];
  if (file.status === 'EXITED') return [{ key: 'exited', label: 'Exited', tone: 'error' }];
  if (file.status === 'ONBOARDING') tags.push({ key: 'onboarding', label: 'Onboarding', tone: 'warning' });
  if (file.status === 'NOTICE') tags.push({ key: 'notice', label: 'On notice', tone: 'warning' });
  if (file.status === 'ONBOARDING' && file.startDate > today) tags.push({ key: 'starts', label: `Starts ${formatWeekdayDayMonth(file.startDate)}`, tone: 'neutral' });
  if (file.probation && !file.probation.confirmedOn && file.status !== 'ONBOARDING') tags.push({ key: 'probation', label: 'On probation', tone: 'warning' });
  tags.push({ key: 'employment', label: file.employment === 'CASUAL' ? 'Casual' : 'Monthly', tone: 'neutral' });
  if (file.tracksTime) tags.push({ key: 'clocks', label: 'Clocks in', tone: 'neutral' });
  if (file.employment === 'MONTHLY' && file.contractStatus === 'NONE' && file.status === 'ONBOARDING') tags.push({ key: 'contract', label: 'No contract yet', tone: 'neutral' });
  return tags;
}

/** "Barista · Barista department · Nyeri Town · reports to Victor Maina · 0712 345 678" (the phone only when the file has one). */
export function headerLine(file: EmployeeFile): string {
  const parts = [
    file.position?.name,
    file.department ? `${file.department.name} department` : null,
    file.organization.name,
    file.reportsTo ? `reports to ${file.reportsTo.name}` : null,
    file.personalPhone,
  ].filter((p): p is string => Boolean(p));
  return file.status === 'EXITED' ? `${[file.position?.name, file.department ? `${file.department.name} department` : null, file.organization.name].filter(Boolean).join(' · ')} · ${formatDayMonth(file.startDate)}` : parts.join(' · ');
}

const RING_LABELS: Partial<Record<FilePart, string>> = {
  IDENTITY: 'Identity',
  JOB: 'Job',
  PAY: 'Pay',
  BANK: 'Bank',
  CONTRACT: 'Contract',
  EMERGENCY_CONTACT: 'Emergency contact',
};
export const RING_ORDER: readonly FilePart[] = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'CONTRACT', 'EMERGENCY_CONTACT'];

export interface RingChip {
  part: FilePart;
  label: string;
  done: boolean;
}

export function ringChips(file: EmployeeFile): RingChip[] {
  if (!file.completeness) return [];
  return RING_ORDER.flatMap((part) => {
    const found = file.completeness?.parts.find((p) => p.part === part);
    return found && found.applicable ? [{ part, label: RING_LABELS[part] ?? part, done: found.done }] : [];
  });
}

/** "4 OF 6 DONE" over the chips, and the sentence under them. */
export function ringSummary(file: EmployeeFile): { caption: string; note: string } {
  const chips = ringChips(file);
  const done = chips.filter((c) => c.done).length;
  const gaps = chips.length - done;
  const decision = file.probation && !file.probation.confirmedOn ? ` before the ${formatDayMonth(file.probation.endsOn)} probation decision` : '';
  const needsContract = chips.some((c) => c.part === 'CONTRACT' && !c.done);
  const note =
    gaps === 0
      ? 'Nothing is missing from this file.'
      : `${gaps === 1 ? 'One gap' : `${gaps === 2 ? 'Two' : gaps} gaps`}.${needsContract ? ` A contract is needed${decision}.` : ''} Click a gap to fix it.`;
  return { caption: `THE FILE · ${done} OF ${chips.length} DONE`, note };
}

/** The probation card: "Day 80 of 90 · 10 days left", the dates, and the head's report. */
export interface ProbationCard {
  dayNumber: number;
  totalDays: number;
  daysLeft: number;
  startedOn: string;
  endsOn: string;
  report: string | null;
  decideBy: string;
  waitingForContract: boolean;
}

export function probationCard(file: EmployeeFile): ProbationCard | null {
  const p = file.probation;
  if (!p || p.confirmedOn) return null;
  const headNote = p.notes.find((n) => n.authorKind === 'HEAD');
  return {
    dayNumber: p.dayNumber,
    totalDays: p.totalDays,
    daysLeft: p.daysLeft,
    startedOn: file.startDate,
    endsOn: p.endsOn,
    report: headNote ? `Report from ${firstName(headNote.authorName)}: ${headNote.verdict === 'GOOD' ? 'good' : 'concerns'}` : 'No report from the head yet',
    // An ended probation with no decision reads as overdue, not calm (finding 5).
    decideBy: p.endsOn < nairobiDay() ? `Ended ${daysBetween(p.endsOn, nairobiDay())} ${daysBetween(p.endsOn, nairobiDay()) === 1 ? 'day' : 'days'} ago, decision overdue` : `Decide by ${formatDayMonth(p.endsOn)}`,
    waitingForContract: p.confirmationWaitingForContract,
  };
}

/** How long they have been here: "7 mo", "2 mo", "9 days". Calendar days, from the start date. */
export function withWendo(startDate: string, today: string): { value: string; detail: string } {
  const days = Math.max(0, daysBetween(startDate, today));
  const value = days >= 60 ? `${Math.floor(days / 30.4)} mo` : `${days} ${days === 1 ? 'day' : 'days'}`;
  return { value, detail: `joined ${formatDayMonth(startDate)}` };
}

export type FileDialogKey =
  | 'edit-job' | 'change-pay' | 'move' | 'loan' | 'probation' | 'note' | 'contract' | 'upload' | 'rehire' | 'login' | 'details' | 'bank' | 'ask' | 'photo'
  | 'undo-exit' | 'verify' | 'pay-decision';

/** What a file request asked for, in the words of the checklist ("Emergency contact, asked of Joy on 2 Oct"). */
export const REQUEST_LABELS: Record<FileRequestKind, string> = {
  EMERGENCY_CONTACT: 'Emergency contact',
  NSSF_SHA: 'NSSF and SHA numbers',
  PHOTO_AND_DETAILS: 'Photo and personal details',
  ID_NUMBER: 'ID number',
  BANK_DETAILS: 'Bank details',
};

export interface NextStepRow {
  key: string;
  title: string;
  muted?: boolean;
  /** The button, only when the server says the viewer may use it. */
  action: { label: string; dialog: FileDialogKey; requestId?: string } | null;
}

export function nextStepRows(file: EmployeeFile): NextStepRow[] {
  const first = firstName(file.name);
  return file.nextSteps.flatMap((step): NextStepRow[] => {
    if (step.code === 'PROBATION_DECISION') return [{ key: 'probation', title: 'Decide on probation', action: file.actions.decideProbation ? { label: 'Decide', dialog: 'probation' } : null }];
    if (step.code === 'CREATE_CONTRACT') return [{ key: 'contract', title: 'Create the contract', action: file.actions.createContract ? { label: 'Create', dialog: 'contract' } : null }];
    if (step.code === 'FILE_REQUEST') {
      const what = step.fileRequestKind ? REQUEST_LABELS[step.fileRequestKind] : 'A detail';
      const when = step.fileRequestAskedOn ? ` on ${formatDayMonth(step.fileRequestAskedOn)}` : '';
      return [{ key: `request-${step.fileRequestId}`, title: `${what}, asked of ${first}${when}`, muted: true, action: file.actions.remind && step.fileRequestId ? { label: 'Remind', dialog: 'ask', requestId: step.fileRequestId } : null }];
    }
    return [];
  });
}

/** The first gap that blocks payroll or the rota, as the dialog that fixes it. "Finish the file" opens this. */
export function finishTarget(file: EmployeeFile, canWriteSensitive = false): FileDialogKey | null {
  const open = (part: FilePart): boolean => file.completeness?.parts.some((p) => p.part === part && p.applicable && !p.done) ?? false;
  // ID and statutory numbers are HR's (`employee.write_sensitive`); the emergency contact is a basic field a manager may also edit.
  if ((open('IDENTITY') || open('NSSF_SHA')) && canWriteSensitive) return 'details';
  if (open('EMERGENCY_CONTACT') && (canWriteSensitive || file.actions.editJob)) return 'details';
  if (open('PAY') && file.actions.changePay) return 'change-pay';
  if (open('BANK') && file.actions.changePay) return 'bank';
  if (open('LOGIN') && file.actions.createLogin) return 'login';
  if (open('PHOTO_AND_DETAILS') && file.actions.remind) return 'ask';
  if (open('CONTRACT') && file.actions.createContract) return 'contract';
  return null;
}

export const hasFinishStep = (file: EmployeeFile, canWriteSensitive = false): boolean =>
  file.nextSteps.some((s) => s.code === 'FINISH_FILE') && finishTarget(file, canWriteSensitive) !== null;

export interface PageAction {
  key: string;
  label: string;
  dialog: FileDialogKey | 'finish';
  primary?: boolean;
}

/**
 * The buttons in the top bar for each tab (Paper: Overview "Send to another site", "Transfer or exit", "Finish the file"; Job and pay
 * "Transfer or exit", "Change pay"; Documents "Upload a document", "Create contract"; an exited file "Undo exit"). A button is here
 * only when `file.actions` allows it; the brown one is always last.
 */
export function pageActions(file: EmployeeFile, tab: FileTabKey, canWriteSensitive = false): PageAction[] {
  const a = file.actions;
  const out: PageAction[] = [];
  if (file.status === 'EXITED') return a.undoExit ? [{ key: 'undo', label: 'Undo exit', dialog: 'undo-exit', primary: true }] : [];
  const moveOrExit = a.transfer || a.exit;
  if (tab === 'overview') {
    // On notice (exit recorded, last day not yet passed) the Undo toast is gone after 30 seconds; the button stays while the server allows it.
    if (a.undoExit) out.push({ key: 'undo', label: 'Undo exit', dialog: 'undo-exit' });
    if (a.sendToSite) out.push({ key: 'loan', label: 'Send to another site', dialog: 'loan' });
    if (moveOrExit) out.push({ key: 'move', label: 'Transfer or exit', dialog: 'move' });
    if (hasFinishStep(file, canWriteSensitive)) out.push({ key: 'finish', label: 'Finish the file', dialog: 'finish', primary: true });
  }
  if (tab === 'job-pay') {
    if (moveOrExit) out.push({ key: 'move', label: 'Transfer or exit', dialog: 'move' });
    if (a.changePay) out.push({ key: 'pay', label: 'Change pay', dialog: 'change-pay', primary: true });
  }
  if (tab === 'documents') {
    if (a.uploadDocument) out.push({ key: 'upload', label: 'Upload a document', dialog: 'upload' });
    if (a.createContract) out.push({ key: 'contract', label: 'Create contract', dialog: 'contract', primary: true });
  }
  return out;
}

export const TAB_WAITS: Record<'time' | 'leave', string> = {
  time: 'Hours and timesheets appear here when Attendance is built.',
  leave: 'Leave balances and requests appear here when Leave is built.',
};
