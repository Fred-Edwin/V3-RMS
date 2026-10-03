import { roleHome } from '@/lib/role-home';
import type { AppRole } from '@/types/auth';
import type { Capability } from './capabilities';

/**
 * Which sidebar items a person sees inside the Central Store. Pure data and rules, so it can be tested without a browser;
 * `inventory-shell.tsx` turns the result into the real sidebar by giving each `iconKey` its icon.
 *
 * What decides whether an item shows: screens rebuilt to the approved designs ask the permissions table (`capability`);
 * screens still on the old flow keep the role list they always had (`roles`) until their own rebuild moves them onto the table.
 */
export type NavIconKey =
  | 'dashboard'
  | 'receiving'
  | 'purchasing'
  | 'prep'
  | 'dispatch'
  | 'stock-counts'
  | 'restock-levels'
  | 'suppliers'
  | 'catalog'
  | 'reports'
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

type NavRule = NavItemSpec & { capability?: Capability; roles?: readonly string[] };

/**
 * Stock & counts sub-pages (Milestone Six, `1BI5-0`). "Daily count" is the Store Manager's verify screen; the Store
 * Attendant's own link goes to the blind count sheet (see `navGroupsFor`).
 */
const STOCK_SUB_ITEMS: NavSubItemSpec[] = [
  { key: 'overview', label: 'Overview', href: '/app/inventory/stock' },
  { key: 'items', label: 'All items', href: '/app/inventory/stock/items' },
  { key: 'daily-count', label: 'Daily count', href: '/app/inventory/stock/counts' },
  { key: 'spot-count', label: 'Spot count', href: '/app/inventory/stock/spot-count' },
  { key: 'ledger', label: 'Stock ledger', href: '/app/inventory/stock/ledger' },
];

/** Blind count: the attendant has no All items / Stock ledger (both 403), and no spot count. */
const ATTENDANT_STOCK_SUB_KEYS = new Set(['overview', 'daily-count']);

const OLD_FLOW_ROLES = ['STORE_MANAGER', 'STORE_ATTENDANT'] as const;

const NAV_RULES: Array<{ key: string; label: string; items: NavRule[] }> = [
  {
    key: 'central-store',
    label: 'CENTRAL STORE',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '#', iconKey: 'dashboard', roles: OLD_FLOW_ROLES },
      { key: 'receiving', label: 'Receiving', href: '/app/inventory/receiving', iconKey: 'receiving', roles: OLD_FLOW_ROLES },
      { key: 'purchasing', label: 'Purchasing', href: '/app/inventory/purchasing', iconKey: 'purchasing', roles: ['STORE_MANAGER'] },
      { key: 'prep', label: 'Prep', href: '/app/inventory/prep', iconKey: 'prep', roles: OLD_FLOW_ROLES },
      { key: 'dispatch', label: 'Dispatch', href: '/app/inventory/dispatch', iconKey: 'dispatch', roles: OLD_FLOW_ROLES },
      { key: 'stock-counts', label: 'Stock & counts', href: '/app/inventory/stock', iconKey: 'stock-counts', subItems: STOCK_SUB_ITEMS, roles: OLD_FLOW_ROLES },
      { key: 'restock-levels', label: 'Restock levels', href: '/app/inventory/stock/restock-levels', iconKey: 'restock-levels', capability: 'restock.read' },
    ],
  },
  {
    key: 'procurement',
    label: 'PROCUREMENT',
    items: [
      { key: 'suppliers', label: 'Suppliers', href: '/app/inventory/suppliers', iconKey: 'suppliers', capability: 'suppliers.read' },
      { key: 'catalog', label: 'Catalog', href: '/app/inventory/catalog', iconKey: 'catalog', capability: 'catalog.read' },
      { key: 'reports', label: 'Reports', href: '#', iconKey: 'reports', roles: OLD_FLOW_ROLES },
      { key: 'audit-log', label: 'Audit log', href: '/app/inventory/audit-log', iconKey: 'audit-log', capability: 'audit.read' },
      // The Store Manager's alone, until a later session moves it onto the table.
      { key: 'settings', label: 'Settings', href: '/app/inventory/settings', iconKey: 'settings', roles: ['STORE_MANAGER'] },
    ],
  },
];

/**
 * The sidebar a person sees inside the Central Store, from their role and the server's permissions table.
 * Every desktop role gets the rebuilt destinations they may read; the Store Manager and the Store Attendant also keep the
 * screens still on the old flow. The Store Attendant's Stock & counts keeps only the blind count (no All items, no ledger).
 * Roles that come from another part of the app get a way back to their own dashboard.
 */
export function navGroupsFor(role: AppRole | string | undefined, can: (capability: Capability) => boolean): NavGroupSpec[] {
  const visible = (rule: NavRule): boolean =>
    (!rule.roles || (role !== undefined && rule.roles.includes(role))) && (!rule.capability || can(rule.capability));

  const groups: NavGroupSpec[] = NAV_RULES.map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items.filter(visible).map((rule): NavItemSpec => {
      const item: NavItemSpec = { key: rule.key, label: rule.label, href: rule.href, iconKey: rule.iconKey, subItems: rule.subItems };
      if (role === 'STORE_ATTENDANT' && item.subItems) {
        return {
          ...item,
          subItems: item.subItems
            .filter((sub) => ATTENDANT_STOCK_SUB_KEYS.has(sub.key))
            .map((sub) => (sub.key === 'daily-count' ? { ...sub, href: '/app/inventory/stock/daily-count' } : sub)),
        };
      }
      return item;
    }),
  })).filter((group) => group.items.length > 0);

  const home = role && role in roleHome ? roleHome[role as AppRole] : null;
  if (home && role !== 'STORE_MANAGER' && role !== 'STORE_ATTENDANT') {
    groups.unshift({ key: 'home', label: 'WENDO RMS', items: [{ key: 'home', label: 'My dashboard', href: home, iconKey: 'dashboard' }] });
  }
  return groups;
}
