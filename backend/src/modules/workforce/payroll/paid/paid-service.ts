import type { Prisma } from '@prisma/client';
import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { told } from '../../people/people-context';
import type { AccessSubject } from '../../_shared/workforce-access';
import { buildBankFile } from '../bank/bank-build';
import { bankRepository } from '../bank/bank-repository';
import { monthsRepository } from '../months/months-repository';
import { eventOf, payrollEntry } from '../payroll-audit';
import { assertState, assertVersion, payrollActor, replayOf, requireMonth } from '../payroll-context';
import { publishRepository } from '../publish/publish-repository';
import { sitesRepository } from '../sites/sites-repository';
import { paidRepository } from './paid-repository';
import type { MarkPaidBody } from './paid-validators';

export interface MarkPaidResult {
  monthKey: string;
  state: 'PAID';
  stateVersion: number;
  paidAt: string;
  repeat: boolean;
}

/**
 * The Accountant marks the month paid and locks it (S8, E6). Checks, in order: capability, the same key, the state (PAID answers
 * ALREADY_PAID, anything before PUBLISHED a 409), the screen's version, nobody left unpayable, a current bank file download whose hash
 * is the one the dialog showed, the PIN. Then one transaction, with the month row locked, re-checks the file and sets PAID with
 * `lockedAt`. From that commit the database itself refuses every payroll write on the month (migration `payroll_locked_month_guard`).
 */
export async function markPaid(subject: AccessSubject, monthKey: string, body: MarkPaidBody, now: Date = new Date()): Promise<MarkPaidResult> {
  const ctx = await payrollActor(subject, 'payroll.pay');
  const again = await replayOf<MarkPaidResult>(ctx.companyId, body.idempotencyKey, 'mark-paid', monthKey);
  if (again) return again;
  const month = await requireMonth(ctx.companyId, monthKey);
  if (month.state === 'PAID') throw new ConflictError('Someone marked this month paid a moment ago.', 'ALREADY_PAID', { state: 'PAID' });
  assertState(month, ['PUBLISHED'], 'MONTH_NOT_PUBLISHED', 'Only a published month can be marked paid');
  assertVersion(month, body.stateVersion);
  const built = await buildBankFile(month);
  const people = built.plan.cannotPay.length;
  if (people > 0) throw new ConflictError(`Fix the ${people} ${people === 1 ? 'person' : 'people'} with no bank account first.`, 'PEOPLE_CANNOT_BE_PAID', { cannotPay: built.plan.cannotPay });
  const needsFile = built.plan.people > 0;
  if (needsFile) {
    const active = await bankRepository.activeFile(month.id);
    if (!active) throw new ConflictError('Download the bank file first.', 'BANK_FILE_REQUIRED');
    if (active.hash !== built.hash || body.bankFileHash !== built.hash) throw new ConflictError('The bank file changed after you opened this. Download the new one.', 'BANK_FILE_CHANGED');
  }
  await verifySignerPin(subject.id, body.pin);
  const staff = await bankRepository.payslips(month.currentRunId ?? '');

  const result = await runAudited<MarkPaidResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (locked?.state === 'PAID') throw new ConflictError('Someone marked this month paid a moment ago.', 'ALREADY_PAID', { state: 'PAID' });
    if (!locked || locked.state !== 'PUBLISHED' || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    if (needsFile && (await bankRepository.activeFile(month.id, tx))?.hash !== built.hash) throw new ConflictError('The bank file changed after you opened this. Download the new one.', 'BANK_FILE_CHANGED');
    const { stateVersion } = await paidRepository.markPaid(tx, month.id, subject.id, now);
    const res: MarkPaidResult = { monthKey, state: 'PAID', stateVersion, paidAt: now.toISOString(), repeat: false };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'mark-paid', monthKey, response: res as unknown as Prisma.InputJsonValue });
    const entry = payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.marked_paid', category: 'PAY_RUN_DECIDE', monthId: month.id, before: { state: 'PUBLISHED' }, after: { state: 'PAID', month: monthKey, people: staff.length, bankFileHash: needsFile ? built.hash : null, bankPeople: built.plan.people, bankTotal: built.plan.total, method: 'PIN' } });
    return { result: res, entries: [entry], events: [eventOf('payroll.month_paid', { monthKey, paidById: subject.id, headcount: staff.length }, now)] };
  });

  await told(await publishRepository.userIdsOf(staff.map((s) => s.employeeId)), 'payroll.month_paid', { month: monthKey });
  await told(await sitesRepository.usersWithRoles(['HR_MANAGER']), 'payroll.month_paid', { month: monthKey });
  return result;
}
