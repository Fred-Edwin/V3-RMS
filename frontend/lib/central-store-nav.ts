import { Boxes, ScrollText, SlidersHorizontal, Truck, type LucideIcon } from 'lucide-react';

/**
 * The "Central Store" section the desktop roles from other parts of the app (Branch Manager, Accountant, Director, System
 * Admin) get in their own sidebar, so every Central Store destination is one click away. What each person may do on the other
 * side comes from the server's permissions table; these links only open the screens that role is allowed to see.
 */
export interface CentralStoreNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const CENTRAL_STORE_NAV_LABEL = 'Central Store';

export const CENTRAL_STORE_NAV_ITEMS: CentralStoreNavItem[] = [
  { label: 'Catalog', href: '/app/inventory/catalog', icon: Boxes },
  { label: 'Suppliers', href: '/app/inventory/suppliers', icon: Truck },
  { label: 'Restock levels', href: '/app/inventory/stock/restock-levels', icon: SlidersHorizontal },
  { label: 'Audit log', href: '/app/inventory/audit-log', icon: ScrollText },
];
