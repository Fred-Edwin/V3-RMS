import { auditReadCapability, scopeOf, workforceCan, type AccessSubject, type Scope } from '../workforce-access';
import { AUDIT_CATEGORIES, type AuditCategoryCode, type AuditEntryRecord } from './audit.types';

export interface AuditReadScope {
  categories: AuditCategoryCode[]; // what this person may read company-log style; empty = none
  scope: Scope; // 'all' or 'unit' (unit: only rows whose siteId is the person's own)
  siteId: string | null; // set when scope is 'unit'
  ownRecord: boolean; // may read "Activity on my record"
}

/** "Activity on my record" never includes these ("who looked at the log" is not read by the people being watched). */
export const OWN_RECORD_EXCLUDED_CATEGORIES: readonly AuditCategoryCode[] = ['LOG_ACCESS'];

/**
 * Pure. From the access table only. A department head and ordinary staff get an empty category list and
 * ownRecord true. The Director gets every category, including LOG_ACCESS. Nobody else sees LOG_ACCESS.
 * When a person's categories carry different scopes the narrowest applies to all of them (nothing is widened).
 */
export function auditReadScopeOf(subject: AccessSubject): AuditReadScope {
  const categories = AUDIT_CATEGORIES.filter((category) => workforceCan(subject, auditReadCapability(category)));
  const scopes = categories.map((category) => scopeOf(subject, auditReadCapability(category)));
  const scope: Scope = scopes.includes('unit') ? 'unit' : scopes.length > 0 ? 'all' : 'unit';
  return {
    categories: [...categories],
    scope,
    siteId: scope === 'unit' ? subject.siteId : null,
    ownRecord: workforceCan(subject, 'audit.read_own'),
  };
}

export interface AuditQuery {
  from?: Date;
  to?: Date;
  category?: AuditCategoryCode;
  actorId?: string;
  subjectUserId?: string;
  limit: number;
  before?: bigint; // keyset paging by seq, newest first
}

export interface AuditPage {
  entries: AuditEntryRecord[];
  nextBefore: bigint | null;
}

/** Slice 7 implements. Every call that returns rows to a non-"own" reader also writes an `audit.log_viewed` entry. */
export interface AuditReader {
  list(subject: AccessSubject, query: AuditQuery): Promise<AuditPage>;
  activityOnMyRecord(subject: AccessSubject, query: AuditQuery): Promise<AuditPage>;
}
