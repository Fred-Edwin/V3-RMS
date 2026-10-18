import type { AuditActor, AuditChannelCode, AuditEntryInput, JsonValue } from '../_shared/audit/audit.types';

export { SYSTEM_ACTOR, eventOf } from '../attendance/attendance-audit';

/** A plain object as audit JSON (undefined fields drop out). */
export const asJson = (value: Record<string, unknown>): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

export interface TimesheetEntryArgs {
  companyId: string;
  siteId: string;
  actor: AuditActor;
  channel?: AuditChannelCode;
  action: string;
  /** What the entry is about: a person (their "Activity on my record") or, for a period, the period id. */
  subjectId: string;
  subjectType?: string;
  userId?: string | null;
  before?: JsonValue | null;
  after?: JsonValue | null;
  reason?: string | null;
}

/** A timesheet audit entry: category TIME, minutes, dates and reasons only, never a pay figure. */
export const timesheetEntry = (args: TimesheetEntryArgs): AuditEntryInput => ({
  companyId: args.companyId,
  siteId: args.siteId,
  actor: args.actor,
  ...(args.channel ? { channel: args.channel } : {}),
  action: args.action,
  category: 'TIME',
  subjectType: args.subjectType ?? 'Timesheet',
  subjectId: args.subjectId,
  subjectUserId: args.userId ?? null,
  before: args.before ?? null,
  after: args.after ?? null,
  reason: args.reason ?? null,
});
