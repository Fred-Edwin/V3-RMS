import type { Prisma } from '@prisma/client';
import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import type { AccessSubject } from '../../_shared/workforce-access';
import { calculateMonth, type CalculateResult } from '../calculate/calculate-service';
import { monthsRepository, type MonthRow } from '../months/months-repository';
import { payrollEntry } from '../payroll-audit';
import { assertState, assertVersion, payrollActor, requireMonth } from '../payroll-context';
import { reviewRepository } from './review-repository';
import type { AdjustmentBody } from './review-validators';

export interface ChangeResult {
  id: string | null;
  stateVersion: number;
  repeat: boolean;
  /** The month is worked out again after the change. If that failed the change still stands and HR can calculate again. */
  recalculated: CalculateResult | null;
  recalculationError: string | null;
}

/** After a change to the inputs: calculate again, keeping HR's ticks on lines that did not change. */
async function worked(companyId: string, month: MonthRow, subject: AccessSubject, stateVersion: number, key: string): Promise<Pick<ChangeResult, 'recalculated' | 'recalculationError'>> {
  const ctx = await payrollActor(subject, 'payroll.review');
  try {
    return { recalculated: await calculateMonth({ companyId, monthKey: month.monthKey, trigger: 'HR', actor: ctx, expectedVersion: stateVersion, idempotencyKey: `${key}:calc`, keepTicks: true }), recalculationError: null };
  } catch (error) {
    if (error instanceof AppError) return { recalculated: null, recalculationError: error.message };
    throw error;
  }
}

async function repeatOf(companyId: string, key: string, action: string, monthKey: string): Promise<ChangeResult | null> {
  const prior = await monthsRepository.findKey(companyId, key);
  if (!prior) return null;
  if (prior.action !== action || prior.monthKey !== monthKey) throw new ConflictError('That request key was already used for something else.', 'IDEMPOTENCY_KEY_REUSED');
  return { ...(prior.response as unknown as ChangeResult), repeat: true };
}

/** Leaves a person out of the month (a blocking line, S5). They are paid next month through an ARREARS line. */
export async function leaveOut(subject: AccessSubject, monthKey: string, lineId: string, body: { reason: string; stateVersion: number; idempotencyKey: string }): Promise<ChangeResult> {
  const ctx = await payrollActor(subject, 'payroll.review');
  const again = await repeatOf(ctx.companyId, body.idempotencyKey, 'leave-out', monthKey);
  if (again) return again;
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['IN_REVIEW'], 'MONTH_NOT_IN_REVIEW', 'People can only be left out while HR is reviewing');
  assertVersion(month, body.stateVersion);
  const line = month.currentRunId ? await reviewRepository.find(month.currentRunId, lineId) : null;
  if (!line) throw new NotFoundError('That line is not in this month', 'NO_REVIEW_LINE');
  const base = await runAudited<ChangeResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'IN_REVIEW' || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    await reviewRepository.addLeftOut(tx, { monthId: month.id, employeeId: line.employeeId, siteId: line.siteId, reason: body.reason, byId: subject.id });
    const stateVersion = await reviewRepository.bumpVersion(tx, month.id);
    const result: ChangeResult = { id: null, stateVersion, repeat: false, recalculated: null, recalculationError: null };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'leave-out', monthKey, response: result as unknown as Prisma.InputJsonValue });
    return { result, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.person_left_out', category: 'PAY_RUN_PREPARE', monthId: month.id, after: { month: monthKey, employeeId: line.employeeId, kind: line.kind }, reason: body.reason })] };
  });
  return { ...base, ...(await worked(ctx.companyId, month, subject, base.stateVersion, body.idempotencyKey)) };
}

/** Adds one line to a person's payslip (P14): a kind, a label, an amount, a reason and HR's PIN. */
export async function addAdjustment(subject: AccessSubject, monthKey: string, body: AdjustmentBody): Promise<ChangeResult> {
  const ctx = await payrollActor(subject, 'payroll.review');
  const again = await repeatOf(ctx.companyId, body.idempotencyKey, 'adjustment', monthKey);
  if (again) return again;
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['IN_REVIEW'], 'MONTH_NOT_IN_REVIEW', 'Lines can only be added while HR is reviewing');
  assertVersion(month, body.stateVersion);
  const person = month.currentRunId ? await reviewRepository.personInRun(month.currentRunId, body.employeeId) : null;
  if (!person) throw new NotFoundError('That person is not in this month', 'NO_PERSON_IN_MONTH');
  await verifySignerPin(subject.id, body.pin);
  const now = new Date();
  const base = await runAudited<ChangeResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'IN_REVIEW' || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    const row = await reviewRepository.addAdjustment(tx, { monthId: month.id, employeeId: body.employeeId, siteId: person.siteId, kind: body.type, label: body.label, amount: body.amount, taxable: body.taxable, reason: body.reason, idempotencyKey: body.idempotencyKey, createdById: subject.id, createdAt: now });
    const stateVersion = await reviewRepository.bumpVersion(tx, month.id);
    const result: ChangeResult = { id: row.id, stateVersion, repeat: false, recalculated: null, recalculationError: null };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'adjustment', monthKey, response: result as unknown as Prisma.InputJsonValue });
    return { result, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.adjustment_added', category: 'PAY_RUN_PREPARE', monthId: month.id, after: { month: monthKey, employeeId: body.employeeId, kind: body.type, label: body.label, taxable: body.taxable, method: 'PIN' }, reason: body.reason })] };
  });
  return { ...base, ...(await worked(ctx.companyId, month, subject, base.stateVersion, body.idempotencyKey)) };
}

/** Takes a line back out before the month is sent. The row stays (with who and when) so the audit trail is whole. */
export async function removeAdjustment(subject: AccessSubject, monthKey: string, id: string, body: { stateVersion: number; idempotencyKey: string }): Promise<ChangeResult> {
  const ctx = await payrollActor(subject, 'payroll.review');
  const again = await repeatOf(ctx.companyId, body.idempotencyKey, 'adjustment-remove', monthKey);
  if (again) return again;
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['IN_REVIEW'], 'MONTH_NOT_IN_REVIEW', 'Lines can only be taken out while HR is reviewing');
  assertVersion(month, body.stateVersion);
  const adjustment = await reviewRepository.findAdjustment(month.id, id);
  if (!adjustment || adjustment.removedAt) throw new NotFoundError('That line is not in this month', 'NO_ADJUSTMENT');
  const now = new Date();
  const base = await runAudited<ChangeResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'IN_REVIEW' || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    if ((await reviewRepository.removeAdjustment(tx, month.id, id, subject.id, now)) === 0) throw new NotFoundError('That line is not in this month', 'NO_ADJUSTMENT');
    const stateVersion = await reviewRepository.bumpVersion(tx, month.id);
    const result: ChangeResult = { id, stateVersion, repeat: false, recalculated: null, recalculationError: null };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'adjustment-remove', monthKey, response: result as unknown as Prisma.InputJsonValue });
    return { result, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.adjustment_removed', category: 'PAY_RUN_PREPARE', monthId: month.id, after: { month: monthKey, employeeId: adjustment.employeeId, kind: adjustment.kind } })] };
  });
  return { ...base, ...(await worked(ctx.companyId, month, subject, base.stateVersion, body.idempotencyKey)) };
}
