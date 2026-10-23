import { AuditLogIcon } from '../nav-icons';
import type { NavRow } from './types';
import { ACCOUNTANT, DIRECTOR, MANAGER, STORE_MANAGER, SYSTEM_ADMIN, ico } from './shared';

/**
 * The Branch Manager, Director, Accountant and System Admin rows that are not Workforce, Inventory or the personal items. `menu.ts` places
 * them under Operations or Company by their group (`features.ts`). Labels follow the naming table (sentence case, one name per page);
 * the HR group, Inbox for HR, and the old My Payments page are gone (batch 2A, 22 Oct 2026).
 */
export const OPERATIONS_ROWS: readonly NavRow[] = [
  // ── Branch Manager ──
  { key: 'manage-dashboard', label: 'Dashboard', group: 'mgr-operations', icon: ico.dashboard, oldHref: '/app/manage/dashboard', roles: [MANAGER] },
  { key: 'manage-orders', label: 'Orders', group: 'mgr-operations', icon: ico.orders, oldHref: '/app/orders', roles: [MANAGER] },
  { key: 'manage-history', label: 'Order history', group: 'mgr-operations', icon: ico.history, oldHref: '/app/history', roles: [MANAGER] },
  { key: 'manage-analytics', label: 'Analytics', group: 'mgr-company', icon: ico.analytics, oldHref: '/app/manage/reports', roles: [MANAGER] },
  { key: 'manage-inbox', label: 'Inbox', group: 'mgr-operations', icon: ico.inbox, oldHref: '/app/inbox', roles: [MANAGER], badge: 'inbox' },
  { key: 'manage-departments', label: 'Departments', group: 'mgr-manage', icon: ico.departments, newHref: '/app/manage/department-settings', roles: [MANAGER] },
  { key: 'manage-carriers', label: 'Carriers', group: 'mgr-manage', icon: ico.truck, newHref: '/app/inventory/carriers', roles: [MANAGER], capability: 'carriers.read' },
  { key: 'manage-menu', label: 'Menu items', group: 'mgr-manage', icon: ico.menu, oldHref: '/app/manage/menu', roles: [MANAGER] },
  // The old shift pages: only while the new clock is off. Where it is on, Workforce > Shifts is the one place.
  { key: 'manage-shifts', label: 'Staff shifts', group: 'mgr-manage', icon: ico.shifts, oldHref: '/app/manage/shifts', roles: [MANAGER], oldOnlyWhenSwitchOff: true },
  { key: 'manage-delivery-zones', label: 'Delivery zones', group: 'mgr-manage', icon: ico.delivery, oldHref: '/app/manage/delivery-zones', roles: [MANAGER] },
  { key: 'manage-payslips', label: 'Branch payslips', group: 'mgr-manage', icon: ico.payslips, oldHref: '/app/manage/payslips', roles: [MANAGER], oldOnlyWhenSwitchOff: true },
  { key: 'manage-incidents', label: 'Incidents', group: 'mgr-manage', icon: ico.alert, oldHref: '/app/manage/incidents', roles: [MANAGER] },
  { key: 'manage-customer-credit', label: 'Customer credit', group: 'mgr-credit', icon: ico.credit, oldHref: '/app/manage/customer-credit', roles: [MANAGER], flag: 'credit' },
  { key: 'manage-outstanding', label: 'Outstanding balances', group: 'mgr-credit', icon: ico.alert, oldHref: '/app/manage/outstanding-balances', roles: [MANAGER], flag: 'credit' },
  { key: 'manage-my-tab', label: 'My tab', group: 'mgr-credit', icon: ico.credit, oldHref: '/app/manage/my-tab', roles: [MANAGER], flag: 'credit' },
  { key: 'income-record', label: 'Record income', group: 'mgr-income', icon: ico.money, oldHref: '/app/other-income/new', roles: [MANAGER] },
  { key: 'income-entries', label: 'Income entries', group: 'mgr-income', icon: ico.history, oldHref: '/app/other-income/history', roles: [MANAGER] },
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
    label: 'Branch day',
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
  { key: 'branch-audit-log', label: 'Stock audit log', group: 'mgr-branch', icon: AuditLogIcon, newHref: '/app/inventory/audit-log', roles: [MANAGER], capability: 'audit.read' },

  // ── Director ──
  { key: 'director-dashboard', label: 'Dashboard', group: 'dir-operations', icon: ico.dashboard, oldHref: '/app/director', roles: [DIRECTOR] },
  { key: 'director-analytics', label: 'Analytics', group: 'dir-company', icon: ico.analyticsLine, oldHref: '/app/director/analytics', roles: [DIRECTOR] },
  { key: 'director-inbox', label: 'Inbox', group: 'dir-operations', icon: ico.inbox, oldHref: '/app/inbox', roles: [DIRECTOR], badge: 'inbox' },
  {
    key: 'director-day',
    label: 'Branch day',
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
  { key: 'director-income', label: 'Other income', group: 'dir-income', icon: ico.tags, oldHref: '/app/director/other-income', roles: [DIRECTOR] },
  { key: 'director-incidents', label: 'Incidents', group: 'dir-operations', icon: ico.shield, oldHref: '/app/director/incidents', roles: [DIRECTOR] },
  { key: 'director-discounts', label: 'Discounts', group: 'dir-operations', icon: ico.percent, oldHref: '/app/admin/discounts', roles: [DIRECTOR] },
  {
    key: 'director-settings',
    label: 'Branches',
    group: 'dir-company',
    icon: ico.settings,
    roles: [DIRECTOR],
    subItems: [
      { key: 'settings', label: 'Settings', oldHref: '/app/director/settings', roles: [DIRECTOR] },
      { key: 'departments', label: 'Departments', newHref: '/app/director/settings/departments', roles: [DIRECTOR], capability: 'departments.read' },
    ],
  },
  // The old payroll page stays only while Payroll has no month (a company with every switch off sees what it saw).
  { key: 'director-payroll', label: 'Payroll', group: 'dir-operations', icon: ico.payslips, oldHref: '/app/hr/payroll', roles: [DIRECTOR], oldOnlyWhenPayrollOff: true },
  { key: 'director-corporate', label: 'Corporate accounts', group: 'dir-credit', icon: ico.departments, oldHref: '/app/director/corporate-accounts', roles: [DIRECTOR], flag: 'credit' },
  { key: 'director-outstanding', label: 'Outstanding balances', group: 'dir-credit', icon: ico.alert, oldHref: '/app/director/outstanding-balances', roles: [DIRECTOR], flag: 'credit' },
  { key: 'director-my-tab', label: 'My tab', group: 'dir-credit', icon: ico.credit, oldHref: '/app/manage/my-tab', roles: [DIRECTOR], flag: 'credit' },

  // ── Accountant ──
  { key: 'accountant-dashboard', label: 'Dashboard', group: 'acc-financials', icon: ico.dashboard, oldHref: '/app/accountant', roles: [ACCOUNTANT] },
  { key: 'accountant-reconciliation', label: 'Reconciliation', group: 'acc-financials', icon: ico.history, oldHref: '/app/accountant/reconciliation', roles: [ACCOUNTANT] },
  { key: 'accountant-income', label: 'Other income', group: 'acc-financials', icon: ico.money, oldHref: '/app/other-income/history', roles: [ACCOUNTANT] },
  { key: 'accountant-credit', label: 'Credit accounts', group: 'acc-credit', icon: ico.credit, oldHref: '/app/accountant/credit', roles: [ACCOUNTANT] },
  { key: 'accountant-inbox', label: 'Inbox', group: 'acc-financials', icon: ico.inbox, oldHref: '/app/inbox', roles: [ACCOUNTANT], badge: 'inbox' },

  // ── System Admin: Home and Company only (Paper 2.x) ──
  { key: 'admin-users', label: 'Users', group: 'adm-company', icon: ico.staff, oldHref: '/app/admin?view=users', roles: [SYSTEM_ADMIN], match: ['/app/admin'] },
  { key: 'admin-branches', label: 'Branches', group: 'adm-company', icon: ico.settings, oldHref: '/app/admin?view=branches', roles: [SYSTEM_ADMIN] },
  { key: 'admin-menu', label: 'Menu items', group: 'adm-company', icon: ico.menu, oldHref: '/app/admin/menu', roles: [SYSTEM_ADMIN] },
  { key: 'admin-house-accounts', label: 'House accounts', group: 'adm-company', icon: ico.credit, oldHref: '/app/admin/house-accounts', roles: [SYSTEM_ADMIN], flag: 'credit' },
  { key: 'admin-corporate', label: 'Corporate accounts', group: 'adm-company', icon: ico.departments, oldHref: '/app/admin/corporate-accounts', roles: [SYSTEM_ADMIN], flag: 'credit' },

  // ── Branches (Block 3, Paper W8): the desktop roles without a branch of their own read every branch's day and waste ──
  {
    key: 'branches-day',
    label: 'Branch day',
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
];
