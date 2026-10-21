import type { AppRole } from '@/types/auth';
import { BARISTA, CHEF, DIRECTOR, ACCOUNTANT, HOUSEKEEPING, HR_MANAGER, MANAGER, STEWARD, STORE_ATTENDANT, STORE_MANAGER, SYSTEM_ADMIN, WAITER } from './shared';

/** Print documents are bare pages: no sidebar, no top bar. */
export const isBareRoute = (pathname: string): boolean => /-print(\/|$)/.test(pathname) || /^\/app\/workforce\/schedule\/rota\/print(\/|$)/.test(pathname);

/**
 * Roles that use the one shell at every width: the sidebar on a desktop, a top bar with a menu drawer on a phone (and the floor-staff
 * bottom bar). The floor staff (waiter, chef, barista, steward, housekeeping) are here too, department or not.
 */
const SHELL_ROLES: readonly AppRole[] = [MANAGER, DIRECTOR, SYSTEM_ADMIN, ACCOUNTANT, HR_MANAGER, STORE_MANAGER, STORE_ATTENDANT, WAITER, CHEF, BARISTA, STEWARD, HOUSEKEEPING];
const DESKTOP_PREVIEW_ROLES: readonly AppRole[] = [WAITER, CHEF, BARISTA];

/**
 * Every human role uses the shell, and a department head or an active department member does whatever their base role (Paper
 * "Phone menus by role": no bottom tabs). Only the display-only roles are left out.
 */
export const usesAppShell = (role: AppRole | null | undefined, isDepartmentHead = false, isDepartmentMember = false): boolean =>
  Boolean(role) && (SHELL_ROLES.includes(role as AppRole) || isDepartmentHead || isDepartmentMember);

/** The roles whose department membership the layout has to look up before it can pick a frame (heads carry a marker on the token). */
export const FLOOR_ROLES: readonly AppRole[] = [WAITER, CHEF, BARISTA, STEWARD, HOUSEKEEPING];

/** The sidebar shows for these roles, and for the floor staff only in the desktop preview (a dev flag), next to their bottom tabs. */
export function usesDesktopShell(role: AppRole | null | undefined, desktopPreview: boolean, isDepartmentHead = false, isDepartmentMember = false): boolean {
  if (!role) return false;
  return usesAppShell(role, isDepartmentHead, isDepartmentMember) || (desktopPreview && DESKTOP_PREVIEW_ROLES.includes(role));
}
