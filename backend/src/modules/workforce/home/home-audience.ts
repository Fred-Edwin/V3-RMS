import { scopeOf, workforceCan, type AccessSubject, type Capability } from '../_shared/workforce-access';
import type { NeedsYouRow } from '../needs-you/needs-you-types';
import type { StoredNotification } from '../notifications/notification-types';
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

/**
 * What a Home card shows only to the people it concerns. A head or a waiter is told "Payroll paid" by the notifier (their payslip is
 * ready), but Home's Latest is for what they can act on or read, so that line stays in the Inbox only.
 */
const LATEST_NEEDS: Readonly<Record<string, Capability>> = { 'payroll.month_paid': 'payroll.read' };

export function latestFor(subject: AccessSubject, items: readonly StoredNotification[], limit: number): StoredNotification[] {
  return items.filter((n) => LATEST_NEEDS[n.kind] === undefined || workforceCan(subject, LATEST_NEEDS[n.kind] as Capability)).slice(0, limit);
}

/** The Needs you kinds the System Admin may see: the admin decides security alerts, nothing of pay or time. */
const ADMIN_KINDS: ReadonlySet<string> = new Set(['security']);

/** Needs you lists only what the role can decide: for the System Admin that is security alerts, not a pay change or a closed shift. */
export function needsYouRowsFor<T extends Pick<NeedsYouRow, 'kind'>>(subject: AccessSubject, rows: readonly T[]): T[] {
  return homeAudienceOf(subject) === 'SYSTEM_ADMIN' ? rows.filter((r) => ADMIN_KINDS.has(r.kind)) : [...rows];
}
