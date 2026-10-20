import type { AuditActor, AuditChannelCode, AuditEntryInput, JsonValue } from '../_shared/audit/audit.types';

export { SYSTEM_ACTOR, eventOf } from '../attendance/attendance-audit';

/** A plain object as audit JSON (undefined fields drop out). */
export const asJson = (value: Record<string, unknown>): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

export interface LeaveEntryArgs {
  companyId: string;
  siteId: string;
  actor: AuditActor;
  channel?: AuditChannelCode;
  action: string;
  /** The application id, or the person's id for a balance adjustment. */
  subjectId: string;
  subjectType?: string;
  /** The person it is about: it shows up in their "Activity on my record". */
  userId: string | null;
  before?: JsonValue | null;
  after?: JsonValue | null;
  reason?: string | null;
}

/**
 * A leave audit entry, category LEAVE: dates, day counts, type codes and reason chips. Never a note's text, a PIN, or a balance
 * beyond days (the entry records the method "PIN", not the PIN).
 */
export const leaveEntry = (args: LeaveEntryArgs): AuditEntryInput => ({
  companyId: args.companyId,
  siteId: args.siteId,
  actor: args.actor,
  ...(args.channel ? { channel: args.channel } : {}),
  action: args.action,
  category: 'LEAVE',
  subjectType: args.subjectType ?? 'LeaveApplication',
  subjectId: args.subjectId,
  subjectUserId: args.userId,
  before: args.before ?? null,
  after: args.after ?? null,
  reason: args.reason ?? null,
});
