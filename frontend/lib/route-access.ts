import type { AppRole } from '@/types/auth';

/**
 * The route gate: which roles may open which `/app/*` path. `middleware.ts` calls this on every request and is the access
 * authority; the navigation table (`components/app/shell/nav-table.ts`) is tested against it, so a sidebar link can never be
 * shown to a role this gate would bounce. Pure and free of Next.js imports so a test can call it.
 */
export const isAllowedPath = (pathname: string, role: AppRole, isDepartmentHead: boolean): boolean => {
  if (pathname.startsWith('/app/profile')) {
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

  if (pathname.startsWith('/app/inventory')) {
    // Central Store access (decisions.md, "Access"). The desktop roles reach every Central Store screen that has been rebuilt to
    // the approved designs; what each of them may DO there comes from the permissions table on the server
    // (`GET /inventory/permissions/me`), which the API enforces and the screens obey. This gate only decides who may open the
    // page at all. Screens still on the old flow keep the Store Manager and the Store Attendant.
    const isDesktopCentralStoreRole =
      role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR' || role === 'MANAGER' || role === 'SYSTEM_ADMIN';
    if (pathname.startsWith('/app/inventory/restock-levels')) {
      // The department head's own phone screen, and the desktop roles.
      return isDesktopCentralStoreRole || isDepartmentHead;
    }
    // Pre-Demo Fixes: Settings (Team + My PIN) is the Store Manager's alone — the attendant is bounced to their home (the API
    // routes it calls are role-gated too).
    if (pathname.startsWith('/app/inventory/settings')) {
      return role === 'STORE_MANAGER';
    }
    if (
      pathname.startsWith('/app/inventory/suppliers') ||
      pathname.startsWith('/app/inventory/audit-log') ||
      pathname.startsWith('/app/inventory/stock/restock-levels')
    ) {
      // The Store Attendant sees no suppliers, no audit log and no restock levels: they carry prices and who changed what.
      return isDesktopCentralStoreRole;
    }
    if (pathname.startsWith('/app/inventory/catalog')) {
      return isDesktopCentralStoreRole || role === 'STORE_ATTENDANT';
    }
    // Requisitions (rebuilt, Block 1): every desktop role reads the list and the file; the API's access table decides what each may do.
    if (pathname.startsWith('/app/inventory/requisitions')) {
      return isDesktopCentralStoreRole;
    }
    // Dispatch (Block 2): packing screens, the Attendant's tabs and the printed notes. The Store Manager and System Admin may also
    // pack (`dispatch.pack`); the API's table decides every action.
    if (pathname.startsWith('/app/inventory/dispatch')) {
      return role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT' || role === 'SYSTEM_ADMIN';
    }
    // Carriers (Block 2): the Store Manager and System Admin manage it, the other desktop roles read it; the API's table decides.
    if (pathname.startsWith('/app/inventory/carriers')) {
      return isDesktopCentralStoreRole;
    }
    // Purchasing and Receiving (mock-first rebuild): every desktop role reads them, the Attendant works them on the phone.
    if (pathname.startsWith('/app/inventory/purchasing') || pathname.startsWith('/app/inventory/receiving')) {
      return isDesktopCentralStoreRole || role === 'STORE_ATTENDANT';
    }
    // Prep (rebuilt): every desktop role reads it, the Attendant records runs on the phone; the API decides who may write.
    if (pathname.startsWith('/app/inventory/prep')) {
      return isDesktopCentralStoreRole || role === 'STORE_ATTENDANT';
    }
    // Branch waste (Block 3, desktop): the Branch Manager reads their branch and reverses (W6); Director, Accountant, Store Manager and
    // System Admin read every branch (W8). The API's table decides which screen and what each may do.
    if (pathname.startsWith('/app/inventory/branch-waste')) {
      return isDesktopCentralStoreRole;
    }
    // Stock, Counting and Waste (rebuilt): every desktop role reads every screen; the Attendant counts and logs waste on the phone
    // (Counts, Waste) and may print the blank sheet. The Branch Manager is the `MANAGER` role. The API decides who may write.
    const isHubReader = isDesktopCentralStoreRole;
    if (pathname.startsWith('/app/inventory/count-print')) {
      return pathname.startsWith('/app/inventory/count-print/blank') ? isHubReader || role === 'STORE_ATTENDANT' : isHubReader;
    }
    if (pathname.startsWith('/app/inventory/stock')) {
      // The Attendant's two links in the navigation table are Counts and Waste (contract §13, switched at release).
      const attendantArea = /^\/app\/inventory\/stock\/(counts|waste)(\/|$)/.test(pathname);
      return isHubReader || (role === 'STORE_ATTENDANT' && attendantArea);
    }
    return role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT';
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
