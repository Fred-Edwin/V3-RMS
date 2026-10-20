import { ForbiddenError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import type { AuditActor } from '../_shared/audit/audit.types';
import { getWorkforceNotifier } from '../_shared/events';
import { nairobiToday, type NairobiDate } from '../_shared/time/nairobi-time';
import type { AccessSubject } from '../_shared/workforce-access';
import { employeesRepository } from './employees/employees-repository';

/** "Today" in Nairobi; `now` is passed in so tests can pick the day. */
export const todayOf = (now: Date = new Date()): NairobiDate => nairobiToday(now);

export interface ActorCtx {
  subject: AccessSubject;
  companyId: string;
  name: string;
  /** For the audit entry. */
  auditActor: AuditActor;
}

/** The actor's company: through their own site, or (a System Admin has none) the one active company. */
export async function resolveActor(subject: AccessSubject): Promise<ActorCtx> {
  const user = await employeesRepository.findActor(subject.id);
  const companyId = user?.site?.companyId ?? (await employeesRepository.findOnlyCompanyId());
  if (!companyId) throw new ForbiddenError('Your account is not linked to a company', 'PEOPLE_COMPANY_UNKNOWN');
  const name = user?.name ?? 'Unknown';
  return { subject, companyId, name, auditActor: { id: subject.id, role: subject.role, name } };
}

/** "X is told": best effort, never blocks or fails the change that has already committed. The wording is a later slice. */
export async function told(
  recipientUserIds: readonly (string | null | undefined)[],
  kind: string,
  data: Record<string, string | number | null> = {},
  options?: { dedupeKey?: string; replace?: boolean },
): Promise<void> {
  const notifier = getWorkforceNotifier();
  const unique = [...new Set(recipientUserIds.filter((id): id is string => typeof id === 'string'))];
  await Promise.all(
    unique.map(async (userId) => {
      try {
        await notifier.notify(userId, kind, data, options);
      } catch (error) {
        logger.error({ err: error, kind }, 'workforce notification failed');
      }
    }),
  );
}
