import type { Prisma } from '@prisma/client';
import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { told } from '../../people/people-context';
import type { AccessSubject } from '../../_shared/workforce-access';
import { FIRST_MONTH_HAND_CHECKS } from '../engine/payroll-constants';
import { parseCents } from '../engine/money';
import { monthsRepository, type MonthRow } from '../months/months-repository';
import { eventOf, payrollEntry } from '../payroll-audit';
import { assertState, assertVersion, payrollActor, requireMonth } from '../payroll-context';
import { isStale } from '../review/review-service';
import { reviewRepository } from '../review/review-repository';
import { sitesRepository } from '../sites/sites-repository';
import { approvalRepository } from './approval-repository';
import type { ApproveBody } from './approval-validators';
import { hashSnapshot, type MonthSnapshot } from './month-snapshot';
import { assertNotPreparer } from './preparers';

export interface StepResult {
  monthKey: string;
  state: 'TO_APPROVE' | 'IN_REVIEW' | 'TO_PUBLISH';
  stateVersion: number;
  documentNumber: string | null;
  repeat: boolean;
}

async function firstResult(companyId: string, key: string, action: string, monthKey: string): Promise<StepResult | null> {
  const prior = await monthsRepository.findKey(companyId, key);
  if (!prior) return null;
  if (prior.action !== action || prior.monthKey !== monthKey) throw new ConflictError('That request key was already used for something else.', 'IDEMPOTENCY_KEY_REUSED');
  return { ...(prior.response as unknown as StepResult), repeat: true };
}

/** HR sends the reviewed month to the Accountant (S5). Nothing may be open, nothing blocking, and nothing may have changed since it was calculated. */
export async function sendToAccountant(subject: AccessSubject, monthKey: string, body: { idempotencyKey: string; stateVersion: number }, now: Date = new Date()): Promise<StepResult> {
  const ctx = await payrollActor(subject, 'payroll.review');
  const again = await firstResult(ctx.companyId, body.idempotencyKey, 'send', monthKey);
  if (again) return again;
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['IN_REVIEW'], 'MONTH_NOT_IN_REVIEW', 'Only a month in review can be sent');
  assertVersion(month, body.stateVersion);
  const unresolved = month.currentRunId ? await reviewRepository.unresolved(month.currentRunId) : { open: 0, blocking: 0 };
  if (unresolved.blocking > 0) throw new ConflictError(`Resolve the ${unresolved.blocking} ${unresolved.blocking === 1 ? 'line' : 'lines'} that block the month.`, 'BLOCKING_LINES', unresolved);
  if (unresolved.open > 0) throw new ConflictError(`Check the ${unresolved.open} ${unresolved.open === 1 ? 'line' : 'lines'} still open.`, 'LINES_OPEN', unresolved);
  if (await isStale(month)) throw new ConflictError('Something changed after this was calculated. Calculate again.', 'CHANGED_AFTER_CALCULATION');

  const result = await runAudited<StepResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'IN_REVIEW' || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    const { stateVersion } = await approvalRepository.updateMonth(tx, month.id, { state: 'TO_APPROVE', sentAt: now, sentById: subject.id, sentBackAt: null, sentBackById: null, sentBackReason: null });
    const res: StepResult = { monthKey, state: 'TO_APPROVE', stateVersion, documentNumber: null, repeat: false };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'send', monthKey, response: res as unknown as Prisma.InputJsonValue });
    return { result: res, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.sent_to_accountant', category: 'PAY_RUN_PREPARE', monthId: month.id, before: { state: 'IN_REVIEW' }, after: { state: 'TO_APPROVE', month: monthKey, run: month.runCount } })], events: [eventOf('payroll.month_sent', { monthKey, sentById: subject.id }, now)] };
  });
  await told(await sitesRepository.usersWithRoles(['ACCOUNTANT']), 'payroll.ready_to_approve', { month: monthKey });
  return result;
}

/** The Accountant sends the month back to HR with a reason (P18). No PIN; the ticks are kept. */
export async function sendBack(subject: AccessSubject, monthKey: string, body: { reason: string; idempotencyKey: string; stateVersion: number }, now: Date = new Date()): Promise<StepResult> {
  const ctx = await payrollActor(subject, 'payroll.approve');
  const again = await firstResult(ctx.companyId, body.idempotencyKey, 'send-back', monthKey);
  if (again) return again;
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['TO_APPROVE'], 'MONTH_NOT_WITH_ACCOUNTANT', 'Only a month waiting for approval can be sent back');
  assertVersion(month, body.stateVersion);
  const result = await runAudited<StepResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'TO_APPROVE' || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    const { stateVersion } = await approvalRepository.updateMonth(tx, month.id, { state: 'IN_REVIEW', sentAt: null, sentById: null, sentBackAt: now, sentBackById: subject.id, sentBackReason: body.reason });
    const res: StepResult = { monthKey, state: 'IN_REVIEW', stateVersion, documentNumber: null, repeat: false };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'send-back', monthKey, response: res as unknown as Prisma.InputJsonValue });
    return { result: res, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.sent_back', category: 'PAY_RUN_DECIDE', monthId: month.id, before: { state: 'TO_APPROVE' }, after: { state: 'IN_REVIEW', month: monthKey }, reason: body.reason })], events: [eventOf('payroll.month_sent_back', { monthKey, sentBackById: subject.id, reason: body.reason }, now)] };
  });
  await told(await sitesRepository.usersWithRoles(['HR_MANAGER']), 'payroll.sent_back', { month: monthKey, reason: body.reason });
  return result;
}

const sameMoney = (a: string, b: string): boolean => parseCents(a) === parseCents(b);

async function buildSnapshot(month: MonthRow, approver: { id: string; name: string }, now: Date, preparers: { id: string; name: string }[], totals: MonthSnapshot['totals']): Promise<MonthSnapshot> {
  const [slips, sites] = await Promise.all([approvalRepository.payslipsWithLines(month.currentRunId ?? ''), monthsRepository.sites(month.id)]);
  const names = new Map((await sitesRepository.activeSites(month.companyId)).map((s) => [s.id, s.name]));
  return {
    version: 1,
    monthKey: month.monthKey,
    documentNumber: `PAY-${month.monthKey}`,
    runNumber: month.runCount,
    approvedAt: now.toISOString(),
    approvedBy: approver,
    preparedBy: preparers,
    tablesVersion: month.tablesVersion,
    sites: sites.map((s) => ({ siteId: s.siteId, name: names.get(s.siteId) ?? '', timesheetNumber: `TSH-${String(s.timesheetNumber).padStart(4, '0')}` })),
    rulesUsed: month.rulesUsed,
    totals,
    payslips: slips.map((p) => ({
      employeeId: p.employeeId, employeeName: p.employeeName, employeeNumber: p.employeeNumber, siteId: p.siteId, siteName: p.siteName, department: p.department,
      basic: p.basic.toFixed(2), gross: p.gross.toFixed(2), statutoryEmployee: p.statutoryEmployee.toFixed(2), incomeTax: p.incomeTax.toFixed(2), otherDeductions: p.otherDeductions.toFixed(2),
      net: p.net.toFixed(2), employerShare: p.employerShare.toFixed(2), taxablePay: p.taxablePay.toFixed(2),
      lines: p.lines.map((l) => ({ code: l.code, label: l.label, kind: l.kind, amount: l.amount.toFixed(2), workingText: l.workingText, tableCode: l.tableCode, share: l.share })),
    })),
  };
}

/**
 * The Accountant approves with a PIN (S6). Checks, in order: capability (403), the same key (the first result), state, the approver
 * is not a preparer (403 SELF_APPROVAL), nothing blocking or changed since the calculation, the PIN, the first-month hand check,
 * and the figures the dialog showed against the fresh ones. One transaction freezes the snapshot, issues PAY-YYYY-MM and audits.
 */
export async function approveMonth(subject: AccessSubject, monthKey: string, body: ApproveBody, now: Date = new Date()): Promise<StepResult> {
  const ctx = await payrollActor(subject, 'payroll.approve');
  const again = await firstResult(ctx.companyId, body.idempotencyKey, 'approve', monthKey);
  if (again) return again;
  const month = await requireMonth(ctx.companyId, monthKey);
  if (month.state === 'TO_PUBLISH') throw new ConflictError('Someone approved this month a moment ago.', 'ALREADY_APPROVED');
  assertState(month, ['TO_APPROVE'], 'MONTH_NOT_WITH_ACCOUNTANT', 'Only a month HR has sent can be approved');
  assertVersion(month, body.stateVersion);
  const runId = month.currentRunId;
  if (!runId) throw new ConflictError('This month has not been calculated.', 'NOT_CALCULATED');
  assertNotPreparer(subject.id, await approvalRepository.preparerFacts(month.id, runId, month.sentById));
  const unresolved = await reviewRepository.unresolved(runId);
  if (unresolved.blocking > 0 || unresolved.open > 0) throw new ConflictError('Some lines are still open. Send the month back to HR.', 'LINES_OPEN', unresolved);
  if (await isStale(month)) throw new ConflictError('Something changed after this was calculated. Send the month back to HR to calculate again.', 'CHANGED_AFTER_CALCULATION');
  await verifySignerPin(subject.id, body.pin);
  const firstMonth = month.firstMonthSiteIds.length > 0;
  if (firstMonth && body.handChecked !== true) throw new ConflictError(`Check at least ${FIRST_MONTH_HAND_CHECKS} payslips by hand first, then tick the box.`, 'HAND_CHECK_REQUIRED');
  const totals = await approvalRepository.runTotals(runId);
  const e = body.expectedTotals;
  if (totals.headcount !== e.headcount || !sameMoney(totals.gross, e.gross) || !sameMoney(totals.net, e.net) || !sameMoney(totals.taxStatutory, e.taxStatutory) || !sameMoney(totals.other, e.other)) {
    throw new ConflictError('Something changed while you were looking. The figures are updated. Check them and try again.', 'CHANGED_UNDERNEATH', { totals });
  }

  const preparerIds = [...new Set([month.sentById, ...(await approvalRepository.preparerFacts(month.id, runId, month.sentById)).runByIds].filter((id): id is string => id !== null))];
  const names = await monthsRepository.userNames([subject.id, ...preparerIds]);
  const snapshot = await buildSnapshot(month, { id: subject.id, name: ctx.name }, now, preparerIds.map((id) => ({ id, name: names.get(id)?.name ?? '' })), totals);
  const document = `PAY-${monthKey}`;

  const result = await runAudited<StepResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'TO_APPROVE' || locked.stateVersion !== month.stateVersion) throw new ConflictError('Someone approved this month a moment ago.', 'ALREADY_APPROVED');
    await approvalRepository.addSnapshot(tx, { monthId: month.id, hash: hashSnapshot(snapshot), data: snapshot as unknown as Prisma.InputJsonValue });
    const { stateVersion } = await approvalRepository.updateMonth(tx, month.id, { state: 'TO_PUBLISH', approvedAt: now, approvedById: subject.id, documentNumber: document, handChecked: firstMonth && body.handChecked === true });
    const res: StepResult = { monthKey, state: 'TO_PUBLISH', stateVersion, documentNumber: document, repeat: false };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'approve', monthKey, response: res as unknown as Prisma.InputJsonValue });
    const entries = [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.approved', category: 'PAY_RUN_DECIDE', monthId: month.id, before: { state: 'TO_APPROVE' }, after: { state: 'TO_PUBLISH', month: monthKey, document, headcount: totals.headcount, handChecked: body.handChecked === true, method: 'PIN' } })];
    if (firstMonth) entries.push(payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.hand_check_confirmed', category: 'PAY_RUN_DECIDE', monthId: month.id, after: { month: monthKey, sites: month.firstMonthSiteIds.length, payslipsChecked: FIRST_MONTH_HAND_CHECKS } }));
    return { result: res, entries, events: [eventOf('payroll.month_approved', { monthKey, approvedById: subject.id, documentNumber: document, headcount: totals.headcount }, now)] };
  });
  await told(await sitesRepository.usersWithRoles(['HR_MANAGER']), 'payroll.approved', { month: monthKey });
  return result;
}
