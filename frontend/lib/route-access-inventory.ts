import type { AppRole } from '@/types/auth';

/**
 * The Inventory part of the route gate (`route-access.ts` calls it). Returns the answer for any `/app/inventory` path, and `null`
 * for a path that is not Inventory so the caller carries on with its own rules.
 */
export const inventoryPathAccess = (pathname: string, role: AppRole, isDepartmentHead: boolean): boolean | null => {
  if (!pathname.startsWith('/app/inventory')) {
    return null;
  }
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
  // Branch day (Block 4, desktop): the same screens as the Branch Manager's, read only, for the roles without a branch of their own
  // (Today with a branch picker, History, the day file, the printed day sheet). The API's table decides what each may do.
  if (pathname.startsWith('/app/inventory/branch-day') || pathname.startsWith('/app/inventory/day-print')) {
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
};
