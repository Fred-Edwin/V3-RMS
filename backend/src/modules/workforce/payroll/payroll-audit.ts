import type { AuditActor, AuditCategoryCode, AuditEntryInput, JsonValue } from '../_shared/audit/audit.types';

export { SYSTEM_ACTOR, eventOf } from '../timesheets/timesheets-audit';

/** The categories payroll files its entries under (who may read them is the audit log's table, slice 7). */
export type PayrollAuditCategory = Extract<AuditCategoryCode, 'PAY_RUN_PREPARE' | 'PAY_RUN_DECIDE'>;

export interface PayrollEntryArgs {
  companyId: string;
  actor: AuditActor;
  channel?: 'APP' | 'SYSTEM';
  action: string;
  category: PayrollAuditCategory;
  monthId: string;
  /** Counts, states, document numbers and reasons. Never a pay figure, a PIN or a bank account number. */
  before?: JsonValue | null;
  after?: JsonValue | null;
  reason?: string | null;
  subjectUserId?: string | null;
}

/** A payroll audit entry: company wide (a month belongs to the company), filed against the month. */
export const payrollEntry = (args: PayrollEntryArgs): AuditEntryInput => ({
  companyId: args.companyId,
  siteId: null,
  actor: args.actor,
  ...(args.channel ? { channel: args.channel } : {}),
  action: args.action,
  category: args.category,
  subjectType: 'PayrollMonth',
  subjectId: args.monthId,
  subjectUserId: args.subjectUserId ?? null,
  before: args.before ?? null,
  after: args.after ?? null,
  reason: args.reason ?? null,
});
