import type { UserRole } from '@prisma/client';
import { ForbiddenError } from '../../../../utils/errors';
import type { AuditEntryInput, JsonValue } from '../../_shared/audit/audit.types';
import { workforceCan, type AccessSubject, type Capability } from '../../_shared/workforce-access';
import { resolveActor, told, type ActorCtx } from '../../people/people-context';
import { conductPeopleRepository } from './conduct-people-repository';

export type { ActorCtx };

/** How a login's role reads in a message or on a signed record ("Faith Njeri, Branch Manager"). */
const ROLE_NAMES: Partial<Record<UserRole, string>> = {
  MANAGER: 'Branch Manager',
  STORE_MANAGER: 'Store Manager',
  HR_MANAGER: 'HR',
  DIRECTOR: 'Director',
  ACCOUNTANT: 'Accountant',
  SYSTEM_ADMIN: 'System Admin',
  STORE_ATTENDANT: 'Store Attendant',
  DEPARTMENT_HEAD: 'Department head',
};

export const roleName = (role: UserRole | string | null): string => {
  if (!role) return 'Staff';
  const known = ROLE_NAMES[role as UserRole];
  if (known) return known;
  return role.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
};

/** A notice HR issued is decided on appeal by the Director, never by HR (C8). The issuer's role is frozen on the notice. */
export const issuedByHr = (notice: { issuerRole: string }): boolean => notice.issuerRole === roleName('HR_MANAGER');

/** The caller as an actor with company and name; a caller without the capability gets 403 (a routes guard has normally already said so). */
export async function conductActor(subject: AccessSubject, capability: Capability): Promise<ActorCtx> {
  if (!workforceCan(subject, capability)) throw new ForbiddenError('You do not have permission to perform this action');
  return resolveActor(subject);
}

export interface ConductEntryArgs {
  ctx: ActorCtx;
  siteId: string | null;
  action: string;
  noticeId: string;
  /** The person the notice is about: it drives "Activity on my record". */
  subjectUserId: string | null;
  /** Level, number, status and reason fields only. Never a PIN, a code, or the own line. */
  after?: JsonValue | null;
  reason?: string | null;
  deviceLabel?: string | null;
}

/** One audit entry in category DISCIPLINE (spec section 11). Written in the same transaction as the change by `runAudited`. */
export const conductEntry = (args: ConductEntryArgs): AuditEntryInput => ({
  companyId: args.ctx.companyId,
  siteId: args.siteId,
  actor: args.ctx.auditActor,
  action: args.action,
  category: 'DISCIPLINE',
  subjectType: 'ConductNotice',
  subjectId: args.noticeId,
  subjectUserId: args.subjectUserId,
  before: null,
  after: args.after ?? null,
  reason: args.reason ?? null,
  ...(args.deviceLabel ? { context: { deviceLabel: args.deviceLabel, placeLabel: null } } : {}),
});

/** A system actor for the daily job (channel SYSTEM). */
export const SYSTEM_ACTOR = { id: null, role: 'SYSTEM', name: 'System' } as const;

/** HR logins in the company: told about new notices and appeals. */
export const hrUserIds = (companyId: string): Promise<string[]> => conductPeopleRepository.userIdsByRoles(companyId, ['HR_MANAGER']);

/** Director logins in the company. */
export const directorUserIds = (companyId: string): Promise<string[]> => conductPeopleRepository.userIdsByRoles(companyId, ['DIRECTOR']);

/**
 * Tells people through the notifier, best effort (it never fails the change that has already committed). The data carries roles, a
 * level label and a number: never the own line, the facts or a reason (C27).
 */
export async function tellAbout(recipients: readonly (string | null | undefined)[], kind: string, data: Record<string, string | number | null>, dedupeKey?: string): Promise<void> {
  await told(recipients, kind, data, dedupeKey ? { dedupeKey } : undefined);
}
