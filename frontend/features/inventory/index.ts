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
export { ItemCatalogScreen } from './catalog/components/screens/item-catalog-screen';
export { StoreRestockLevelsScreen } from './restock/components/screens/store-restock-levels-screen';
export { DepartmentRestockLevelsScreen } from './restock/components/screens/department-restock-levels-screen';

// Milestone Two (Receiving & Supplier AP) — S5/S6 screens.
export { PurchasingHubScreen } from './purchasing/components/screens/purchasing-hub-screen';
export { ReceivingWorklistScreen } from './purchasing/components/screens/receiving-worklist-screen';
export { ReceivingHistoryScreen } from './purchasing/components/screens/receiving-history-screen';
export { InboundListScreen } from './purchasing/components/screens/inbound-list-screen';
export { HistoryListScreen } from './purchasing/components/screens/history-list-screen';
export { NewPurchaseScreen } from './purchasing/components/screens/new-purchase-screen';
export { NewGoodsReceiptScreen } from './purchasing/components/screens/new-goods-receipt-screen';
export { GoodsReceiptDetailScreen } from './purchasing/components/screens/goods-receipt-detail-screen';

// Suppliers (Part C, Session 6): the list and the supplier page replace Milestone Two's Supplier AP screens.
export { SuppliersListScreen } from './suppliers/components/screens/suppliers-list-screen';
export { SupplierPageScreen } from './suppliers/components/screens/supplier-page-screen';

// Milestone Three — Prep.
export { PrepRunsListScreen } from './prep/components/screens/prep-runs-list-screen';
export { PrepHistoryScreen } from './prep/components/screens/prep-history-screen';

// Milestone Six, Session 1 — Stock position & waste.
export { StockHubScreen } from './stock/components/screens/stock-hub-screen';
export { StockItemsScreen } from './stock/components/screens/stock-items-screen';
export { StockLedgerScreen, StockLedgerPickerScreen } from './stock/components/screens/stock-ledger-screen';
export { DepartmentLogWasteScreen } from './waste/components/screens/department-log-waste-screen';
export { DailyCountScreen } from './counting/components/screens/daily-count-screen';
export { StockCountsScreen } from './counting/components/screens/stock-counts-screen';
export { SpotCountScreen } from './counting/components/screens/spot-count-screen';

// Pre-Demo Fixes — Store Manager Settings (Team + My PIN).
export { SettingsScreen } from './settings/components/screens/settings-screen';

// Milestone Six, Session 3 — pieces the branch day close (features/branch-day)
// shares with the Central Store's counting screens, so it reuses rather than
// forks them: PIN sheet, the one reason control, states kit, mobile header,
// drawer motion, number/date formatting, the loader hook.
export { PinSheet } from './counting/components/pin-sheet';
export type { PinSheetProps } from './counting/components/pin-sheet';
export { CountReasonControl } from './counting/components/count-reason';
export type { CountReasonControlProps, ReasonOption } from './counting/components/count-reason';
export { Reveal, StatCell, StatusDot } from './counting/components/count-verify-parts';
export { HighlightOnChange } from './stock/components/highlight-on-change';
export { StockMobileHeader } from './stock/components/stock-mobile-header';
export { STOCK_DRAWER_MOTION, useReturnFocus } from './waste/components/log-waste-drawer';
export {
  FormErrorBanner,
  KpiValueSkeleton,
  ListRowSkeleton,
  MobileListRowSkeleton,
  SkeletonRows,
  StockEmptyCard,
  StockErrorCard,
  TableRowSkeleton,
} from './_shared/components/stock-states';
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
} from './_shared/components/stock-format';
export { useResource } from './stock/hooks/use-stock';
