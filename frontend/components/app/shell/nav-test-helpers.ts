import type { Capability } from '@/features/inventory';
import type { AppRole } from '@/types/auth';
import type { NavContext, NavGroup } from './nav-table';

/** Shared set-up for the `nav-*.test.ts` files: the roles, a context builder and small readers over the groups `navFor` returns. */

export const ROLES: AppRole[] = ['WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER', 'SYSTEM_ADMIN', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'];
export const FLOOR: AppRole[] = ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'];
export const DESKTOP: AppRole[] = ['HR_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN'];

export const holds =
  (...caps: Capability[]) =>
  (c: Capability): boolean =>
    caps.includes(c);

export const READ_ALL = holds('catalog.read', 'catalog.see_costs', 'restock.read', 'suppliers.read', 'payables.read', 'orders.read', 'prep.read', 'prep.read_flags', 'audit.read', 'requisitions.read', 'departments.read');
export const EVERYTHING = (): boolean => true;
export const BRANCHES = [
  { id: 'b-town', name: 'Nyeri Town' },
  { id: 'b-highway', name: 'Nyeri Highway' },
];

export const ctxFor = (role: AppRole, over: Partial<NavContext> = {}): NavContext => ({ role, isDepartmentHead: false, can: READ_ALL, creditAccounts: true, branches: BRANCHES, ...over });

export const links = (groups: NavGroup[]) => groups.flatMap((g) => g.items);
export const keys = (groups: NavGroup[]): string[] => links(groups).map((i) => i.key);
export const hrefs = (groups: NavGroup[]): string[] => links(groups).flatMap((i) => (i.subItems ? i.subItems.map((s) => s.href) : [i.href]));
export const groupKeys = (groups: NavGroup[]): string[] => groups.map((g) => g.key);
export const item = (groups: NavGroup[], key: string) => links(groups).find((i) => i.key === key);
