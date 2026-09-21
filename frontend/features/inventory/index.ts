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

// Catalog read — needed by features/requisitions' "+ Add an item" picker
// (Milestone Four, Session A), department-scoped item search.
export { listItems } from './services';

// Milestone One screens.
export { ItemCatalogScreen } from './components/screens/item-catalog-screen';
export { DepartmentRestockLevelsScreen } from './components/screens/department-restock-levels-screen';

// Milestone Two (Receiving & Supplier AP) — S5/S6 screens.
export { PurchasingHubScreen } from './components/screens/purchasing-hub-screen';
export { ReceivingWorklistScreen } from './components/screens/receiving-worklist-screen';
export { ReceivingHistoryScreen } from './components/screens/receiving-history-screen';
export { InboundListScreen } from './components/screens/inbound-list-screen';
export { HistoryListScreen } from './components/screens/history-list-screen';
export { NewPurchaseScreen } from './components/screens/new-purchase-screen';
export { NewGoodsReceiptScreen } from './components/screens/new-goods-receipt-screen';
export { GoodsReceiptDetailScreen } from './components/screens/goods-receipt-detail-screen';

// Milestone Two S8 — Suppliers ("what we owe"), Supplier detail, invoice/payment drawers.
// Replaces Milestone One's profile-only SuppliersScreen stub (retired 2026-09-18).
export { SuppliersApScreen } from './components/screens/suppliers-ap-screen';
export { SupplierDetailScreen } from './components/screens/supplier-detail-screen';

// Milestone Three — Prep.
export { PrepRunsListScreen } from './components/screens/prep-runs-list-screen';
export { PrepHistoryScreen } from './components/screens/prep-history-screen';
