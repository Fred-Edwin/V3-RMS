import { auditReadScopeOf, type AuditReadScope } from '../_shared/audit/audit-read';
import type { AuditCategoryCode } from '../_shared/audit/audit.types';
import type { AccessSubject } from '../_shared/workforce-access';

/** The Event menu of the log (A1). `all` and `flagged` are not events: `flagged` is its own switch. */
export const EVENT_CODES = ['people', 'time', 'leave', 'pay', 'rules', 'payslips', 'documents', 'conduct', 'security'] as const;
export type EventCode = (typeof EVENT_CODES)[number];

export const EVENT_LABELS: Record<EventCode, string> = {
  people: 'People',
  time: 'Time and attendance',
  leave: 'Leave',
  pay: 'Pay and payroll',
  rules: 'Rules',
  payslips: 'Payslip access',
  documents: 'Documents',
  conduct: 'Conduct',
  security: 'Security and sign-ins',
};

/** Every category belongs to exactly one event. Reads of the log itself (LOG_ACCESS, Director only) sit with security. */
const EVENT_CATEGORIES: Record<EventCode, readonly AuditCategoryCode[]> = {
  people: ['PEOPLE', 'SENSITIVE_VIEW'],
  time: ['TIME'],
  leave: ['LEAVE'],
  pay: ['PAY_SETUP', 'PAY_RUN_PREPARE', 'PAY_RUN_DECIDE'],
  rules: ['RULES_OPERATING', 'RULES_PAY'],
  payslips: ['PAYSLIP_ACCESS'],
  documents: ['DOCUMENTS'],
  conduct: ['DISCIPLINE'],
  security: ['SECURITY', 'LOG_ACCESS'],
};

export const eventOfCategory = (category: AuditCategoryCode): EventCode => {
  const found = EVENT_CODES.find((event) => EVENT_CATEGORIES[event].includes(category));
  if (!found) throw new Error(`Audit category ${category} belongs to no event`);
  return found;
};

export interface LogScope {
  categories: AuditCategoryCode[];
  /** Set when the reader sees only one site's rows. */
  siteId: string | null;
  unit: boolean;
}

/** What this reader may read in the company log, from the access table only. Null = not a reader at all (the route answers 404). */
export function logScopeOf(subject: AccessSubject): LogScope | null {
  const scope: AuditReadScope = auditReadScopeOf(subject);
  if (scope.categories.length === 0) return null;
  return { categories: scope.categories, siteId: scope.scope === 'unit' ? scope.siteId : null, unit: scope.scope === 'unit' };
}

/**
 * The categories to filter by: the reader's own, narrowed by the Event they chose. A category the reader may not read is dropped
 * here, in the query's input, so a count can never leak. An event the reader cannot read gives an empty list (an empty answer, not a 403).
 */
export function categoriesFor(scope: LogScope, event: EventCode | 'all'): AuditCategoryCode[] {
  if (event === 'all') return scope.categories;
  return scope.categories.filter((category) => EVENT_CATEGORIES[event].includes(category));
}

/** The Event menu lists only readable events. */
export const readableEvents = (scope: LogScope): { code: EventCode; label: string }[] =>
  EVENT_CODES.filter((event) => categoriesFor(scope, event).length > 0).map((code) => ({ code, label: EVENT_LABELS[code] }));

/**
 * "About" on a payslip-opening row shows the person only to the Director (A7); pay-figure panels only to readers of PAY_RUN_DECIDE.
 */
export const mayNameSubject = (category: AuditCategoryCode, scope: LogScope): boolean =>
  category !== 'PAYSLIP_ACCESS' || scope.categories.includes('LOG_ACCESS');

export const mayReadChanges = (category: AuditCategoryCode, scope: LogScope): boolean => {
  if (category === 'PAYSLIP_ACCESS' || category === 'SENSITIVE_VIEW') return false;
  const pay = category === 'PAY_SETUP' || category === 'PAY_RUN_PREPARE' || category === 'PAY_RUN_DECIDE' || category === 'RULES_PAY';
  return !pay || scope.categories.includes('PAY_RUN_DECIDE');
};

/** Device and place only for the Director and the System Admin (A3). */
export const maySeeDevice = (scope: LogScope): boolean => scope.categories.includes('LOG_ACCESS') || scope.categories.includes('SECURITY');
