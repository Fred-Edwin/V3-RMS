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
  | 'overtime.approve'
  | 'clock_mistake.resolve'
  | 'casual.record'
  | 'casual.approve'
  | 'casual.read'
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
  | 'payrun.read'
  | 'payrun.prepare'
  | 'payrun.approve'
  | 'payrun.publish'
  | 'payrun.reopen'
  | 'discipline.read_own'
  | 'discipline.read'
  | 'discipline.issue'
  | 'audit.read_own';

export type WorkforceScope = 'own' | 'dept' | 'unit' | 'all';

/** What `GET /workforce/permissions/me` returns in `data` (the fields Home uses). */
export interface WorkforcePermissionsPayload {
  role: string;
  siteId: string | null;
  isDepartmentHead: boolean;
  departmentTag: string | null;
  tracksTime: boolean;
  capabilities: ReadonlyArray<{ capability: WorkforceCapability; scope: WorkforceScope }>;
}
