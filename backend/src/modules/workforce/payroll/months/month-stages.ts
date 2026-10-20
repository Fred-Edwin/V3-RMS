import type { PayrollMonthState } from '@prisma/client';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';

/** The state as the list and the page show it. OPEN has no row (the month has not ended). */
export type MonthStage = 'OPEN' | PayrollMonthState;

export type StageStatus = 'DONE' | 'CURRENT' | 'TODO';
export interface StageView {
  key: 'TIMESHEETS' | 'CALCULATED' | 'REVIEWED' | 'APPROVED' | 'PUBLISHED' | 'PAID';
  number: number;
  name: string;
  status: StageStatus;
  who: string | null;
  at: string | null;
  text: string | null;
}

export interface StageFacts {
  sitesApproved: { approved: number; total: number };
  calculatedAt: Date | null;
  sentAt: Date | null;
  reviewedBy: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  openLines: number;
  publishedAt?: Date | null;
  publishedBy?: string | null;
  paidAt?: Date | null;
  paidBy?: string | null;
}

/** Index of the stage that is in progress for each state (0-based). A paid month has no stage in progress: all six are done. */
const CURRENT: Record<PayrollMonthState, number> = { WAITING: 0, IN_REVIEW: 2, TO_APPROVE: 3, TO_PUBLISH: 4, PUBLISHED: 5, PAID: 6 };

/** E1 and the S-shell stage line: six stages; the current one carries the caption that says what it waits for. */
export function buildStages(state: PayrollMonthState, facts: StageFacts): StageView[] {
  const current = CURRENT[state];
  const names: [StageView['key'], string][] = [['TIMESHEETS', 'Timesheets approved'], ['CALCULATED', 'Calculated'], ['REVIEWED', 'Reviewed'], ['APPROVED', 'Approved'], ['PUBLISHED', 'Published'], ['PAID', 'Paid']];
  return names.map(([key, name], index): StageView => {
    const status: StageStatus = index < current ? 'DONE' : index === current ? 'CURRENT' : 'TODO';
    const base = { key, number: index + 1, name, status, who: null, at: null, text: null };
    if (status === 'TODO') return base;
    if (key === 'TIMESHEETS') return { ...base, text: `${facts.sitesApproved.approved} of ${facts.sitesApproved.total} sites` };
    if (key === 'CALCULATED') return { ...base, at: facts.calculatedAt?.toISOString() ?? null };
    if (key === 'REVIEWED') return status === 'DONE' ? { ...base, who: facts.reviewedBy, at: facts.sentAt?.toISOString() ?? null } : { ...base, who: 'HR', text: `${facts.openLines} ${facts.openLines === 1 ? 'line' : 'lines'}` };
    if (key === 'APPROVED') return { ...base, who: facts.approvedBy, at: facts.approvedAt?.toISOString() ?? null };
    if (key === 'PUBLISHED') return status === 'DONE' ? { ...base, who: facts.publishedBy ?? 'HR', at: facts.publishedAt?.toISOString() ?? null } : { ...base, who: 'HR', text: 'HR to publish' };
    if (key === 'PAID') return status === 'DONE' ? { ...base, who: facts.paidBy ?? null, at: facts.paidAt?.toISOString() ?? null } : { ...base, who: 'Accountant', text: 'Accountant to pay' };
    return base;
  });
}

/** P25: a tab is enabled when there is something to show. Payslips is a list that exists from Approved. */
export function tabsEnabled(stage: MonthStage): string[] {
  if (stage === 'OPEN' || stage === 'WAITING') return ['timesheets'];
  if (stage === 'TO_PUBLISH' || stage === 'PUBLISHED' || stage === 'PAID') return ['timesheets', 'rules', 'tax', 'casual', 'totals', 'payslips'];
  return ['timesheets', 'rules', 'tax', 'casual', 'totals'];
}

export interface MonthCapabilities {
  canReview: boolean;
  canSendToAccountant: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canPay: boolean;
  canCorrect: boolean;
  canExport: boolean;
  canRemind: boolean;
  canApproveSiteLate: boolean;
}

/** Computed from the access table and the state, never from a role name; the screen shows a button only when it is true. */
export function capabilitiesFor(subject: AccessSubject, state: MonthStage): MonthCapabilities {
  const can = (c: Parameters<typeof workforceCan>[1]) => workforceCan(subject, c);
  return {
    canReview: can('payroll.review') && state === 'IN_REVIEW',
    canSendToAccountant: can('payroll.review') && state === 'IN_REVIEW',
    canApprove: can('payroll.approve') && state === 'TO_APPROVE',
    canPublish: can('payroll.publish') && state === 'TO_PUBLISH',
    canPay: can('payroll.pay') && state === 'PUBLISHED', // the bank file and Mark as paid; a Paid month keeps only "download again" (bank file route)
    canCorrect: can('payroll.correct') && state === 'PUBLISHED', // corrections stay open until the month is paid
    canExport: can('payroll.export') && state !== 'OPEN' && state !== 'WAITING',
    canRemind: can('payroll.remind') && state === 'WAITING',
    canApproveSiteLate: can('payroll.approve_site_late') && state === 'WAITING',
  };
}

/** The strip's first cell: the stage word and what it waits for. */
export function stageCell(stage: MonthStage, facts: { sitesApproved: { approved: number; total: number }; openLines: number; waitingFor: string | null }): { word: string; caption: string } {
  if (stage === 'OPEN') return { word: 'Open', caption: 'The month is still running' };
  if (stage === 'WAITING') return { word: 'Waiting', caption: facts.waitingFor ?? `for ${facts.sitesApproved.total - facts.sitesApproved.approved} of ${facts.sitesApproved.total} sites to approve` };
  if (stage === 'IN_REVIEW') return { word: 'In review', caption: facts.openLines === 0 ? 'HR can send it to the Accountant' : `HR checks ${facts.openLines} ${facts.openLines === 1 ? 'line' : 'lines'}` };
  if (stage === 'TO_APPROVE') return { word: 'To approve', caption: 'HR finished the review' };
  if (stage === 'PUBLISHED') return { word: 'To pay', caption: 'Published by HR, open to corrections until paid' };
  if (stage === 'PAID') return { word: 'Paid', caption: 'Locked: nothing can be changed' };
  return { word: 'To publish', caption: 'Approved by the Accountant' };
}
