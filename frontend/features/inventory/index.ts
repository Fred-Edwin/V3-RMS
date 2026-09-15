/**
 * Inventory feature module — public entry point.
 *
 * Other feature modules import from here, never from this module's internals
 * (`FEATURE_REDO_PLAYBOOK.md` §9, `CODING_STANDARDS.md` §9). Add an export
 * here only when something outside this feature legitimately needs it.
 *
 * Milestone One: Catalog, Suppliers & Restock Levels.
 */

// Contract types, mirroring the frozen backend contract.
export * from './types';

// Milestone One screens — the six real screens `app/app/inventory/*` pages render.
export { ItemCatalogScreen } from './components/screens/item-catalog-screen';
export { SuppliersScreen } from './components/screens/suppliers-screen';
export { DepartmentRestockLevelsScreen } from './components/screens/department-restock-levels-screen';
