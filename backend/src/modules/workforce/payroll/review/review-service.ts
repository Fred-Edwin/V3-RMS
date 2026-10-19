import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { calculateMonth, type CalculateResult } from '../calculate/calculate-service';
import { inputsRepository } from '../calculate/inputs-repository';
import { monthWindow } from '../months/month-calendar';
import { monthsRepository, type MonthRow } from '../months/months-repository';
import { payrollEntry } from '../payroll-audit';
import { assertState, assertVersion, payrollActor, requireMonth } from '../payroll-context';
import { reviewRepository } from './review-repository';
import type { ReviewQuery } from './review-validators';

/** Kinds HR looks at one by one: a bulk tick never touches them (S5). */
const NOT_BULK: readonly string[] = ['BIG_CHANGE'];

/** Has anything the calculation read changed since it ran (a joiner, a pay change, a bank detail, a late approval)? */
async function isStale(month: MonthRow): Promise<boolean> {
  if (month.state !== 'IN_REVIEW' || !month.currentRunId) return false;
  const run = await monthsRepository.run(month.currentRunId);
  const stored = (run?.totals as { fingerprint?: string } | null)?.fingerprint;
  if (!stored) return false;
  return stored !== (await inputsRepository.fingerprint(month.companyId, month.includedSiteIds, monthWindow(month.monthKey)));
}
export { isStale };

export async function listReview(subject: AccessSubject, monthKey: string, query: ReviewQuery) {
  const ctx = await payrollActor(subject, 'payroll.read');
  const month = await requireMonth(ctx.companyId, monthKey);
  if (!month.currentRunId) return { monthKey, state: month.state, stateVersion: month.stateVersion, counts: { total: 0, checked: 0, blocking: 0 }, stale: false, canTick: false, lines: [], page: query.page, rows: query.rows, total: 0 };
  const { rows, total } = await reviewRepository.list(month.currentRunId, { kind: query.kind, state: query.state, severity: query.severity, q: query.q, siteId: query.siteId }, (query.page - 1) * query.rows, query.rows);
  const names = await monthsRepository.userNames(rows.flatMap((r) => (r.checkedById ? [r.checkedById] : [])));
  return {
    monthKey,
    state: month.state,
    stateVersion: month.stateVersion,
    counts: await reviewRepository.counts(month.currentRunId),
    stale: await isStale(month),
    canTick: workforceCan(subject, 'payroll.review') && month.state === 'IN_REVIEW',
    lines: rows.map((r) => ({
      id: r.id, kind: r.kind, severity: r.severity, employeeId: r.employeeId, name: r.employeeName, siteId: r.siteId, siteName: r.siteName, text: r.text, state: r.state,
      checkedBy: r.checkedById ? (names.get(r.checkedById)?.name ?? null) : null, checkedAt: r.checkedAt?.toISOString() ?? null,
      actions: r.severity === 'BLOCK' ? ['ADD_PROFILE_OR_FIX', 'LEAVE_OUT', 'ADD_ADJUSTMENT', 'CALCULATE_AGAIN'] : [],
    })),
    page: query.page,
    rows: query.rows,
    total,
  };
}

/** Ticks or un-ticks one line (HR). Ticks do not bump the month's version, so two people ticking different lines never collide. */
export async function checkLine(subject: AccessSubject, monthKey: string, lineId: string, body: { checked: boolean; stateVersion: number }, now: Date = new Date()): Promise<{ checked: boolean; counts: { total: number; checked: number; blocking: number } }> {
  const ctx = await payrollActor(subject, 'payroll.review');
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['IN_REVIEW'], 'MONTH_NOT_IN_REVIEW', 'Lines can only be checked while HR is reviewing');
  assertVersion(month, body.stateVersion);
  const runId = month.currentRunId;
  const line = runId ? await reviewRepository.find(runId, lineId) : null;
  if (!runId || !line) throw new NotFoundError('That line is not in this month', 'NO_REVIEW_LINE');
  if (line.severity === 'BLOCK') throw new ConflictError('This line blocks the month. Fix it, leave the person out, or add a line, then calculate again.', 'LINE_BLOCKS');
  await runAudited<void>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'IN_REVIEW' || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    await reviewRepository.setState(tx, runId, lineId, body.checked, subject.id, now);
    return { result: undefined, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.review_checked', category: 'PAY_RUN_PREPARE', monthId: month.id, after: { month: monthKey, kind: line.kind, checked: body.checked, employeeId: line.employeeId } })] };
  });
  return { checked: body.checked, counts: await reviewRepository.counts(runId) };
}

/** "Tick all of this kind": the open, non-blocking lines of one kind, except the ones each need a look. One audit entry. */
export async function checkKind(subject: AccessSubject, monthKey: string, body: { kind: string; stateVersion: number }, now: Date = new Date()): Promise<{ ticked: number; counts: { total: number; checked: number; blocking: number } }> {
  const ctx = await payrollActor(subject, 'payroll.review');
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['IN_REVIEW'], 'MONTH_NOT_IN_REVIEW', 'Lines can only be checked while HR is reviewing');
  assertVersion(month, body.stateVersion);
  if (NOT_BULK.includes(body.kind)) throw new ConflictError('Each of these needs its own look.', 'KIND_NOT_BULK');
  const runId = month.currentRunId;
  if (!runId) throw new NotFoundError('That month has nothing to check yet', 'NO_REVIEW_LINE');
  const ticked = await runAudited<number>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'IN_REVIEW' || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    const count = await reviewRepository.tickKind(tx, runId, body.kind, subject.id, now);
    return { result: count, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.review_checked', category: 'PAY_RUN_PREPARE', monthId: month.id, after: { month: monthKey, kind: body.kind, ticked: count, bulk: true } })] };
  });
  return { ticked, counts: await reviewRepository.counts(runId) };
}

/** HR's `Calculate again`: new run, ticks cleared, adjustments and left-out choices kept. */
export async function recalculate(subject: AccessSubject, monthKey: string, body: { idempotencyKey: string; stateVersion: number }, now: Date = new Date()): Promise<CalculateResult> {
  const ctx = await payrollActor(subject, 'payroll.review');
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['WAITING', 'IN_REVIEW'], 'MONTH_NOT_CALCULABLE', 'This month has been sent on, so it cannot be calculated again');
  return calculateMonth({ companyId: ctx.companyId, monthKey, trigger: 'HR', actor: ctx, expectedVersion: body.stateVersion, idempotencyKey: body.idempotencyKey, now });
}
