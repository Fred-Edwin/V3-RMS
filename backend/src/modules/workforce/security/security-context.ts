import { ForbiddenError } from '../../../utils/errors';
import type { AuditActor, AuditEntryInput, JsonValue } from '../_shared/audit/audit.types';
import { workforceCan, type AccessSubject, type Capability } from '../_shared/workforce-access';
import { resolveActor, type ActorCtx } from '../people/people-context';

/** A caller without the capability gets a 403 (the routes already refuse; this guards a service called from elsewhere). */
export async function securityActor(subject: AccessSubject, capability: Capability): Promise<ActorCtx> {
  if (!workforceCan(subject, capability)) throw new ForbiddenError('You do not have permission to perform this action');
  return resolveActor(subject);
}

export interface SecurityEntryArgs {
  companyId: string;
  siteId?: string | null;
  actor: AuditActor;
  action: string;
  subjectType: 'User' | 'Device' | 'Alert' | 'Company';
  subjectId: string;
  /** The person it is about: it drives "Activity on my record". */
  subjectUserId?: string | null;
  /** Device and place labels, a month name, an entry number. Never an amount, a code, a PIN or a password. */
  after?: JsonValue | null;
  reason?: string | null;
  deviceLabel?: string | null;
  placeLabel?: string | null;
}

export const securityEntry = (a: SecurityEntryArgs): AuditEntryInput => ({
  companyId: a.companyId,
  siteId: a.siteId ?? null,
  actor: a.actor,
  action: a.action,
  category: 'SECURITY',
  subjectType: a.subjectType,
  subjectId: a.subjectId,
  subjectUserId: a.subjectUserId ?? null,
  before: null,
  after: a.after ?? null,
  reason: a.reason ?? null,
  ...(a.deviceLabel || a.placeLabel ? { context: { deviceLabel: a.deviceLabel ?? null, placeLabel: a.placeLabel ?? null } } : {}),
});
