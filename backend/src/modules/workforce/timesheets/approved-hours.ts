import type { NairobiDate } from '../_shared/time/nairobi-time';
import { daysRepository } from '../attendance/days/days-repository';
import { approvedRepository } from './approved-repository';

export interface ApprovedHours {
  workedMinutes: number;
  overtimeApprovedMinutes: number;
}

/**
 * What reporting and payroll may use: the minutes of the person's days that are approved (by the system or a person), and the
 * overtime that has been authorised. Raw clock events are never read here. Held, waiting and carried-open days count for
 * nothing until someone answers them. Minutes only: payroll turns them into pay.
 */
export async function getApprovedHours(userId: string, period: { start: NairobiDate; end: NairobiDate }): Promise<ApprovedHours> {
  const person = await daysRepository.personByUserId(userId);
  if (!person) return { workedMinutes: 0, overtimeApprovedMinutes: 0 };
  return approvedRepository.minutes(person.siteId, person.id, period.start, period.end);
}
