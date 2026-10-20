import { AUDIT_ACTIONS, type AuditActionCode } from './audit-actions';
import { AUDIT_TITLES } from './audit-titles';
import type { AuditCategoryCode, JsonValue } from './audit.types';

/** The part of an entry the wording needs. Both the stored record and an entry about to be written fit. */
export interface DescribableEntry {
  action: string;
  category: AuditCategoryCode;
  reason: string | null;
  before: JsonValue | null;
  after: JsonValue | null;
}

export interface EntryWording {
  title: string;
  detail: string;
  flagged: boolean;
}

const MONEY_OR_SECRET = /amount|net|gross|total|salary|wage|rate|kes|price|cost|code|pin|password|secret|bank|account|figure/i;
const PAY_CATEGORIES: readonly AuditCategoryCode[] = ['PAY_SETUP', 'PAY_RUN_PREPARE', 'PAY_RUN_DECIDE', 'RULES_PAY', 'SENSITIVE_VIEW'];
const LABELS: Record<string, string> = {
  month: 'Month',
  monthKey: 'Month',
  number: 'Number',
  documentNumber: 'Number',
  version: 'Version',
  headcount: 'People',
  count: 'Count',
  kind: 'Kind',
  format: 'Format',
  purpose: 'For',
  outcome: 'Outcome',
  decision: 'Decision',
  site: 'Site',
  date: 'Date',
  group: 'Rule',
};

const asRecord = (value: JsonValue | null): Record<string, JsonValue> | null => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null);
const scalar = (value: JsonValue | undefined): string | null => (typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 120) : null);

/**
 * Is this entry one a reader should look at twice (SD10)? Three wrong payslip codes, a payslip opened on an unconfirmed phone,
 * "This wasn't me", a chain failure, the 3rd wrong signing PIN, a payslip corrected after the bank file went out.
 */
export function isFlagged(entry: Pick<DescribableEntry, 'action' | 'after'>): boolean {
  const after = asRecord(entry.after);
  switch (entry.action) {
    case 'payslip.code_tried':
      return after?.success === false && typeof after.count === 'number' && after.count >= 3;
    case 'payslip.opened':
      return after?.unconfirmed === true;
    case 'payroll.payslip_corrected':
      return after?.bankFileVoided === true;
    case 'security.wasnt_me':
    case 'security.payslip_unconfirmed_phone':
    case 'security.signing_pin_wrong':
    case 'audit.chain_failed':
    case 'document.verify_failed':
    case 'document.mismatch_reported':
      return true;
    default:
      return false;
  }
}

function titleOf(entry: DescribableEntry): string {
  const after = asRecord(entry.after);
  if (entry.action === 'payslip.code_tried') {
    if (after?.success === true) return 'Payslip code right';
    return typeof after?.count === 'number' && after.count >= 3 ? 'Payslip code wrong 3 times' : 'Payslip code wrong';
  }
  return (AUDIT_TITLES as Record<string, string>)[entry.action] ?? 'Change recorded';
}

function detailOf(entry: DescribableEntry): string {
  if (!(entry.action in AUDIT_ACTIONS)) return entry.action;
  const after = asRecord(entry.after);
  const parts: string[] = [];
  if (entry.action === 'payslip.opened' && after?.unconfirmed === true) parts.push('On a phone that is not confirmed');
  const pay = PAY_CATEGORIES.includes(entry.category);
  if (after) {
    for (const [key, label] of Object.entries(LABELS)) {
      const value = MONEY_OR_SECRET.test(key) ? null : scalar(after[key]);
      if (value !== null) parts.push(`${label} ${value}`);
    }
    const fields = after.fields;
    if (Array.isArray(fields)) parts.push(`Fields: ${fields.filter((f): f is string => typeof f === 'string').slice(0, 8).join(', ')}`);
    const before = asRecord(entry.before);
    const field = scalar(after.field);
    if (!pay && field !== null && !MONEY_OR_SECRET.test(field) && before) {
      const from = scalar(before.value);
      const to = scalar(after.value);
      if (from !== null && to !== null) parts.push(`${field}: ${from} → ${to}`);
    }
  }
  if (entry.reason) parts.push(`Reason: ${entry.reason.slice(0, 200)}`);
  return parts.join(' · ');
}

/**
 * The one place an audit entry gets its words (A1). Pure. A detail is built only from an allow-list of keys and never from a key
 * that looks like money or a secret, so a title or detail cannot carry an amount, a code or a PIN. An unknown action reads
 * "Change recorded" with the action code as its detail (a test fails if a registered action has no wording).
 */
export function describeEntry(entry: DescribableEntry): EntryWording {
  return { title: titleOf(entry), detail: detailOf(entry), flagged: isFlagged(entry) };
}

/** SD2/SD3: sign-ins, phones and security are the Access area; everything else Workforce. Inventory joins when it writes here. */
export const areaOf = (action: string): 'WORKFORCE' | 'ACCESS' => (action.startsWith('security.') || action === 'audit.chain_failed' ? 'ACCESS' : 'WORKFORCE');

/** What search matches: the wording, the actor and the action code, lower case. */
export const searchTextOf = (wording: EntryWording, actorName: string, action: string): string => `${wording.title} ${wording.detail} ${actorName} ${action}`.toLowerCase().slice(0, 600);

export const isRegisteredAction =(action: string): action is AuditActionCode => action in AUDIT_ACTIONS;
