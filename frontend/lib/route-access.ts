import type { AppRole } from '@/types/auth';
import { inventoryPathAccess } from '@/lib/route-access-inventory';
import { workforcePathAccess } from '@/lib/route-access-workforce';

/**
 * The route gate: which roles may open which `/app/*` path. `middleware.ts` calls this on every request and is the access
 * authority; the navigation table (`components/app/shell/nav-table.ts`) is tested against it, so a sidebar link can never be
 * shown to a role this gate would bounce. Pure and free of Next.js imports so a test can call it. The Inventory and Workforce
 * rules live beside it (`route-access-inventory.ts`, `route-access-workforce.ts`).
 */
export const isAllowedPath = (pathname: string, role: AppRole, isDepartmentHead: boolean): boolean => {
  // The one refusal screen: where the middleware sends a person who may not open a page. Everyone may open it.
  if (pathname === '/app/not-available') {
    return true;
  }

  // Department-head shift scheduler — gated on the marker, not a role. A head
  // keeps their base role, so their other nav is governed by the rules below.
  if (pathname.startsWith('/app/department')) {
    return isDepartmentHead;
  }

  // Milestone Four, Session A — Department Head requisition fill.
  if (pathname.startsWith('/app/requisitions')) {
    return isDepartmentHead;
  }

  // Block 2 — the department's Deliveries (count, confirm, file, history): a head, or a floor member of a department. Which
  // department a person may count is decided by the API (`deliveries.count` rule), not here.
  if (pathname.startsWith('/app/deliveries')) {
    return isDepartmentHead || role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'STEWARD' || role === 'HOUSEKEEPING';
  }

  // Block 3 — the department's Branch waste phone screens (log, the department's list, reverse): a head, or a floor member of a
  // department. Which department a person may log for is decided by the API (the department rule), not here.
  if (pathname.startsWith('/app/waste')) {
    return isDepartmentHead || role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'STEWARD' || role === 'HOUSEKEEPING';
  }

  // Block 4 — the department's Day (check the opening, count the evening, past days): a head, or a floor member of a department.
  // Which department a person may count is decided by the API (the department rule), not here.
  if (pathname === '/app/day' || pathname.startsWith('/app/day/')) {
    return isDepartmentHead || role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'STEWARD' || role === 'HOUSEKEEPING';
  }

  // Milestone Six, Session 1 — a Department Head's own-department stock
  // ledger (`1BPY-0`/`1FDY-0`). Department-scoped server-side (location
  // resolved from the actor); no Manager screen yet.
  if (pathname.startsWith('/app/branch/ledger')) {
    return isDepartmentHead;
  }

  // The printed requisition is read by every desktop role that reads requisitions (the file itself is gated by the API's table).
  if (pathname.startsWith('/app/branch/requisitions-print') || pathname.startsWith('/app/branch/dispatch-print')) {
    return role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT' || role === 'ACCOUNTANT' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  // Milestone Four, Session B — Branch Manager approval workspace
  // (decision #8: lives at /app/branch, not under /app/requisitions).
  if (pathname.startsWith('/app/branch')) {
    return role === 'MANAGER';
  }

  if (pathname === '/app/admin/menu' || pathname.startsWith('/app/admin/menu/')) {
    return role === 'SYSTEM_ADMIN' || role === 'DIRECTOR';
  }

  if (pathname === '/app/admin/discounts' || pathname.startsWith('/app/admin/discounts/')) {
    return role === 'SYSTEM_ADMIN' || role === 'DIRECTOR';
  }

  if (pathname === '/app/manage/my-tab') {
    return role === 'MANAGER' || role === 'DIRECTOR';
  }
  if (pathname === '/app/manage/settings' || pathname.startsWith('/app/manage/settings/')) {
    return false; // Directors use /app/director/settings; managers no longer have access
  }
  if (pathname === '/app/manage/departments' || pathname.startsWith('/app/manage/departments/')) {
    return role === 'MANAGER'; // Branch Manager assigns/changes department heads for their branch
  }
  if (pathname.startsWith('/app/manage')) {
    return role === 'MANAGER';
  }
  if (pathname.startsWith('/app/director')) {
    return role === 'DIRECTOR';
  }
  if (pathname.startsWith('/app/admin')) {
    return role === 'SYSTEM_ADMIN';
  }
  if (pathname.startsWith('/app/kitchen')) {
    return role === 'KITCHEN_DISPLAY' || role === 'CHEF';
  }
  if (pathname.startsWith('/app/barista')) {
    return role === 'BARISTA_DISPLAY' || role === 'BARISTA';
  }

  if (pathname.startsWith('/app/orders')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'MANAGER';
  }

  if (pathname.startsWith('/app/history')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN' || role === 'ACCOUNTANT' || role === 'HR_MANAGER';
  }

  if (pathname.startsWith('/app/other-income')) {
    return role === 'WAITER' || role === 'MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN' || role === 'ACCOUNTANT';
  }

  if (pathname.startsWith('/app/inbox')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'MANAGER' || role === 'DIRECTOR' || role === 'ACCOUNTANT' || role === 'HR_MANAGER' || role === 'SYSTEM_ADMIN' || role === 'STEWARD' || role === 'HOUSEKEEPING' || role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT';
  }

  if (pathname.startsWith('/app/hr')) {
    // HR entry sheet and management: HR_MANAGER, DIRECTOR, SYSTEM_ADMIN only
    // my-leave: all human staff
    if (pathname === '/app/hr/my-leave') {
      return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA'
        || role === 'ACCOUNTANT' || role === 'MANAGER' || role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN' || role === 'STEWARD' || role === 'HOUSEKEEPING' || role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT';
    }
    return role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  if (pathname.startsWith('/app/accountant')) {
    return role === 'ACCOUNTANT';
  }

  const workforce = workforcePathAccess(pathname, role, isDepartmentHead);
  if (workforce !== null) {
    return workforce;
  }

  const inventory = inventoryPathAccess(pathname, role, isDepartmentHead);
  if (inventory !== null) {
    return inventory;
  }

  if (pathname === '/app/payslips' || pathname.startsWith('/app/payslips/')) {
    return role === 'WAITER'
      || role === 'CHEF'
      || role === 'BARISTA'
      || role === 'MANAGER'
      || role === 'HR_MANAGER'
      || role === 'DIRECTOR'
      || role === 'ACCOUNTANT'
      || role === 'SYSTEM_ADMIN'
      || role === 'STEWARD'
      || role === 'HOUSEKEEPING'
      || role === 'STORE_MANAGER'
      || role === 'STORE_ATTENDANT';
  }

  if (pathname.startsWith('/app')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'STEWARD' || role === 'HOUSEKEEPING';
  }

  return true;
};
