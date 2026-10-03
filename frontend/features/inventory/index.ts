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

// SignSheetDialog / SignedBySignature live in components/app/shell/sign-sheet
// (genuinely shared: receiving signs, requisitions sign, Milestone Five's
// dispatch will sign too) — re-exported here so existing `@/features/
// inventory` imports keep working.
export { SignSheetDialog, SignedBySignature } from '@/components/app/shell/sign-sheet';
export type {
  SignSheetDialogProps,
  SignSheetDocumentSummary,
  SignedBySignatureProps,
} from '@/components/app/shell/sign-sheet';

// Milestone One screens.
export { ItemCatalogScreen } from './components/screens/item-catalog-screen';
export { StoreRestockLevelsScreen } from './components/screens/store-restock-levels-screen';
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

// Milestone Six, Session 1 — Stock position & waste.
export { StockHubScreen } from './components/screens/stock-hub-screen';
export { StockItemsScreen } from './components/screens/stock-items-screen';
export { StockLedgerScreen, StockLedgerPickerScreen } from './components/screens/stock-ledger-screen';
export { DepartmentLogWasteScreen } from './components/screens/department-log-waste-screen';
export { DailyCountScreen } from './components/screens/daily-count-screen';
export { StockCountsScreen } from './components/screens/stock-counts-screen';
export { SpotCountScreen } from './components/screens/spot-count-screen';

// Pre-Demo Fixes — Store Manager Settings (Team + My PIN).
export { SettingsScreen } from './components/screens/settings-screen';

// Milestone Six, Session 3 — pieces the branch day close (features/branch-day)
// shares with the Central Store's counting screens, so it reuses rather than
// forks them: PIN sheet, the one reason control, states kit, mobile header,
// drawer motion, number/date formatting, the loader hook.
export { PinSheet } from './components/stock/pin-sheet';
export type { PinSheetProps } from './components/stock/pin-sheet';
export { CountReasonControl } from './components/stock/count-reason';
export type { CountReasonControlProps, ReasonOption } from './components/stock/count-reason';
export { Reveal, StatCell, StatusDot } from './components/stock/count-verify-parts';
export { HighlightOnChange } from './components/stock/highlight-on-change';
export { StockMobileHeader } from './components/stock/stock-mobile-header';
export { STOCK_DRAWER_MOTION, useReturnFocus } from './components/stock/log-waste-drawer';
export {
  FormErrorBanner,
  KpiValueSkeleton,
  ListRowSkeleton,
  MobileListRowSkeleton,
  SkeletonRows,
  StockEmptyCard,
  StockErrorCard,
  TableRowSkeleton,
} from './components/stock/stock-states';
export {
  DEPARTMENT_LABEL,
  formatClock,
  formatCountDateFull,
  formatCountDateLong,
  formatCountDateShort,
  formatDayMonth,
  formatDayMonthClock,
  formatKes,
  formatNairobiDayMonth,
  formatQty,
  formatSignedKes,
  formatVariance,
  shortName,
} from './components/stock/stock-format';
export { useResource } from './hooks/use-stock';
