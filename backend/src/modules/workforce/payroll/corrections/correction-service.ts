import type { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { told } from '../../people/people-context';
import type { AccessSubject } from '../../_shared/workforce-access';
import { bankRepository } from '../bank/bank-repository';
import type { PersonInput } from '../engine/engine.types';
import { monthsRepository } from '../months/months-repository';
import { eventOf, payrollEntry } from '../payroll-audit';
import { assertNotLocked, payrollActor, replayOf, requireMonth } from '../payroll-context';
import { psNumber } from '../reads/payslips-service';
import { readsRepository } from '../reads/reads-repository';
import { sitesRepository } from '../sites/sites-repository';
import { hashSnapshot, type MonthSnapshot } from '../approval/month-snapshot';
import { currentValues } from './apply-correction';
import { nextRevision, snapshotPayslipOf } from './snapshot-revision';
import { loadForCorrection, prepareCorrection } from './correction-prepare';
import { correctionRepository } from './correction-repository';
import type { CorrectBody, PreviewBody } from './correction-validators';

export interface CorrectionResult {
  monthKey: string;
  payslipId: string;
  employeeId: string;
  version: number;
  netBefore: string;
  netAfter: string;
  bankFileVoided: boolean;
  stateVersion: number;
  repeat: boolean;
}

/** What the dialog starts from: the editable values now, and whether saving would void a bank file. Read only. */
export async function correctionInputs(subject: AccessSubject, monthKey: string, payslipId: string, expectedVersion: number) {
  const ctx = await payrollActor(subject, 'payroll.correct');
  const { month, row } = await loadForCorrection(ctx, monthKey, payslipId, expectedVersion);
  const file = await bankRepository.activeFile(month.id);
  return { payslipId, version: row.version, employeeName: row.employeeName, siteName: row.siteName, current: currentValues(row.input as unknown as PersonInput), bankFile: file ? { downloadedAt: file.downloadedAt.toISOString(), version: file.version } : null };
}

/** The live NOW / CORRECTED table (P21). Never saves; the engine works the one payslip again with the month's frozen rules. */
export async function previewCorrection(subject: AccessSubject, monthKey: string, payslipId: string, body: PreviewBody) {
  const ctx = await payrollActor(subject, 'payroll.correct');
  const p = await prepareCorrection(ctx, monthKey, payslipId, body.change, body.expectedVersion);
  return { payslipId, version: p.row.version, lines: p.diff.lines, netNow: p.diff.totals.now.net, netCorrected: p.diff.totals.corrected.net, netChange: p.diff.netChange, totals: p.diff.totals, voidsBankFile: p.voidsBankFile };
}

/**
 * Corrects one payslip (S11, E6): version n+1 with the full lines and the diff, version n kept and readable as replaced. Checks, in
 * order: capability, the same key, the lock and state, own payslip, the version the screen showed, the figures, the PIN. In one
 * transaction (month row locked): the new version, a void of the bank file when the net changed, the month's version bumped, audit
 * with old and new figures and the reason. Staff and the Accountant are told after the commit, with no figure.
 */
export async function correctPayslip(subject: AccessSubject, monthKey: string, payslipId: string, body: CorrectBody, now: Date = new Date()): Promise<CorrectionResult> {
  const ctx = await payrollActor(subject, 'payroll.correct');
  const again = await replayOf<CorrectionResult>(ctx.companyId, body.idempotencyKey, 'correct', monthKey);
  if (again) return again;
  const p = await prepareCorrection(ctx, monthKey, payslipId, body.change, body.expectedVersion);
  await verifySignerPin(subject.id, body.pin);
  const { month, row } = p;
  const number = psNumber((await readsRepository.numbers(month.id, [row.employeeId])).get(row.employeeId));

  const result = await runAudited<CorrectionResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked) throw new NotFoundError('There is no payroll for that month', 'NO_PAYROLL_MONTH');
    if (locked.state === 'PAID') assertNotLocked({ state: 'PAID', lockedAt: null });
    if (locked.state !== 'PUBLISHED') throw new ConflictError('Corrections are not open for this month.', 'CORRECTIONS_NOT_OPEN');
    if ((await correctionRepository.latestVersion(row.runId, row.employeeId, tx)) !== row.version) throw new ConflictError('This payslip changed while you were looking. Check it again.', 'PAYSLIP_CHANGED');
    const newId = await correctionRepository.insertVersion(tx, {
      monthId: month.id,
      runId: row.runId,
      previous: { employeeId: row.employeeId, siteId: row.siteId, employeeName: row.employeeName, employeeNumber: row.employeeNumber, department: row.department, siteName: row.siteName, payoutMethod: row.payoutMethod, version: row.version },
      slip: p.slip,
      input: p.input as unknown as Prisma.InputJsonValue,
      diff: p.diff as unknown as Prisma.InputJsonValue,
      reason: body.reason,
      correctedById: subject.id,
      now,
    });
    const earlier = await correctionRepository.latestSnapshot(tx, month.id);
    if (earlier) {
      const before = earlier.data as unknown as MonthSnapshot;
      const person = { employeeId: row.employeeId, employeeName: row.employeeName, employeeNumber: row.employeeNumber, siteId: row.siteId, siteName: row.siteName, department: row.department, payoutMethod: row.payoutMethod, version: row.version + 1 };
      const snap = nextRevision(before, snapshotPayslipOf(person, p.slip, before.payslips.find((s) => s.employeeId === row.employeeId)), { reason: body.reason, correctedById: subject.id, at: now.toISOString() });
      await correctionRepository.insertRevision(tx, { monthId: month.id, revision: snap.revision ?? earlier.revision + 1, hash: hashSnapshot(snap), data: snap as unknown as Prisma.InputJsonValue });
    }
    const voided = p.netChanged && row.payoutMethod === 'BANK' ? await bankRepository.voidActive(tx, month.id, `${row.employeeName}'s payslip was corrected after the file was downloaded`, now) : 0;
    const { stateVersion } = await correctionRepository.bumpMonth(tx, month.id);
    const res: CorrectionResult = { monthKey, payslipId: newId, employeeId: row.employeeId, version: row.version + 1, netBefore: p.diff.totals.now.net, netAfter: p.diff.totals.corrected.net, bankFileVoided: voided > 0, stateVersion, repeat: false };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'correct', monthKey, response: res as unknown as Prisma.InputJsonValue });
    // E9: an entry about money carries the old and new figures; it is readable only by the payroll audit capability. Never a PIN.
    const common = { companyId: ctx.companyId, actor: ctx.auditActor, category: subject.role === 'ACCOUNTANT' ? ('PAY_RUN_DECIDE' as const) : ('PAY_RUN_PREPARE' as const), monthId: month.id, subjectUserId: p.employeeUserId };
    const entries = [payrollEntry({ ...common, action: 'payroll.payslip_corrected', before: { version: row.version, ...p.diff.totals.now }, after: { month: monthKey, payslip: number, kind: body.change.kind, version: row.version + 1, ...p.diff.totals.corrected, method: 'PIN' }, reason: body.reason })];
    if (voided > 0) entries.push(payrollEntry({ ...common, action: 'payroll.bank_file_voided', after: { month: monthKey, files: voided, because: 'payslip corrected', payslip: number } }));
    const event = eventOf('payroll.payslip_corrected', { monthKey, employeeId: row.employeeId, userId: p.employeeUserId, siteId: row.siteId, payslipNumber: number ?? '', version: row.version + 1, correctedById: subject.id, bankFileVoided: voided > 0 }, now);
    return { result: res, entries, events: [event] };
  });

  if (!result.repeat) {
    await told([p.employeeUserId], 'payroll.payslip_corrected', { month: monthKey, version: result.version });
    if (result.bankFileVoided) await told((await sitesRepository.usersWithRoles(['ACCOUNTANT'])).filter((id) => id !== subject.id), 'payroll.bank_file_voided', { month: monthKey });
  }
  return result;
}
