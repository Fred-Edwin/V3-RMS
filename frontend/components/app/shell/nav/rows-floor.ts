import type { NavRow } from './types';
import {
  ALL_HUMAN,
  BARISTA,
  CHEF,
  DAILY_COUNT_SLOT,
  DELIVERIES_SLOT,
  HOUSEKEEPING,
  INBOX_SLOT,
  SHIFT_STAFF,
  STEWARD,
  WAITER,
  ico,
} from './shared';

/** Floor and kitchen staff; then (`DEPARTMENT_ROWS`) a department head or member on top of their own role's links, and the Profile link everyone has. */
export const FLOOR_ROWS: readonly NavRow[] = [
  // ── Floor and kitchen staff (the desktop preview, and any desktop session) ──
  { key: 'staff-dashboard', label: 'Dashboard', group: 'staff-nav', icon: ico.dashboard, oldHref: '/app/dashboard', roles: SHIFT_STAFF, quick: { [STEWARD]: 1, [HOUSEKEEPING]: 1 } },
  { key: 'staff-new-order', label: 'New Order', group: 'staff-nav', icon: ico.orders, oldHref: '/app/orders/new', roles: [WAITER], quick: { [WAITER]: 1 }, hideBar: true },
  { key: 'staff-orders', label: 'Orders', group: 'staff-nav', icon: ico.clipboard, oldHref: '/app/orders', roles: [WAITER], quick: { [WAITER]: 2 } },
  { key: 'staff-kitchen', label: 'Kitchen', group: 'staff-nav', icon: ico.chef, oldHref: '/app/kitchen', roles: [CHEF], quick: { [CHEF]: 1 } },
  { key: 'staff-barista', label: 'Barista', group: 'staff-nav', icon: ico.coffee, oldHref: '/app/barista', roles: [BARISTA], quick: { [BARISTA]: 1 } },
  { key: 'staff-shifts', label: 'Shifts', group: 'staff-nav', icon: ico.shifts, oldHref: '/app/shifts', roles: SHIFT_STAFF },
  { key: 'staff-leave', label: 'My Leave', group: 'staff-nav', icon: ico.leaveOff, oldHref: '/app/hr/my-leave', roles: SHIFT_STAFF, oldOnlyWhenSwitchOff: true },
  { key: 'staff-performance', label: 'Performance', group: 'staff-nav', icon: ico.analytics, oldHref: '/app/performance', roles: [WAITER, CHEF, BARISTA] },
  { key: 'staff-history', label: 'History', group: 'staff-nav', icon: ico.history, oldHref: '/app/history', roles: [CHEF, BARISTA], hideForDepartmentHead: true },
  { key: 'staff-order-history', label: 'Order History', group: 'staff-nav', icon: ico.history, oldHref: '/app/history', roles: [WAITER] },
  { key: 'staff-inbox', label: 'Inbox', group: 'staff-nav', icon: ico.inbox, oldHref: '/app/inbox', roles: SHIFT_STAFF, badge: 'inbox', quick: INBOX_SLOT },
  { key: 'staff-income-record', label: 'Record Income', group: 'staff-income', icon: ico.money, oldHref: '/app/other-income/new', roles: [WAITER] },
  { key: 'staff-income-history', label: 'Income History', group: 'staff-income', icon: ico.history, oldHref: '/app/other-income/history', roles: [WAITER] },
];

/** Comes after the Central Store rows in the table, so each role's groups keep their order. */
export const DEPARTMENT_ROWS: readonly NavRow[] = [
  // ── A department head, on top of their own role's links ──
  { key: 'department-shifts', label: 'Department Shifts', group: 'department', icon: ico.shifts, oldHref: '/app/department/shifts', roles: ALL_HUMAN, departmentHead: true },
  { key: 'department-requisitions', label: 'Requisitions', group: 'department', icon: ico.clipboard, newHref: '/app/requisitions', roles: ALL_HUMAN, departmentHead: true },
  { key: 'department-deliveries', label: 'Deliveries', group: 'department', icon: ico.truck, newHref: '/app/deliveries', roles: ALL_HUMAN, departmentHead: true, badge: 'deliveries', quick: DELIVERIES_SLOT },
  { key: 'department-day', label: 'Daily count', group: 'department', icon: ico.day, newHref: '/app/day', roles: ALL_HUMAN, departmentHead: true, quick: DAILY_COUNT_SLOT, hideBar: true },
  { key: 'department-past-days', label: 'Past days', group: 'department', icon: ico.history, newHref: '/app/day/history', roles: ALL_HUMAN, departmentHead: true },
  { key: 'member-day', label: 'Daily count', group: 'department', icon: ico.day, newHref: '/app/day', roles: SHIFT_STAFF, departmentMemberOnly: true, quick: DAILY_COUNT_SLOT, hideBar: true },
  { key: 'member-deliveries', label: 'Deliveries', group: 'department', icon: ico.truck, newHref: '/app/deliveries', roles: SHIFT_STAFF, departmentMemberOnly: true, badge: 'deliveries', quick: DELIVERIES_SLOT },
  { key: 'member-history', label: 'History', group: 'department', icon: ico.history, newHref: '/app/deliveries/history', roles: SHIFT_STAFF, departmentMemberOnly: true },
  { key: 'department-waste', label: 'Waste', group: 'department', icon: ico.alert, newHref: '/app/waste', roles: ALL_HUMAN, departmentHead: true },
  { key: 'member-waste', label: 'Waste', group: 'department', icon: ico.alert, newHref: '/app/waste', roles: SHIFT_STAFF, departmentMemberOnly: true },

  // ── Everyone ──
  { key: 'profile', label: 'Profile', group: 'account', icon: ico.profile, oldHref: '/app/profile', roles: ALL_HUMAN },
];
