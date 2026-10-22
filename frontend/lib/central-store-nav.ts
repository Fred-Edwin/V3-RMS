import { Warehouse, type LucideIcon } from 'lucide-react';

/**
 * The way into the Central Store from the sidebars of the desktop roles that live in other parts of the app (Branch Manager,
 * Accountant, Director, System Admin). Those sidebars belong to the older design system and cannot draw the branching tree,
 * so they get ONE link; the shell's sidebar (`components/app/shell/menu/sidebar-menu.tsx`) shows the full tree,
 * filtered to what that person may open.
 */
export interface CentralStoreNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const CENTRAL_STORE_NAV_LABEL = 'Inventory';

export const CENTRAL_STORE_NAV_ITEMS: CentralStoreNavItem[] = [{ label: 'Central Store', href: '/app/inventory/catalog', icon: Warehouse }];
