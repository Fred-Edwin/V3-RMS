/**
 * The Workforce capabilities the front end may ask about. This is the list in
 * `backend/src/modules/workforce/_shared/workforce-access.ts` (`CAPABILITIES`); the server's table is the only authority and answers
 * `GET /workforce/permissions/me`, so this file holds names, never who holds them. Add a name here when a slice needs it.
 * A card says who may see it by these names, never by a role name.
 */
export type WorkforceCapability =
  | 'me.file'
  | 'me.payslip'
  | 'me.payprofile'
  | 'time.own'
  | 'rota.read'
  | 'rota.write'
  | 'rota.template_write'
  | 'today.read'
  | 'today.act'
  | 'timesheet.read'
  | 'timesheet.approve'
  | 'timesheet.close'
  | 'timesheet.export'
  | 'time.fix'
  | 'attendance.switch'
  | 'overtime.approve'
  | 'overtime.note'
  | 'time_request.answer'
  | 'manager_time.decide'
  | 'clock_mistake.resolve'
  | 'casual.record'
  | 'casual.approve'
  | 'casual.read'
  | 'payslip.read_any'
  | 'p9.generate'
  | 'p9.confirm_format'
  | 'audit.read.payslip_access'
  | 'leave.request'
  | 'leave.acknowledge'
  | 'leave.read'
  | 'leave.approve'
  | 'employee.read_basic'
  | 'employee.read_sensitive'
  | 'employee.write_basic'
  | 'employee.write_sensitive'
  | 'employee.lifecycle'
  | 'probation.note'
  | 'payprofile.read'
  | 'payprofile.write'
  | 'payprofile.approve'
  | 'org.read'
  | 'org.write'
  | 'org.write_heads'
  | 'rules.read'
  | 'payroll.read'
  | 'payroll.review'
  | 'payroll.approve'
  | 'payroll.publish'
  | 'payroll.pay'
  | 'payroll.correct'
  | 'payroll.export'
  | 'payroll.remind'
  | 'payroll.estimate.read'
  | 'payroll.approve_site_late'
  | 'discipline.read_own'
  | 'discipline.read'
  | 'discipline.issue'
  | 'audit.read_own'
  // Shared parts, back end A (segment 6a): the Needs you card, reminders, the Inbox notifications, the person's phones and the alerts.
  | 'needs_you.read'
  | 'needs_you.remind'
  | 'notifications.own'
  | 'security.phones.own'
  | 'security.alerts.read'
  | 'security.alerts.clear'
  | 'audit.verify_chain';

export type WorkforceScope = 'own' | 'dept' | 'unit' | 'all';

/** What `GET /workforce/permissions/me` returns in `data` (the fields Home uses). */
export interface WorkforcePermissionsPayload {
  role: string;
  /** The person's branch; the wire still calls a Site an organization. */
  organizationId: string | null;
  isDepartmentHead: boolean;
  departmentTag: string | null;
  tracksTime: boolean;
  /** The departments this person heads today; a casual-pay sheet is found by site and one of these. */
  headOfDepartmentIds?: readonly string[];
  capabilities: ReadonlyArray<{ capability: WorkforceCapability; scope: WorkforceScope }>;
}
