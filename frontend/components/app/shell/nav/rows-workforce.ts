import { AuditLogIcon } from '../nav-icons';
import type { NavRow } from './types';
import { ACCOUNTANT, DIRECTOR, HR_MANAGER, MANAGER, SHIFT_STAFF, STORE_ATTENDANT, STORE_MANAGER, SYSTEM_ADMIN, ico } from './shared';
import type { AppRole } from '@/types/auth';

/**
 * The Workforce menu (Paper 2.1 to 2.7): one feature row that opens with Overview and is split into Staff, Time, Pay and Setup
 * (small captions, text-only links). A closed feature shows the sum of its badges; an open one shows them on the links. The Department
 * row is the same shape for a department head. Personal items (My file, My payslips, ...) are the `account` group: they open from the
 * name at the bottom of the menu, never from the sidebar.
 */

/** The five desktop roles that have a Workforce menu. The System Admin has Home and Company only (it acts as a user instead). */
const WF_HR: AppRole = HR_MANAGER;
export const WF_DESKTOP: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER, ACCOUNTANT, DIRECTOR];
const WF_APPROVERS: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER];
const WF_PEOPLE: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER, DIRECTOR];
const WF_PAY: readonly AppRole[] = [WF_HR, ACCOUNTANT, DIRECTOR];
const OWN_FILE_ROLES: readonly AppRole[] = [...SHIFT_STAFF, STORE_ATTENDANT, ...WF_DESKTOP];

/*
 * Rows that need the new clock carry `needsAttendance`: they show only for a person whose branch has it on (`NavContext.attendanceOn`).
 * The pages still open by address for the roles the route gate lets in.
 */

export const WORKFORCE_ROWS: readonly NavRow[] = [
  {
    key: 'feature-workforce',
    label: 'Workforce',
    group: 'feature:workforce',
    icon: ico.staff,
    roles: WF_DESKTOP,
    subItems: [
      { key: 'overview', label: 'Overview', newHref: '/app/workforce', roles: WF_DESKTOP },
      // Staff
      { key: 'employees', label: 'Employees', section: 'Staff', newHref: '/app/workforce/employees', roles: [...WF_PEOPLE, ACCOUNTANT], match: ['/app/workforce/employees'] },
      { key: 'organisation', label: 'Organisation', section: 'Staff', newHref: '/app/workforce/organisation', roles: WF_PEOPLE, match: ['/app/workforce/organisation'] },
      { key: 'conduct', label: 'Conduct', section: 'Staff', newHref: '/app/workforce/conduct', roles: WF_PEOPLE, badge: 'workforce-conduct', needsAttendance: true, match: ['/app/workforce/conduct'] },
      // Time
      { key: 'shifts', label: 'Shifts', section: 'Time', newHref: '/app/workforce/schedule/rota', roles: [...WF_APPROVERS, DIRECTOR], needsAttendance: true, match: ['/app/workforce/schedule'] },
      { key: 'today', label: 'Today board', section: 'Time', newHref: '/app/workforce/today', roles: [WF_HR, MANAGER, STORE_MANAGER, DIRECTOR], needsAttendance: true },
      { key: 'timesheets', label: 'Timesheets', section: 'Time', newHref: '/app/workforce/timesheets', roles: [WF_HR, MANAGER, STORE_MANAGER, DIRECTOR], badge: 'workforce-timesheets', needsAttendance: true, match: ['/app/workforce/timesheets', '/app/workforce/requests'] },
      { key: 'leave', label: 'Leave', section: 'Time', newHref: '/app/workforce/leave', roles: WF_PEOPLE, badge: 'workforce-leave', needsAttendance: true, match: ['/app/workforce/leave'] },
      { key: 'casual-pay', label: 'Casual pay', section: 'Time', newHref: '/app/workforce/casuals/approve', roles: [MANAGER, STORE_MANAGER, DIRECTOR], match: ['/app/workforce/casuals'] },
      // Pay (the Branch Manager and the Store Manager see no pay)
      { key: 'payroll', label: 'Payroll', section: 'Pay', newHref: '/app/workforce/payroll', roles: WF_PAY, badge: 'workforce-payroll', needsPayroll: true, match: ['/app/workforce/payroll'] },
      { key: 'payslips', label: 'Payslips', section: 'Pay', newHref: '/app/workforce/payslips', roles: WF_PAY, notBuilt: true },
      // Setup
      { key: 'rules', label: 'Rules', section: 'Setup', newHref: '/app/workforce/rules', roles: WF_DESKTOP, match: ['/app/workforce/rules'] },
    ],
  },

  // The department head's own row (Paper 11.x): Overview, My team, Shifts, Timesheets. A head's Timesheets is not in the route gate
  // (spec D7), so it stays hidden until its page and gate exist: drop `notBuilt` then.
  {
    key: 'feature-department',
    label: 'Department',
    group: 'feature:department',
    icon: ico.departments,
    roles: SHIFT_STAFF,
    departmentHead: true,
    subItems: [
      { key: 'overview', label: 'Overview', newHref: '/app/workforce', roles: SHIFT_STAFF },
      { key: 'my-team', label: 'My team', newHref: '/app/workforce/team', roles: SHIFT_STAFF, match: ['/app/workforce/team', '/app/workforce/probation'] },
      { key: 'shifts', label: 'Shifts', newHref: '/app/workforce/schedule/rota', roles: SHIFT_STAFF, needsAttendance: true, match: ['/app/workforce/schedule'] },
      { key: 'today', label: 'Team today', newHref: '/app/workforce/today', roles: SHIFT_STAFF, needsAttendance: true },
      { key: 'casuals', label: 'Casual pay', newHref: '/app/workforce/casuals', roles: SHIFT_STAFF, match: ['/app/workforce/casuals'] },
      { key: 'timesheets', label: 'Timesheets', newHref: '/app/workforce/timesheets', roles: SHIFT_STAFF, notBuilt: true },
    ],
  },

  // Company (every role that has anything in it): the Workforce pages of the company level. The rest of the Company row is built from the
  // legacy admin and analytics rows by `menu.ts`.
  { key: 'wf-security', label: 'Security alerts', group: 'feature:company', icon: ico.shield, newHref: '/app/workforce/security', roles: [SYSTEM_ADMIN], badge: 'workforce-security', match: ['/app/workforce/security'] },
  { key: 'wf-audit-log', label: 'Audit log', group: 'feature:company', icon: AuditLogIcon, newHref: '/app/workforce/audit-log', roles: [...WF_DESKTOP, SYSTEM_ADMIN], needsAttendance: true, match: ['/app/workforce/audit-log'] },
  { key: 'wf-attendance-switch', label: 'Attendance switch', group: 'feature:company', icon: ico.timesheets, newHref: '/app/workforce/attendance/switch', roles: [SYSTEM_ADMIN, DIRECTOR] },
  { key: 'wf-rules-admin', label: 'Rules', group: 'feature:company', icon: ico.rules, newHref: '/app/workforce/rules', roles: [SYSTEM_ADMIN], match: ['/app/workforce/rules'] },

  // ── Personal items: open from the name at the bottom of the menu (Paper 2.x), for every person with a file ──────────────────────
  { key: 'me-file', label: 'My file', group: 'account', icon: ico.me, newHref: '/app/workforce/my-file', roles: OWN_FILE_ROLES, match: ['/app/workforce/my-file'] },
  { key: 'me-time', label: 'My time', group: 'account', icon: ico.myTime, newHref: '/app/workforce/my-time', roles: [...SHIFT_STAFF, STORE_ATTENDANT, ACCOUNTANT], needsAttendance: true, match: ['/app/workforce/my-time'] },
  { key: 'me-rota', label: 'My shifts', group: 'account', icon: ico.shifts, newHref: '/app/workforce/my-time/rota', roles: [...SHIFT_STAFF, STORE_ATTENDANT, ACCOUNTANT], needsAttendance: true },
  { key: 'me-requests', label: 'My requests', group: 'account', icon: ico.waiting, newHref: '/app/workforce/my-time/requests', roles: [...SHIFT_STAFF, STORE_ATTENDANT, ACCOUNTANT], needsAttendance: true },
  { key: 'me-leave', label: 'My leave', group: 'account', icon: ico.leave, newHref: '/app/workforce/my-leave', roles: OWN_FILE_ROLES, needsAttendance: true, match: ['/app/workforce/my-leave'] },
  { key: 'me-payslips', label: 'My payslips', group: 'account', icon: ico.payslips, newHref: '/app/workforce/my-payslips', roles: OWN_FILE_ROLES, match: ['/app/workforce/my-payslips'] },
  { key: 'me-record', label: 'Activity on my record', group: 'account', icon: ico.shield, newHref: '/app/workforce/my-record', roles: OWN_FILE_ROLES, needsAttendance: true, match: ['/app/workforce/my-record'] },
  { key: 'me-notices', label: 'My notices', group: 'account', icon: ico.shield, newHref: '/app/conduct', roles: OWN_FILE_ROLES, needsAttendance: true, match: ['/app/conduct'] },
];
