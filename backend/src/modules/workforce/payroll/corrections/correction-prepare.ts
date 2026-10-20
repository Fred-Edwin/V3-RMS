import { ConflictError, ForbiddenError, NotFoundError, UnprocessableEntityError } from '../../../../utils/errors';
import type { EffectiveRules } from '../../rules';
import type { ActorCtx } from '../../people/people-context';
import { bankRepository } from '../bank/bank-repository';
import { calculatePayslip } from '../engine/calculate-payslip';
import type { Payslip, PersonInput } from '../engine/engine.types';
import { parseCents } from '../engine/money';
import { toEngineRules } from '../calculate/rules-to-engine';
import type { MonthRow } from '../months/months-repository';
import { assertNotLocked, assertState, requireMonth } from '../payroll-context';
import { applyCorrection } from './apply-correction';
import { diffPayslips, isNoChange, totalsOf, type PayslipDiff } from './correction-diff';
import { correctionRepository } from './correction-repository';
import type { CorrectionChange } from './correction-validators';

type PayslipRow = NonNullable<Awaited<ReturnType<typeof correctionRepository.payslip>>>;

export interface Prepared {
  month: MonthRow;
  row: PayslipRow;
  input: PersonInput;
  slip: Payslip;
  diff: PayslipDiff;
  netChanged: boolean;
  voidsBankFile: boolean;
  employeeUserId: string | null;
}

/** The month, the payslip (the version the screen showed) and the corrector's right to touch it. The same checks for the preview and the save. */
export async function loadForCorrection(ctx: ActorCtx, monthKey: string, payslipId: string, expectedVersion: number): Promise<{ month: MonthRow; row: PayslipRow; employeeUserId: string | null }> {
  const month = await requireMonth(ctx.companyId, monthKey);
  assertNotLocked(month);
  assertState(month, ['PUBLISHED'], 'CORRECTIONS_NOT_OPEN', 'Corrections open once the payslips are published');
  const row = await correctionRepository.payslip(month.id, payslipId);
  if (!row) throw new NotFoundError('That payslip is not in this month', 'NO_PAYSLIP');
  const employee = await correctionRepository.employeeUser(row.employeeId);
  if (employee?.userId && employee.userId === ctx.subject.id) throw new ForbiddenError('You cannot correct your own payslip. The other payroll role does it.', 'SELF_CORRECTION');
  const latest = await correctionRepository.latestVersion(row.runId, row.employeeId);
  if (row.version !== expectedVersion || row.version !== latest) throw new ConflictError('This payslip changed while you were looking. Check it again.', 'PAYSLIP_CHANGED', { currentVersion: latest });
  return { month, row, employeeUserId: employee?.userId ?? null };
}

/** Recomputes the one payslip with the month's frozen rule versions and the same snapshot hours, plus the changed input (E6). Nothing is saved. */
export async function prepareCorrection(ctx: ActorCtx, monthKey: string, payslipId: string, change: CorrectionChange, expectedVersion: number): Promise<Prepared> {
  const { month, row, employeeUserId } = await loadForCorrection(ctx, monthKey, payslipId, expectedVersion);
  const frozen = (month.rulesUsed ?? {}) as unknown as Record<string, EffectiveRules>;
  const siteRules = frozen[row.siteId];
  if (!siteRules) throw new ConflictError('The rules this month used cannot be found.', 'RULES_NOT_FROZEN');
  const input = applyCorrection(row.input as unknown as PersonInput, change);
  const slip = calculatePayslip(input, toEngineRules(siteRules));
  if (slip.problems.length > 0) throw new UnprocessableEntityError('That cannot be calculated: the payslip is missing something it needs.', 'CORRECTION_NOT_CALCULABLE', { problems: slip.problems });
  if (parseCents(slip.net) < 0n) throw new UnprocessableEntityError('This would make the net pay negative.', 'NEGATIVE_NET');
  const before = { lines: row.lines.map((l) => ({ code: l.code, label: l.label, kind: l.kind, amount: l.amount.toFixed(2), tableCode: l.tableCode, share: l.share as 'EMPLOYEE' | 'EMPLOYER' | null, source: l.source })), totals: totalsOf({ gross: row.gross.toFixed(2), net: row.net.toFixed(2), statutoryEmployee: row.statutoryEmployee.toFixed(2), otherDeductions: row.otherDeductions.toFixed(2), employerShare: row.employerShare.toFixed(2) }) };
  const diff = diffPayslips(before, { lines: slip.lines, totals: totalsOf(slip) });
  if (isNoChange(diff)) throw new UnprocessableEntityError('This changes nothing.', 'NO_CHANGE');
  const netChanged = parseCents(slip.net) !== parseCents(row.net.toFixed(2));
  const active = await bankRepository.activeFile(month.id);
  return { month, row, input, slip, diff, netChanged, voidsBankFile: netChanged && active !== null && row.payoutMethod === 'BANK', employeeUserId };
}
