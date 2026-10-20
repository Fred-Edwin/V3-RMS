import { ForbiddenError } from '../../../utils/errors';
import type { AuditActor, AuditCategoryCode, AuditEntryInput, JsonValue } from '../_shared/audit/audit.types';
import { workforceCan, type AccessSubject, type Capability } from '../_shared/workforce-access';
import { resolveActor, type ActorCtx } from '../people/people-context';

export { eventOf } from '../timesheets/timesheets-audit';

/** A caller without the capability gets a 403 (the System Admin has no payslip, so every `me.payslip` route is theirs to be refused). */
export async function payslipActor(subject: AccessSubject, capability: Capability): Promise<ActorCtx> {
  if (!workforceCan(subject, capability)) throw new ForbiddenError('You do not have permission to perform this action');
  return resolveActor(subject);
}

export interface PayslipEntryArgs {
  companyId: string;
  siteId?: string | null;
  actor: AuditActor;
  action: string;
  category: Extract<AuditCategoryCode, 'PAYSLIP_ACCESS' | 'SECURITY' | 'DOCUMENTS' | 'PAY_RUN_DECIDE'>;
  subjectType: 'User' | 'Payslip' | 'P9' | 'P9Format';
  subjectId: string;
  /** The person it is about: it drives "Activity on my record". */
  subjectUserId?: string | null;
  /** Document numbers, versions, purposes, device labels, counts. Never an amount, a code or a PIN. */
  after?: JsonValue | null;
  reason?: string | null;
  deviceLabel?: string | null;
}

export const payslipEntry = (args: PayslipEntryArgs): AuditEntryInput => ({
  companyId: args.companyId,
  siteId: args.siteId ?? null,
  actor: args.actor,
  action: args.action,
  category: args.category,
  subjectType: args.subjectType,
  subjectId: args.subjectId,
  subjectUserId: args.subjectUserId ?? null,
  before: null,
  after: args.after ?? null,
  reason: args.reason ?? null,
  ...(args.deviceLabel ? { context: { deviceLabel: args.deviceLabel, placeLabel: null } } : {}),
});
