import { logger } from '../../../utils/logger';
import { nudgeUsers, notifyMany, type NotifyData } from '../notifications';
import { peopleRepository, type LeavePerson } from './data/people-repository';
import type { DeciderRole } from './leave.constants';

/** The people who currently hold a deciding role for this person's request: a site's own manager, or the company's HR / Director. */
export async function deciderUserIds(role: DeciderRole, person: Pick<LeavePerson, 'companyId' | 'siteId'>): Promise<string[]> {
  const holders = role === 'MANAGER' || role === 'STORE_MANAGER' ? await peopleRepository.holders([role], { companyId: person.companyId, siteId: person.siteId }) : await peopleRepository.companyHolders([role], person.companyId);
  return holders.map((holder) => holder.userId);
}

/** The department head's login (not the person themself), for "told on approval". Null when there is no head or no login. */
export async function headUserId(person: LeavePerson, date: Parameters<typeof peopleRepository.headOf>[1]): Promise<string | null> {
  if (!person.departmentId) return null;
  const head = await peopleRepository.headOf(person.departmentId, date);
  return head && head.employeeId !== person.id ? head.userId : null;
}

/**
 * Tell people and nudge their screens. Best effort: a notice that fails is logged and never undoes the change that committed
 * (the notifier itself already swallows send errors; this guards the lookups around it).
 */
export async function tell(userIds: readonly (string | null | undefined)[], kind: string, data: NotifyData, dedupeKey?: string): Promise<void> {
  try {
    const targets = [...new Set(userIds.filter((id): id is string => typeof id === 'string'))];
    if (targets.length === 0) return;
    await notifyMany(targets, kind, data, dedupeKey ? { dedupeKey } : undefined);
    nudgeUsers(targets, 'workforce:needs-you');
  } catch (error) {
    logger.error({ err: error, kind }, 'leave notification failed');
  }
}
