export const AUDIT_CATEGORIES = [
  'PEOPLE',
  'TIME',
  'LEAVE',
  'PAY_SETUP',
  'PAY_RUN_PREPARE',
  'PAY_RUN_DECIDE',
  'RULES_OPERATING',
  'RULES_PAY',
  'PAYSLIP_ACCESS',
  'SENSITIVE_VIEW',
  'DISCIPLINE',
  'SECURITY',
  'DOCUMENTS',
  'LOG_ACCESS',
] as const;
export type AuditCategoryCode = (typeof AUDIT_CATEGORIES)[number];

/** Entries are kept 7 years, then archived (owner decision, 5 Oct 2026). Slice 0 deletes nothing; the archive job is slice 7. */
export const AUDIT_RETENTION_YEARS = 7;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Best-effort facts about where a request came from. Never a raw IP address. Never blocks a write. */
export interface AuditContext {
  deviceLabel: string | null; // 'Android, Chrome'
  placeLabel: string | null; // 'Nyeri'
}

export interface AuditActor {
  id: string | null; // null only for channel SYSTEM (a job)
  role: string; // UserRole at that moment, or 'SYSTEM'
  name: string; // snapshot
}

export type AuditChannelCode = 'APP' | 'SYSTEM' | 'ASSISTANT';

export interface AuditEntryInput {
  companyId: string;
  siteId: string | null; // null = company-wide
  actor: AuditActor;
  channel?: AuditChannelCode; // default APP; ASSISTANT marks "via assistant" (roadmap)
  action: string; // must be registered in AUDIT_ACTIONS
  category: AuditCategoryCode; // must be one the action allows
  subjectType: string;
  subjectId: string;
  subjectUserId?: string | null; // the person it is about; drives "Activity on my record"
  before?: JsonValue | null;
  after?: JsonValue | null; // never amounts for payslip opens; never a PIN or password
  reason?: string | null;
  context?: AuditContext;
}

export interface AuditEntryRecord {
  id: string;
  companyId: string;
  siteId: string | null;
  seq: bigint;
  occurredAt: Date;
  action: string;
  category: AuditCategoryCode;
  subjectType: string;
  subjectId: string;
  actorId: string | null;
  actorRole: string;
  actorName: string;
  channel: AuditChannelCode;
  subjectUserId: string | null;
  before: JsonValue | null;
  after: JsonValue | null;
  reason: string | null;
  deviceLabel: string | null;
  placeLabel: string | null;
  prevHash: string;
  hash: string;
}
