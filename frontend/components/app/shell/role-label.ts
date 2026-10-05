import type { AppRole } from '@/types/auth';

/**
 * Sidebar-facing display label for a user's role. Extracted out of
 * `inventory-shell.tsx`'s `useSidebarUser` (which hardcoded every
 * non-attendant as "Store Manager") so `branch-shell.tsx` doesn't
 * copy-paste that and render a Branch Manager as "Store Manager" too.
 * Fix once, use everywhere a sidebar shows a role.
 */
export function roleLabel(role: AppRole | null | undefined): string {
  switch (role) {
    case 'STORE_ATTENDANT':
      return 'Store Attendant';
    case 'STORE_MANAGER':
      return 'Store Manager';
    case 'MANAGER':
      return 'Branch Manager';
    case 'ACCOUNTANT':
      return 'Accountant';
    case 'DIRECTOR':
      return 'Director';
    case 'SYSTEM_ADMIN':
      return 'System Admin';
    default:
      return 'Store Manager';
  }
}
