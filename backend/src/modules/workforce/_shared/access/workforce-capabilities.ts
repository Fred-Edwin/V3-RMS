import type { AuditCategoryCode } from '../audit/audit.types';

/**
 * The names the Workforce access table is written in: the scopes and the capabilities. `workforce-grants.ts` says which role holds
 * which; `workforce-access.ts` answers the questions and holds the guards. Import them from `workforce-access.ts`, which re-exports.
 */
export const SCOPES = ['own', 'dept', 'unit', 'all'] as const;
export type Scope = (typeof SCOPES)[number];

export const CAPABILITIES = [
  // my own things
  'me.file', // my employee file, including my own IDs, bank and documents
  'me.payslip', // my payslips, behind the payslip gate
  'me.payprofile', // my own pay profile
  'time.own', // clock in/out/undo, My time, Report a problem (removed when the person does not track time)
  // rota and the day
  'rota.read',
  'rota.write', // edit the rota (every edit is live at once; there is no publish step)
  'rota.template_write', // add, change and retire shift templates (company-wide ones need scope all)
  'today.read',
  'today.act', // clock for someone, mark absent, extend a shift
  'time.fix', // correct a clock event or add a missing one, always with a reason (slice 3 amendment)
  'attendance.switch', // turn a site's new clock on or off (slice 3 amendment)
  // time
  'timesheet.read',
  'timesheet.approve',
  'overtime.approve',
  'timesheet.close', // approve the month, with a PIN: the site's own manager only (Segment 1A amendment)
  'timesheet.export', // export a month as PDF or Excel (Segment 1A amendment)
  'overtime.note', // a department head's one-line note on an overtime item: evidence, never a decision (Segment 1A)
  'time_request.answer', // answer a Report a problem / "clocked out by mistake" request (Segment 1A: split from timesheet.approve)
  'manager_time.decide', // decide a site manager's own days and overtime (the Director; Segment 1A)
  'clock_mistake.resolve',
  'casual.record',
  'casual.approve',
  'casual.read',
  // leave
  'leave.request',
  'leave.acknowledge',
  'leave.read',
  'leave.approve',
  'leave.balance_adjust', // Segment 4: HR adds or removes days on a balance (PIN, reason, audit)
  // people
  'employee.read_basic',
  'employee.read_sensitive', // IDs, bank, documents
  'employee.write_basic', // hire basics, job details
  'employee.write_sensitive',
  'employee.lifecycle', // exit, rehire, transfer
  'probation.note', // a note on someone's probation (slice 1 amendment)
  'payprofile.read', // other people's pay profiles
  'payprofile.write',
  'payprofile.write_bank', // the bank and account only (the Accountant's Edit)
  'payprofile.approve', // approve or decline a pay change (slice 1 amendment)
  'org.read',
  'org.write', // departments and positions
  'org.write_heads', // assign and replace department heads
  // rules
  'rules.read',
  'rules.edit.lateness',
  'rules.edit.overtime',
  'rules.edit.attendance',
  'rules.edit.leave_types', // leave types and the default policy (HR)
  'rules.edit.min_cover', // minimum cover; unit scope writes the person's own site (1B, decision D5)
  'rules.edit.holiday_pay', // the pay rate for hours worked on a public holiday (Accountant, 1B decision D4)
  'rules.edit.probation',
  'rules.edit.casual_work',
  'rules.edit.conduct',
  'rules.edit.statutory',
  'rules.edit.holidays',
  'rules.edit.week_breaks',
  'rules.confirm.pay_rates', // overtime multipliers, holiday pay rate
  'rules.confirm.statutory',
  'rules.confirm.holiday_list',
  // pay
  'payroll.read', // the Payroll page and the statutory tables card (replaces payrun.read)
  'payroll.review', // HR: tick lines, add adjustments, leave people out, recalculate, send to the Accountant
  'payroll.approve', // Accountant: approve with a PIN, send back
  'payroll.publish', // HR (part 2)
  'payroll.pay', // Accountant: bank file, mark paid (part 2)
  'payroll.correct', // HR and Accountant (part 2)
  'payroll.export', // Accountant, HR, Director (part 2)
  'payroll.remind', // HR, Accountant, Director: remind a site that has not approved
  'payroll.estimate.read', // the Director's estimate of the open month
  'payroll.approve_site_late', // Director: approve a site's timesheet month for it, 5 days after month end (P4)
  'payslip.read_any', // HR, Accountant: open anyone's payslip from Payroll, no staff code, audited, the Director told (Segment 3, PD5)
  'p9.generate', // HR, Accountant: build a P9 for a leaver (Segment 3, PD13)
  'p9.confirm_format', // Accountant: confirm the P9 layout once, with a PIN (Segment 3, PD14)
  // conduct
  'discipline.read_own',
  'discipline.read',
  'discipline.issue',
  'discipline.decide', // Segment 5: HR decides appeals and changes notices; the Director decides notices HR issued (the service narrows it)
  // audit log (what each role may read is one capability per category)
  'audit.read_own', // "Activity on my record"
  'audit.read.people',
  'audit.read.time',
  'audit.read.leave',
  'audit.read.pay_setup',
  'audit.read.pay_run_prepare',
  'audit.read.pay_run_decide',
  'audit.read.rules_operating',
  'audit.read.rules_pay',
  'audit.read.payslip_access',
  'audit.read.sensitive_view',
  'audit.read.discipline',
  'audit.read.security',
  'audit.read.documents',
  'audit.read.log_access',
  // Segment 6a (Shared parts): Needs you, notifications, security alerts and phones, chain check
  'needs_you.read', // the Needs you card, its counts (badges) and the Overdue list for the Director
  'needs_you.remind', // Director: send a reminder on an overdue item
  'notifications.own', // the Inbox Notifications tab: my own rows only
  'security.alerts.read', // System Admin: the security alert list and its counts
  'security.alerts.clear', // System Admin: clear an alert with a one-line note; start alerts
  'security.phones.own', // my own phones: confirm, remove, "This wasn't me"
  'audit.verify_chain', // Director, System Admin: check the audit chain
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type Grants = Partial<Record<Capability, Scope>>;

type AuditReadCapability = `audit.read.${Lowercase<AuditCategoryCode>}`;
/** Compile-time check: every audit category has its read capability (fails the build if one is missing). */
export const AUDIT_CAPABILITIES_COMPLETE: Exclude<AuditReadCapability, Capability> extends never ? true : never = true;

export const auditReadCapability = (category: AuditCategoryCode): Capability => `audit.read.${category.toLowerCase()}` as AuditReadCapability;
