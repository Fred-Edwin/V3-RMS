import type { AuditActor, AuditChannelCode, AuditEntryInput, JsonValue } from '../_shared/audit/audit.types';
import type { WorkforceEvent, WorkforceEventName, WorkforceEventPayloads } from '../_shared/events';

/** Who a job acts as in the audit chain. */
export const SYSTEM_ACTOR: AuditActor = { id: null, role: 'SYSTEM', name: 'System' };

export interface TimeEntryArgs {
  companyId: string;
  siteId: string;
  actor: AuditActor;
  channel?: AuditChannelCode;
  action: string;
  /** The person it is about. The entry shows up in their "Activity on my record". */
  employeeId: string;
  userId: string | null;
  before?: JsonValue | null;
  after?: JsonValue | null;
  reason?: string | null;
}

/** An attendance audit entry: category TIME, times and reasons only, never a pay figure. */
export const timeEntry = (args: TimeEntryArgs): AuditEntryInput => ({
  companyId: args.companyId,
  siteId: args.siteId,
  actor: args.actor,
  ...(args.channel ? { channel: args.channel } : {}),
  action: args.action,
  category: 'TIME',
  subjectType: 'Attendance',
  subjectId: args.employeeId,
  subjectUserId: args.userId,
  before: args.before ?? null,
  after: args.after ?? null,
  reason: args.reason ?? null,
});

/** A typed event for `runAudited` to emit after the commit. */
export const eventOf = <N extends WorkforceEventName>(name: N, payload: WorkforceEventPayloads[N], at: Date): WorkforceEvent =>
  ({ name, payload, occurredAt: at.toISOString() }) as WorkforceEvent;
