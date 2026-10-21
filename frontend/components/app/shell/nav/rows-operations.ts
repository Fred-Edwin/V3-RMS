import { AuditLogIcon } from '../nav-icons';
import type { NavRow } from './types';
import { ACCOUNTANT, DIRECTOR, HR_MANAGER, MANAGER, STORE_MANAGER, SYSTEM_ADMIN, ico } from './shared';

/** The Branch Manager, Director, Accountant, System Admin, the "Branches" group and HR: the legacy and Operations rows. */
export const OPERATIONS_ROWS: readonly NavRow[] = [
  // ── Branch Manager ──
  { key: 'manage-dashboard', label: 'Dashboard', group: 'mgr-operations', icon: ico.dashboard, oldHref: '/app/manage/dashboard', roles: [MANAGER] },
  { key: 'manage-orders', label: 'Orders', group: 'mgr-operations', icon: ico.orders, oldHref: '/app/orders', roles: [MANAGER] },
  { key: 'manage-history', label: 'History', group: 'mgr-operations', icon: ico.history, oldHref: '/app/history', roles: [MANAGER] },
  { key: 'manage-analytics', label: 'Analytics', group: 'mgr-operations', icon: ico.analytics, oldHref: '/app/manage/reports', roles: [MANAGER] },
  { key: 'manage-inbox', label: 'Inbox', group: 'mgr-operations', icon: ico.inbox, oldHref: '/app/inbox', roles: [MANAGER], badge: 'inbox' },
  { key: 'manage-departments', label: 'Departments', group: 'mgr-manage', icon: ico.departments, newHref: '/app/manage/department-settings', roles: [MANAGER] },
  { key: 'manage-carriers', label: 'Carriers', group: 'mgr-manage', icon: ico.truck, newHref: '/app/inventory/carriers', roles: [MANAGER], capability: 'carriers.read' },
  { key: 'manage-menu', label: 'Menu', group: 'mgr-manage', icon: ico.menu, oldHref: '/app/manage/menu', roles: [MANAGER] },
  { key: 'manage-shifts', label: 'Shifts', group: 'mgr-manage', icon: ico.shifts, oldHref: '/app/manage/shifts', roles: [MANAGER] },
  { key: 'manage-delivery-zones', label: 'Delivery Zones', group: 'mgr-manage', icon: ico.delivery, oldHref: '/app/manage/delivery-zones', roles: [MANAGER] },
  { key: 'manage-payslips', label: 'Payslips', group: 'mgr-manage', icon: ico.payslips, oldHref: '/app/manage/payslips', roles: [MANAGER] },
  { key: 'manage-incidents', label: 'Incidents', group: 'mgr-manage', icon: ico.alert, oldHref: '/app/manage/incidents', roles: [MANAGER] },
  { key: 'manage-customer-credit', label: 'Customer Credit', group: 'mgr-credit', icon: ico.credit, oldHref: '/app/manage/customer-credit', roles: [MANAGER], flag: 'credit' },
  { key: 'manage-outstanding', label: 'Outstanding Balances', group: 'mgr-credit', icon: ico.alert, oldHref: '/app/manage/outstanding-balances', roles: [MANAGER], flag: 'credit' },
  { key: 'manage-my-tab', label: 'My Tab', group: 'mgr-credit', icon: ico.credit, oldHref: '/app/manage/my-tab', roles: [MANAGER], flag: 'credit' },
  { key: 'income-record', label: 'Record Income', group: 'mgr-income', icon: ico.money, oldHref: '/app/other-income/new', roles: [MANAGER] },
  { key: 'income-entries', label: 'Income Entries', group: 'mgr-income', icon: ico.history, oldHref: '/app/other-income/history', roles: [MANAGER] },
  {
    key: 'branch-requisitions',
    label: 'Requisitions',
    group: 'mgr-branch',
    icon: ico.clipboard,
    roles: [MANAGER],
    badge: 'requisitions',
    subItems: [
      { key: 'queue', label: 'Queue', newHref: '/app/branch/requisitions', roles: [MANAGER], badge: 'requisitions' },
      { key: 'discrepancies', label: 'Discrepancies', newHref: '/app/branch/requisitions/discrepancies', roles: [MANAGER], badge: 'discrepancies' },
      { key: 'history', label: 'History', newHref: '/app/branch/requisitions/history', roles: [MANAGER] },
    ],
  },
  {
    key: 'branch-day',
    label: 'Day',
    group: 'mgr-branch',
    icon: ico.day,
    roles: [MANAGER],
    capability: 'branch_day.read',
    subItems: [
      { key: 'today', label: 'Today', newHref: '/app/branch/day', roles: [MANAGER], badge: 'branch-day-todo' },
      { key: 'history', label: 'History', newHref: '/app/branch/day/history', roles: [MANAGER], match: ['/app/branch/day/file'] },
    ],
  },
  { key: 'branch-waste', label: 'Waste', group: 'mgr-branch', icon: ico.alert, newHref: '/app/inventory/branch-waste', roles: [MANAGER], capability: 'branch_waste.read' },
  { key: 'branch-audit-log', label: 'Audit log', group: 'mgr-branch', icon: AuditLogIcon, newHref: '/app/inventory/audit-log', roles: [MANAGER], capability: 'audit.read' },

  // ── Director ──
  { key: 'director-dashboard', label: 'Dashboard', group: 'dir-overview', icon: ico.dashboard, oldHref: '/app/director', roles: [DIRECTOR] },
  { key: 'director-analytics', label: 'Analytics', group: 'dir-overview', icon: ico.analyticsLine, oldHref: '/app/director/analytics', roles: [DIRECTOR] },
  { key: 'director-inbox', label: 'Inbox', group: 'dir-overview', icon: ico.inbox, oldHref: '/app/inbox', roles: [DIRECTOR], badge: 'inbox' },
  {
    key: 'director-day',
    label: 'Day',
    group: 'dir-branches',
    icon: ico.day,
    roles: [DIRECTOR],
    capability: 'branch_day.read_any_branch',
    subItems: [
      { key: 'today', label: 'Today', newHref: '/app/inventory/branch-day', roles: [DIRECTOR] },
      { key: 'history', label: 'History', newHref: '/app/inventory/branch-day/history', roles: [DIRECTOR], match: ['/app/inventory/branch-day/file'] },
    ],
  },
  { key: 'director-waste', label: 'Waste', group: 'dir-branches', icon: ico.alert, newHref: '/app/inventory/branch-waste', roles: [DIRECTOR], capability: 'branch_waste.read_any_branch' },
  { key: 'director-income', label: 'Categories & Entries', group: 'dir-income', icon: ico.tags, oldHref: '/app/director/other-income', roles: [DIRECTOR] },
  { key: 'director-incidents', label: 'Incident Log', group: 'dir-operations', icon: ico.shield, oldHref: '/app/director/incidents', roles: [DIRECTOR] },
  { key: 'director-discounts', label: 'Discounts', group: 'dir-operations', icon: ico.percent, oldHref: '/app/admin/discounts', roles: [DIRECTOR] },
  {
    key: 'director-settings',
    label: 'Branch Settings',
    group: 'dir-operations',
    icon: ico.settings,
    roles: [DIRECTOR],
    subItems: [
      { key: 'settings', label: 'Settings', oldHref: '/app/director/settings', roles: [DIRECTOR] },
      { key: 'departments', label: 'Departments', newHref: '/app/director/settings/departments', roles: [DIRECTOR], capability: 'departments.read' },
    ],
  },
  { key: 'director-payroll', label: 'Payroll', group: 'dir-operations', icon: ico.payslips, oldHref: '/app/hr/payroll', roles: [DIRECTOR] },
  { key: 'director-corporate', label: 'Corporate Accounts', group: 'dir-credit', icon: ico.departments, oldHref: '/app/director/corporate-accounts', roles: [DIRECTOR], flag: 'credit' },
  { key: 'director-outstanding', label: 'Outstanding Balances', group: 'dir-credit', icon: ico.alert, oldHref: '/app/director/outstanding-balances', roles: [DIRECTOR], flag: 'credit' },
  { key: 'director-my-tab', label: 'My Tab', group: 'dir-credit', icon: ico.credit, oldHref: '/app/manage/my-tab', roles: [DIRECTOR], flag: 'credit' },

  // ── Accountant ──
  { key: 'accountant-dashboard', label: 'Dashboard', group: 'acc-financials', icon: ico.dashboard, oldHref: '/app/accountant', roles: [ACCOUNTANT] },
  { key: 'accountant-reconciliation', label: 'Reconciliation', group: 'acc-financials', icon: ico.history, oldHref: '/app/accountant/reconciliation', roles: [ACCOUNTANT] },
  { key: 'accountant-income', label: 'Other Income', group: 'acc-financials', icon: ico.money, oldHref: '/app/other-income/history', roles: [ACCOUNTANT] },
  { key: 'accountant-payments', label: 'My Payments', group: 'acc-financials', icon: ico.payslips, oldHref: '/app/payslips', roles: [ACCOUNTANT] },
  { key: 'accountant-credit', label: 'Credit Accounts', group: 'acc-credit', icon: ico.credit, oldHref: '/app/accountant/credit', roles: [ACCOUNTANT] },
  { key: 'accountant-inbox', label: 'Inbox', group: 'acc-comms', icon: ico.inbox, oldHref: '/app/inbox', roles: [ACCOUNTANT], badge: 'inbox' },
  { key: 'accountant-leave', label: 'My Leave', group: 'acc-leave', icon: ico.leaveOff, oldHref: '/app/hr/my-leave', roles: [ACCOUNTANT], oldOnlyWhenSwitchOff: true },

  // ── System Admin ──
  { key: 'admin-branches', label: 'Branches & Users', group: 'adm-admin', icon: ico.settings, oldHref: '/app/admin', roles: [SYSTEM_ADMIN] },
  { key: 'admin-menu', label: 'Menu', group: 'adm-admin', icon: ico.menu, oldHref: '/app/admin/menu', roles: [SYSTEM_ADMIN] },
  { key: 'admin-house-accounts', label: 'House Accounts', group: 'adm-admin', icon: ico.credit, oldHref: '/app/admin/house-accounts', roles: [SYSTEM_ADMIN], flag: 'credit' },
  { key: 'admin-corporate', label: 'Corporate Accounts', group: 'adm-admin', icon: ico.departments, oldHref: '/app/admin/corporate-accounts', roles: [SYSTEM_ADMIN], flag: 'credit' },
  { key: 'admin-inbox', label: 'Inbox', group: 'adm-comms', icon: ico.inbox, oldHref: '/app/inbox', roles: [SYSTEM_ADMIN], badge: 'inbox' },

  // ── Branches (Block 3, Paper W8): the desktop roles without a branch of their own read every branch's waste ──
  {
    key: 'branches-day',
    label: 'Day',
    group: 'branches',
    icon: ico.day,
    roles: [ACCOUNTANT, STORE_MANAGER, SYSTEM_ADMIN],
    capability: 'branch_day.read_any_branch',
    subItems: [
      { key: 'today', label: 'Today', newHref: '/app/inventory/branch-day', roles: [ACCOUNTANT, STORE_MANAGER, SYSTEM_ADMIN] },
      { key: 'history', label: 'History', newHref: '/app/inventory/branch-day/history', roles: [ACCOUNTANT, STORE_MANAGER, SYSTEM_ADMIN], match: ['/app/inventory/branch-day/file'] },
    ],
  },
  { key: 'branches-waste', label: 'Waste', group: 'branches', icon: ico.alert, newHref: '/app/inventory/branch-waste', roles: [ACCOUNTANT, STORE_MANAGER, SYSTEM_ADMIN], capability: 'branch_waste.read_any_branch' },

  // ── HR Manager ──
  { key: 'hr-overview', label: 'HR Overview', group: 'hr', icon: ico.dashboard, oldHref: '/app/hr', roles: [HR_MANAGER] },
  { key: 'hr-contracts', label: 'Contract Types', group: 'hr', icon: ico.contracts, oldHref: '/app/hr/contract-types', roles: [HR_MANAGER] },
  { key: 'hr-leave', label: 'Leave Requests', group: 'hr', icon: ico.shifts, oldHref: '/app/hr/leave', roles: [HR_MANAGER], oldOnlyWhenSwitchOff: true },
  { key: 'hr-leave-calendar', label: 'Leave Calendar', group: 'hr', icon: ico.shifts, oldHref: '/app/hr/leave/calendar', roles: [HR_MANAGER], oldOnlyWhenSwitchOff: true },
  { key: 'hr-attendance', label: 'Attendance', group: 'hr', icon: ico.analytics, oldHref: '/app/hr/attendance', roles: [HR_MANAGER] },
  { key: 'hr-shifts', label: 'Shifts', group: 'hr', icon: ico.shifts, oldHref: '/app/hr/shifts', roles: [HR_MANAGER] },
  { key: 'hr-payroll', label: 'Payroll', group: 'hr', icon: ico.payslips, oldHref: '/app/hr/payroll', roles: [HR_MANAGER] },
  { key: 'hr-inbox', label: 'Inbox', group: 'hr', icon: ico.inbox, oldHref: '/app/inbox', roles: [HR_MANAGER], badge: 'inbox' },
];
