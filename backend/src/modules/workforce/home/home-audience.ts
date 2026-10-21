import { scopeOf, workforceCan, type AccessSubject } from '../_shared/workforce-access';
import type { HomeAudience } from './home-types';

const isHead = (subject: AccessSubject): boolean => subject.isDepartmentHead === true || subject.role === 'DEPARTMENT_HEAD' || (subject.headOfDepartmentIds?.length ?? 0) > 0;

/**
 * Which Home a person gets. Decided by what the access table gives them, so a change to the table moves the Home with it. The
 * two places a role name is read are the splits the table cannot make: a Store Manager and a Branch Manager hold the same grants
 * but run different places, and a head is a head whatever their base role.
 *
 *  - no file of their own and security alerts: the System Admin (the Director has a file)
 *  - the late site approval (Director only), then payroll approval (Accountant only), then sensitive people writes (HR)
 *  - unit reach on Needs you: the Store Manager or the Branch Manager
 *  - a department head
 *  - everyone else
 */
export function homeAudienceOf(subject: AccessSubject): HomeAudience {
  if (workforceCan(subject, 'security.alerts.read') && !workforceCan(subject, 'me.file')) return 'SYSTEM_ADMIN';
  if (workforceCan(subject, 'payroll.approve_site_late')) return 'DIRECTOR';
  if (workforceCan(subject, 'payroll.approve')) return 'ACCOUNTANT';
  if (workforceCan(subject, 'employee.write_sensitive')) return 'HR';
  if (scopeOf(subject, 'needs_you.read') === 'unit') return subject.role === 'STORE_MANAGER' ? 'STORE_MANAGER' : 'BRANCH_MANAGER';
  if (isHead(subject)) return 'HEAD';
  return 'STAFF';
}
