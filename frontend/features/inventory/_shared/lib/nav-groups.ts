import { roleHome } from '@/lib/role-home';
import type { AppRole } from '@/types/auth';
import type { Capability } from './capabilities';

/**
 * Which sidebar items a person sees inside the Central Store, as a tree: a parent item with sub-links under it (the curved
 * rail of Paper `1BI5-0`). Pure data and rules, so it can be tested without a browser; `inventory-shell.tsx` turns the result
 * into the real sidebar by giving each `iconKey` its icon.
 *
 * What decides whether an item shows: screens rebuilt to the approved designs ask the permissions table (`capability`);
 * screens still on the old flow keep the role list they always had (`roles`) until their own rebuild moves them onto it.
 * A parent shows when at least one of its sub-links does, and opens the first of them.
 *
 * Approved with the owner (3 Oct 2026): Dashboard and Reports are hidden until they are designed; Supplier AP is gone (the
 * Purchasing rebuild covers it); Restock levels is the last sub-link under Stock & counts.
 */
export type NavIconKey =
  | 'dashboard'
  | 'receiving'
  | 'purchasing'
  | 'prep'
  | 'dispatch'
  | 'stock-counts'
  | 'suppliers'
  | 'catalog'
  | 'audit-log'
  | 'settings';

export interface NavSubItemSpec {
  key: string;
  label: string;
  href: string;
}

export interface NavItemSpec {
  key: string;
  label: string;
  href: string;
  iconKey: NavIconKey;
  subItems?: NavSubItemSpec[];
}

export interface NavGroupSpec {
  key: string;
  label: string;
  items: NavItemSpec[];
}

interface Rule {
  capability?: Capability;
  roles?: readonly string[];
}
type SubRule = NavSubItemSpec & Rule;
type NavRule = Omit<NavItemSpec, 'subItems'> & Rule & { subItems?: SubRule[] };

const OLD_FLOW_ROLES = ['STORE_MANAGER', 'STORE_ATTENDANT'] as const;
const STORE_MANAGER_ONLY = ['STORE_MANAGER'] as const;

/**
 * Stock & counts sub-pages (Milestone Six, `1BI5-0`). "Daily count" is the Store Manager's verify screen; the Store
 * Attendant's own link goes to the blind count sheet, and they have no All items, Spot count or Stock ledger (all 403).
 * Restock levels is rebuilt and asks the permissions table.
 */
const STOCK_SUB_ITEMS: SubRule[] = [
  { key: 'overview', label: 'Overview', href: '/app/inventory/stock', roles: OLD_FLOW_ROLES },
  { key: 'items', label: 'All items', href: '/app/inventory/stock/items', roles: STORE_MANAGER_ONLY },
  { key: 'daily-count', label: 'Daily count', href: '/app/inventory/stock/counts', roles: OLD_FLOW_ROLES },
  { key: 'spot-count', label: 'Spot count', href: '/app/inventory/stock/spot-count', roles: STORE_MANAGER_ONLY },
  { key: 'ledger', label: 'Stock ledger', href: '/app/inventory/stock/ledger', roles: STORE_MANAGER_ONLY },
  { key: 'restock-levels', label: 'Restock levels', href: '/app/inventory/stock/restock-levels', capability: 'restock.read' },
];

const NAV_RULES: Array<{ key: string; label: string; items: NavRule[] }> = [
  {
    key: 'central-store',
    label: 'CENTRAL STORE',
    items: [
      { key: 'receiving', label: 'Receiving', href: '/app/inventory/receiving', iconKey: 'receiving', roles: OLD_FLOW_ROLES },
      { key: 'purchasing', label: 'Purchasing', href: '/app/inventory/purchasing', iconKey: 'purchasing', roles: STORE_MANAGER_ONLY },
      { key: 'prep', label: 'Prep', href: '/app/inventory/prep', iconKey: 'prep', roles: OLD_FLOW_ROLES },
      { key: 'dispatch', label: 'Dispatch', href: '/app/inventory/dispatch', iconKey: 'dispatch', roles: OLD_FLOW_ROLES },
      { key: 'stock-counts', label: 'Stock & counts', href: '/app/inventory/stock', iconKey: 'stock-counts', subItems: STOCK_SUB_ITEMS },
    ],
  },
  {
    key: 'procurement',
    label: 'PROCUREMENT',
    items: [
      { key: 'suppliers', label: 'Suppliers', href: '/app/inventory/suppliers', iconKey: 'suppliers', capability: 'suppliers.read' },
      { key: 'catalog', label: 'Catalog', href: '/app/inventory/catalog', iconKey: 'catalog', capability: 'catalog.read' },
      { key: 'audit-log', label: 'Audit log', href: '/app/inventory/audit-log', iconKey: 'audit-log', capability: 'audit.read' },
      // The Store Manager's alone, until a later session moves it onto the table. Not drawn in Paper.
      { key: 'settings', label: 'Settings', href: '/app/inventory/settings', iconKey: 'settings', roles: STORE_MANAGER_ONLY },
    ],
  },
];

/**
 * The sidebar a person sees inside the Central Store, from their role and the server's permissions table.
 * Every desktop role gets the rebuilt destinations they may read; the Store Manager and the Store Attendant also keep the
 * screens still on the old flow. Roles that come from another part of the app get a way back to their own dashboard.
 */
export function navGroupsFor(role: AppRole | string | undefined, can: (capability: Capability) => boolean): NavGroupSpec[] {
  const passes = (rule: Rule): boolean => (!rule.roles || (role !== undefined && rule.roles.includes(role))) && (!rule.capability || can(rule.capability));

  const toItem = (rule: NavRule): NavItemSpec | null => {
    if (!rule.subItems) {
      return passes(rule) ? { key: rule.key, label: rule.label, href: rule.href, iconKey: rule.iconKey } : null;
    }
    // The attendant's Daily count is the blind count sheet, a different page from the manager's verify screen.
    const subItems = rule.subItems
      .filter(passes)
      .map(({ key, label, href }): NavSubItemSpec => ({ key, label, href: role === 'STORE_ATTENDANT' && key === 'daily-count' ? '/app/inventory/stock/daily-count' : href }));
    const first = subItems[0];
    if (!first) return null;
    // A parent opens its first sub-link, so a role that can open only one of them lands on it.
    return { key: rule.key, label: rule.label, href: first.href, iconKey: rule.iconKey, subItems };
  };

  const groups: NavGroupSpec[] = NAV_RULES.map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items.map(toItem).filter((item): item is NavItemSpec => item !== null),
  })).filter((group) => group.items.length > 0);

  const home = role && role in roleHome ? roleHome[role as AppRole] : null;
  if (home && role !== 'STORE_MANAGER' && role !== 'STORE_ATTENDANT') {
    groups.unshift({ key: 'home', label: 'WENDO RMS', items: [{ key: 'home', label: 'My dashboard', href: home, iconKey: 'dashboard' }] });
  }
  return groups;
}
