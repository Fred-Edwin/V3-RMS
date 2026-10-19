import type { PayrollMonthState } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import { resolveActor, type ActorCtx } from '../people/people-context';
import { workforceCan, type AccessSubject, type Capability } from '../_shared/workforce-access';
import { isMonthKey } from './months/month-calendar';
import { monthsRepository, type MonthRow } from './months/months-repository';

/** The person acting, with their company. A role without the capability is a 403 (the page exists but is not theirs). */
export async function payrollActor(subject: AccessSubject, capability: Capability): Promise<ActorCtx> {
  if (!workforceCan(subject, capability)) throw new ForbiddenError('You do not have permission to perform this action');
  return resolveActor(subject);
}

/** A month that does not exist (or a key that is not a month) is a 404; it never reveals another company's. */
export async function requireMonth(companyId: string, monthKey: string): Promise<MonthRow> {
  if (!isMonthKey(monthKey)) throw new NotFoundError('There is no payroll for that month', 'NO_PAYROLL_MONTH');
  const month = await monthsRepository.find(companyId, monthKey);
  if (!month) throw new NotFoundError('There is no payroll for that month', 'NO_PAYROLL_MONTH');
  return month;
}

export const STATE_WORDS: Record<PayrollMonthState, string> = {
  WAITING: 'waiting to be calculated',
  IN_REVIEW: 'in review with HR',
  TO_APPROVE: 'with the Accountant',
  TO_PUBLISH: 'approved',
};

/** Every write names the state it is for. Another state answers 409 with the state in words, so the screen can reload. */
export function assertState(month: Pick<MonthRow, 'state'>, allowed: readonly PayrollMonthState[], code: string, message: string): void {
  if (!allowed.includes(month.state)) throw new ConflictError(`${message} (the month is ${STATE_WORDS[month.state]}).`, code, { state: month.state });
}

/** A stale `stateVersion` means someone else acted on the month after the screen loaded (E1). */
export function assertVersion(month: Pick<MonthRow, 'stateVersion'>, expected: number): void {
  if (month.stateVersion !== expected) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH', { stateVersion: month.stateVersion });
}
