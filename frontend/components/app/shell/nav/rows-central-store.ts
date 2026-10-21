import {
  AuditLogIcon,
  CatalogIcon,
  DispatchIcon,
  PrepIcon,
  PurchasingIcon,
  ReceivingIcon,
  SettingsIcon,
  StockCountsIcon,
  SuppliersIcon,
} from '../nav-icons';
import type { NavRow } from './types';
import { ACCOUNTANT, DESKTOP_HUB, DIRECTOR, HUB_ALL, MANAGER, STORE_ATTENDANT, STORE_MANAGER, SYSTEM_ADMIN, ico } from './shared';

/** Central Store (every desktop role reads it; the server's permissions table decides what each may open). */
export const CENTRAL_STORE_ROWS: readonly NavRow[] = [
  { key: 'receiving', label: 'Receiving', group: 'central-store', icon: ReceivingIcon, newHref: '/app/inventory/receiving', roles: HUB_ALL, anyCapability: ['orders.read', 'orders.receive'], hub: true, badge: 'purchasing-receiving' },
  { key: 'purchasing', label: 'Purchasing', group: 'central-store', icon: PurchasingIcon, newHref: '/app/inventory/purchasing', roles: DESKTOP_HUB, anyCapability: ['orders.read', 'orders.request'], hub: true },
  // The Store Attendant's Purchasing phone (Paper 28I): the same link with five sub-links. Only one of the two rows shows for a role.
  {
    key: 'purchasing',
    label: 'Purchasing',
    group: 'central-store',
    icon: PurchasingIcon,
    roles: [STORE_ATTENDANT],
    anyCapability: ['orders.read', 'orders.request'],
    hub: true,
    subItems: [
      { key: 'purchasing-home', label: 'Home', newHref: '/app/inventory/purchasing', roles: [STORE_ATTENDANT] },
      { key: 'purchasing-restock', label: 'Restock list', newHref: '/app/inventory/purchasing/restock', roles: [STORE_ATTENDANT], badge: 'purchasing-restock' },
      { key: 'purchasing-new', label: 'New order', newHref: '/app/inventory/purchasing/new', roles: [STORE_ATTENDANT] },
      { key: 'purchasing-my-orders', label: 'My orders', newHref: '/app/inventory/purchasing/my-orders', roles: [STORE_ATTENDANT], badge: 'purchasing-my-orders' },
      { key: 'purchasing-history', label: 'History', newHref: '/app/inventory/purchasing/history', roles: [STORE_ATTENDANT] },
      { key: 'purchasing-levels', label: 'Restock levels', newHref: '/app/inventory/purchasing/levels', roles: [STORE_ATTENDANT] },
    ],
  },
  {
    key: 'prep',
    label: 'Prep',
    group: 'central-store',
    icon: PrepIcon,
    roles: HUB_ALL,
    capability: 'prep.read',
    hub: true,
    badge: 'prep-needs-look',
    subItems: [
      { key: 'runs', label: 'Runs', newHref: '/app/inventory/prep', roles: HUB_ALL, badge: 'prep-needs-look' },
      { key: 'usual-recipes', label: 'Usual recipes', newHref: '/app/inventory/prep/recipes', roles: HUB_ALL },
      { key: 'history', label: 'History', newHref: '/app/inventory/prep/history', roles: HUB_ALL },
    ],
  },
  {
    key: 'requisitions',
    label: 'Requisitions',
    group: 'central-store',
    icon: ico.clipboard,
    roles: [STORE_MANAGER, ACCOUNTANT, DIRECTOR, SYSTEM_ADMIN],
    capability: 'requisitions.read',
    hub: true,
    badge: 'discrepancies',
    subItems: [
      { key: 'queue', label: 'Queue', newHref: '/app/inventory/requisitions', roles: [STORE_MANAGER, ACCOUNTANT, DIRECTOR, SYSTEM_ADMIN] },
      { key: 'discrepancies', label: 'Discrepancies', newHref: '/app/inventory/requisitions/discrepancies', roles: [STORE_MANAGER, ACCOUNTANT, DIRECTOR, SYSTEM_ADMIN], badge: 'discrepancies' },
      { key: 'history', label: 'History', newHref: '/app/inventory/requisitions/history', roles: [STORE_MANAGER, ACCOUNTANT, DIRECTOR, SYSTEM_ADMIN] },
    ],
  },
  { key: 'dispatch', label: 'Dispatch', group: 'central-store', icon: DispatchIcon, newHref: '/app/inventory/dispatch', roles: [STORE_ATTENDANT], hub: true },
  {
    key: 'stock-counts',
    label: 'Stock and counts',
    group: 'central-store',
    icon: StockCountsIcon,
    match: ['/app/inventory/stock'],
    roles: HUB_ALL,
    hub: true,
    subItems: [
      { key: 'overview', label: 'Overview', newHref: '/app/inventory/stock', roles: DESKTOP_HUB, capability: 'stock.read' },
      { key: 'items', label: 'All items', newHref: '/app/inventory/stock/items', roles: DESKTOP_HUB, capability: 'stock.read' },
      { key: 'counts', label: 'Counts', newHref: '/app/inventory/stock/counts', roles: HUB_ALL, anyCapability: ['counts.read', 'counts.record'] },
      { key: 'waste', label: 'Waste', newHref: '/app/inventory/stock/waste', roles: HUB_ALL, capability: 'waste.read' },
      { key: 'ledger', label: 'Stock ledger', newHref: '/app/inventory/stock/ledger', roles: DESKTOP_HUB, capability: 'stock.read' },
      { key: 'restock-levels', label: 'Restock levels', newHref: '/app/inventory/stock/restock-levels', roles: DESKTOP_HUB, capability: 'restock.read' },
    ],
  },
  { key: 'suppliers', label: 'Suppliers', group: 'procurement', icon: SuppliersIcon, newHref: '/app/inventory/suppliers', roles: DESKTOP_HUB, capability: 'suppliers.read', hub: true },
  { key: 'catalog', label: 'Catalog', group: 'procurement', icon: CatalogIcon, newHref: '/app/inventory/catalog', roles: HUB_ALL, capability: 'catalog.read', hub: true },
  // The Branch Manager has the 'branch-audit-log' row (the same screen), so the hub row leaves them out: one link, not two.
  { key: 'audit-log', label: 'Stock audit log', group: 'procurement', icon: AuditLogIcon, newHref: '/app/inventory/audit-log', roles: DESKTOP_HUB.filter((r) => r !== MANAGER), capability: 'audit.read', hub: true },
  { key: 'carriers', label: 'Carriers', group: 'procurement', icon: ico.truck, newHref: '/app/inventory/carriers', roles: [STORE_MANAGER, DIRECTOR, ACCOUNTANT, SYSTEM_ADMIN], capability: 'carriers.read', hub: true },
  { key: 'inventory-settings', label: 'Inventory settings', group: 'procurement', icon: SettingsIcon, oldHref: '/app/inventory/settings', framed: true, roles: [STORE_MANAGER], hub: true },
];
