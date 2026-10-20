import type { Prisma } from '@prisma/client';
import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { told } from '../../people/people-context';
import type { AccessSubject } from '../../_shared/workforce-access';
import { monthsRepository } from '../months/months-repository';
import { eventOf, payrollEntry } from '../payroll-audit';
import { assertState, assertVersion, payrollActor, replayOf, requireMonth } from '../payroll-context';
import { sitesRepository } from '../sites/sites-repository';
import { publishRepository } from './publish-repository';
import type { PublishBody } from './publish-validators';

export interface PublishResult {
  monthKey: string;
  state: 'PUBLISHED';
  stateVersion: number;
  published: number;
  repeat: boolean;
}

/**
 * HR publishes the approved month (S7). Checks, in order: capability (403), the same key (the first result), the lock and the state
 * (409), the screen's version, the PIN. One transaction numbers every payslip PS-nnnn, moves the month to PUBLISHED and audits; a
 * failure anywhere writes nothing ("no partial publish"). Staff are told after the commit, and a failed notification never undoes it.
 */
export async function publishMonth(subject: AccessSubject, monthKey: string, body: PublishBody, now: Date = new Date()): Promise<PublishResult> {
  const ctx = await payrollActor(subject, 'payroll.publish');
  const again = await replayOf<PublishResult>(ctx.companyId, body.idempotencyKey, 'publish', monthKey);
  if (again) return again;
  const month = await requireMonth(ctx.companyId, monthKey);
  if (month.state === 'PUBLISHED') throw new ConflictError('Someone published this month a moment ago.', 'ALREADY_PUBLISHED');
  assertState(month, ['TO_PUBLISH'], 'MONTH_NOT_APPROVED', 'Only a month the Accountant approved can be published');
  assertVersion(month, body.stateVersion);
  if (!month.currentRunId) throw new ConflictError('This month has not been calculated.', 'NOT_CALCULATED');
  const slips = await publishRepository.toPublish(month.currentRunId);
  await verifySignerPin(subject.id, body.pin);

  const result = await runAudited<PublishResult>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'TO_PUBLISH' || locked.stateVersion !== month.stateVersion) throw new ConflictError('Someone published this month a moment ago.', 'ALREADY_PUBLISHED');
    const issued = await publishRepository.issueNumbers(tx, month.id, slips.map((s) => s.employeeId), now);
    const { stateVersion } = await publishRepository.updateMonth(tx, month.id, { state: 'PUBLISHED', publishedAt: now, publishedById: subject.id });
    const res: PublishResult = { monthKey, state: 'PUBLISHED', stateVersion, published: issued, repeat: false };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'publish', monthKey, response: res as unknown as Prisma.InputJsonValue });
    const entry = payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.published', category: 'PAY_RUN_PREPARE', monthId: month.id, before: { state: 'TO_PUBLISH' }, after: { state: 'PUBLISHED', month: monthKey, document: month.documentNumber, payslips: issued, method: 'PIN' } });
    return { result: res, entries: [entry], events: [eventOf('payroll.month_published', { monthKey, publishedById: subject.id, headcount: issued, documentNumber: month.documentNumber ?? `PAY-${monthKey}` }, now)] };
  });

  await told(await publishRepository.userIdsOf(slips.map((s) => s.employeeId)), 'payroll.payslip_published', { month: monthKey });
  await told(await sitesRepository.usersWithRoles(['ACCOUNTANT']), 'payroll.published', { month: monthKey });
  return result;
}
