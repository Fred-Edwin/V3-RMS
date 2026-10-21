import { AuditLogIcon } from '../nav-icons';
import type { NavRow } from './types';
import { ACCOUNTANT, DIRECTOR, HR_MANAGER, MANAGER, STORE_ATTENDANT, STORE_MANAGER, SHIFT_STAFF, SYSTEM_ADMIN, ico } from './shared';
import type { AppRole } from '@/types/auth';

/** The five desktop roles of the Workforce menu (Paper Chapter 1, step 01). */
const WF_HR: AppRole = HR_MANAGER;
export const WF_DESKTOP: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER, ACCOUNTANT, DIRECTOR];
const WF_APPROVERS: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER];
const WF_PEOPLE: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER, DIRECTOR];
const WF_PAY: readonly AppRole[] = [WF_HR, ACCOUNTANT, DIRECTOR];

/*
 * The Schedule rows, the Today board and the floor staff's Home link carry `needsAttendance`: they show only for a person whose branch has
 * the new clock switched on (`NavContext.attendanceOn`, from the Attendance switch).
 */

export const WORKFORCE_ROWS: readonly NavRow[] = [
  { key: 'wf-home', label: 'Home', group: 'wf-workforce', icon: ico.home, newHref: '/app/workforce', roles: [...WF_DESKTOP, SYSTEM_ADMIN] },
  { key: 'wf-attendance-switch', label: 'Attendance clock', group: 'wf-workforce', icon: ico.timesheets, newHref: '/app/workforce/attendance/switch', roles: [SYSTEM_ADMIN] },
  { key: 'wf-today', label: 'Today board', group: 'wf-workforce', icon: ico.timesheets, newHref: '/app/workforce/today', roles: [WF_HR, DIRECTOR], needsAttendance: true },
  {
    key: 'wf-schedule',
    label: 'Schedule',
    group: 'wf-workforce',
    icon: ico.shifts,
    roles: [...WF_APPROVERS, DIRECTOR],
    needsAttendance: true,
    subItems: [
      { key: 'rota', label: 'Rota', newHref: '/app/workforce/schedule/rota', roles: [...WF_APPROVERS, DIRECTOR] },
      { key: 'templates', label: 'Shift templates', newHref: '/app/workforce/schedule/templates', roles: [...WF_APPROVERS, DIRECTOR] },
    ],
  },
  { key: 'wf-timesheets', label: 'Timesheets', group: 'wf-workforce', icon: ico.timesheets, newHref: '/app/workforce/timesheets', roles: [MANAGER, STORE_MANAGER], badge: 'workforce-timesheets', needsAttendance: true, match: ['/app/workforce/timesheets'] },
  { key: 'wf-head-office-timesheets', label: 'Head office timesheets', group: 'wf-workforce', icon: ico.timesheets, newHref: '/app/workforce/timesheets', roles: [DIRECTOR], badge: 'workforce-timesheets', needsAttendance: true, match: ['/app/workforce/timesheets'] },
  { key: 'wf-requests-hr', label: 'Requests', group: 'wf-workforce', icon: ico.waiting, newHref: '/app/workforce/requests', roles: [WF_HR], badge: 'workforce-timesheets', needsAttendance: true, match: ['/app/workforce/requests'] },
  { key: 'wf-requests', label: 'Requests', group: 'wf-workforce', icon: ico.waiting, newHref: '/app/workforce/requests', roles: [MANAGER, STORE_MANAGER, DIRECTOR], needsAttendance: true },
  { key: 'wf-employees-acc', label: 'Employees', group: 'wf-workforce', icon: ico.staff, newHref: '/app/workforce/employees', roles: [ACCOUNTANT] },
  { key: 'wf-employees', label: 'Employees', group: 'wf-people', icon: ico.staff, newHref: '/app/workforce/employees', roles: WF_PEOPLE, match: ['/app/workforce/employees'] },
  { key: 'wf-organisation', label: 'Organisation', group: 'wf-people', icon: ico.organisation, newHref: '/app/workforce/organisation', roles: [WF_HR, MANAGER, STORE_MANAGER, DIRECTOR], match: ['/app/workforce/organisation'] },
  { key: 'wf-leave', label: 'Leave', group: 'wf-people', icon: ico.leave, newHref: '/app/workforce/leave', roles: WF_PEOPLE, badge: 'workforce-leave', needsAttendance: true, match: ['/app/workforce/leave'] },
  { key: 'wf-conduct', label: 'Conduct', group: 'wf-people', icon: ico.shield, newHref: '/app/workforce/conduct', roles: WF_PEOPLE, badge: 'workforce-conduct', needsAttendance: true, match: ['/app/workforce/conduct'] },
  { key: 'wf-pay-runs', label: 'Payroll', group: 'wf-pay', icon: ico.money, newHref: '/app/workforce/payroll', roles: [...WF_PAY, SYSTEM_ADMIN], badge: 'workforce-payroll', needsPayroll: true, match: ['/app/workforce/payroll'] },
  { key: 'wf-payslips', label: 'Payslips', group: 'wf-pay', icon: ico.payslips, newHref: '/app/workforce/payslips', roles: WF_PAY, notBuilt: true },
  { key: 'wf-rules', label: 'Rules', group: 'wf-settings', icon: ico.rules, newHref: '/app/workforce/rules', roles: WF_DESKTOP, match: ['/app/workforce/rules'] },
  { key: 'wf-rules-admin', label: 'Rules', group: 'wf-settings', icon: ico.rules, newHref: '/app/workforce/rules', roles: [SYSTEM_ADMIN], match: ['/app/workforce/rules'] },
  { key: 'wf-security', label: 'Security alerts', group: 'wf-settings', icon: ico.shield, newHref: '/app/workforce/security', roles: [SYSTEM_ADMIN], badge: 'workforce-security', match: ['/app/workforce/security'] },
  { key: 'wf-audit-log', label: 'Audit log', group: 'wf-settings', icon: AuditLogIcon, newHref: '/app/workforce/audit-log', roles: [...WF_DESKTOP, SYSTEM_ADMIN], needsAttendance: true, match: ['/app/workforce/audit-log'] },
  { key: 'wf-my-time', label: 'My time', group: 'wf-me', icon: ico.myTime, newHref: '/app/workforce/my-time', roles: [ACCOUNTANT], needsAttendance: true, match: ['/app/workforce/my-time'] },
  { key: 'wf-my-leave', label: 'My leave', group: 'wf-me', icon: ico.me, newHref: '/app/workforce/my-leave', roles: WF_DESKTOP, needsAttendance: true, match: ['/app/workforce/my-leave'] },
  { key: 'wf-my-payslips', label: 'My payslips', group: 'wf-me', icon: ico.payslips, newHref: '/app/workforce/my-payslips', roles: WF_DESKTOP },
  { key: 'wf-my-record', label: 'Activity on my record', group: 'wf-me', icon: ico.shield, newHref: '/app/workforce/my-record', roles: WF_DESKTOP, needsAttendance: true, match: ['/app/workforce/my-record'] },
  { key: 'wf-my-conduct', label: 'My notices', group: 'wf-me', icon: ico.shield, newHref: '/app/conduct', roles: WF_PEOPLE, needsAttendance: true, match: ['/app/conduct'] },
  { key: 'wf-my-conduct-accountant', label: 'Conduct', group: 'wf-me', icon: ico.shield, newHref: '/app/conduct', roles: [ACCOUNTANT], needsAttendance: true, match: ['/app/conduct'] },

  // The phone drawer of floor staff and department heads.
  { key: 'wf-staff-home', label: 'Home', group: 'wf-home', icon: ico.home, newHref: '/app/workforce', roles: [...SHIFT_STAFF, STORE_ATTENDANT], needsAttendance: true },
  { key: 'wf-head-today', label: 'Team today', group: 'wf-team', icon: ico.staff, newHref: '/app/workforce/today', roles: SHIFT_STAFF, departmentHead: true, needsAttendance: true },
  { key: 'wf-head-rota', label: 'Rota', group: 'wf-team', icon: ico.shifts, newHref: '/app/workforce/schedule/rota', roles: SHIFT_STAFF, departmentHead: true, needsAttendance: true },
  { key: 'wf-head-casuals', label: 'Casuals', group: 'wf-team', icon: ico.me, newHref: '/app/workforce/casuals', roles: SHIFT_STAFF, departmentHead: true },
  { key: 'wf-casual-approve', label: 'Casual pay', group: 'wf-workforce', icon: ico.money, newHref: '/app/workforce/casuals/approve', roles: [MANAGER, STORE_MANAGER, DIRECTOR] },
  {
    key: 'wf-staff-my-time',
    label: 'My time',
    group: 'wf-me',
    icon: ico.myTime,
    roles: [...SHIFT_STAFF, STORE_ATTENDANT],
    needsAttendance: true,
    match: ['/app/workforce/my-time'],
    subItems: [
      { key: 'hours', label: 'Hours this month', newHref: '/app/workforce/my-time', roles: [...SHIFT_STAFF, STORE_ATTENDANT] },
      { key: 'rota', label: 'My rota', newHref: '/app/workforce/my-time/rota', roles: [...SHIFT_STAFF, STORE_ATTENDANT] },
      { key: 'requests', label: 'My requests', newHref: '/app/workforce/my-time/requests', roles: [...SHIFT_STAFF, STORE_ATTENDANT] },
    ],
  },
  { key: 'wf-staff-my-leave', label: 'My leave', group: 'wf-me', icon: ico.leave, newHref: '/app/workforce/my-leave', roles: [...SHIFT_STAFF, STORE_ATTENDANT], needsAttendance: true, match: ['/app/workforce/my-leave'] },
  { key: 'wf-staff-my-payslips', label: 'My payslips', group: 'wf-me', icon: ico.payslips, newHref: '/app/workforce/my-payslips', roles: [...SHIFT_STAFF, STORE_ATTENDANT] },
  { key: 'wf-staff-my-record', label: 'Activity on my record', group: 'wf-me', icon: ico.shield, newHref: '/app/workforce/my-record', roles: [...SHIFT_STAFF, STORE_ATTENDANT], needsAttendance: true, match: ['/app/workforce/my-record'] },
  { key: 'wf-staff-conduct', label: 'Conduct', group: 'wf-me', icon: ico.shield, newHref: '/app/conduct', roles: [...SHIFT_STAFF, STORE_ATTENDANT], needsAttendance: true, match: ['/app/conduct'] },
  { key: 'wf-staff-profile', label: 'Profile and security', group: 'wf-me', icon: ico.shield, newHref: '/app/profile', roles: SHIFT_STAFF, notBuilt: true },
];
