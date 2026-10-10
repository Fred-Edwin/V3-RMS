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

// Purchasing and Receiving screens were removed (4 Oct 2026) ahead of their rebuild.

// Suppliers (Part C, Session 6): the list and the supplier page replace Milestone Two's Supplier AP screens.
export { SuppliersListScreen } from './suppliers/components/screens/suppliers-list-screen';
export { SupplierPageScreen } from './suppliers/components/screens/supplier-page-screen';

// Requisitions rebuild (Block 1, desktop): the list, the file, the printed A4, the sidebar badge, and Departments in Settings.
export { RequisitionsListScreen } from './requisitions/components/requisitions-list-screen';
export { RequisitionFileScreen } from './requisitions/components/requisition-file-screen';
export { RequisitionPrintScreen } from './requisitions/components/requisition-print-screen';
export { useRequisitionBadges } from './requisitions/hooks/use-requisition-badges';

// Dispatch, deliveries and discrepancies (Block 2, desktop): the dispatch file, delivery notes, Carriers, the discrepancy list and file.
export { DispatchFileScreen } from './dispatch/components/desktop/dispatch-file-screen';
export { DeliveryNotePrintScreen, DeliveryNoteBatchPrintScreen } from './dispatch/components/desktop/delivery-note-print-screen';
export { CarriersScreen } from './dispatch/components/desktop/carriers-screen';
export { DiscrepanciesListScreen } from './discrepancies/components/discrepancies-list-screen';
export { DiscrepancyFileScreen } from './discrepancies/components/discrepancy-file-screen';
export { DepartmentsScreen } from './departments/components/departments-screen';

// Milestone Three — Prep.
export { PrepHomeScreen } from './prep/runs/components/prep-home-screen';
export { RecordRunScreen } from './prep/record/components/record-run-screen';
export { PrepHistoryScreen } from './prep/runs/components/history-screen';
// The sidebar's "Needs a look" number (Prep slice 4); the shell reads it, nothing else needs the store.
export { useNeedsLookCount } from './prep/review/hooks/use-needs-look-count';

// Milestone Six, Session 1 — Stock position & waste.
// The old ledger screen stays only for the branch Department Head's ledger (`app/branch/(shell)/ledger`); it goes with branch day's redo.
export { StockLedgerScreen as DepartmentStockLedgerScreen, StockLedgerPickerScreen } from './stock/components/screens/stock-ledger-screen';
// Block 3 Branch waste: phone (`waste/branch/`) and desktop W6, W7, W8, entry drawer (`waste/branch-desk/`).
export { WasteScreen, LogWastePhoneScreen, DepartmentWasteScreen, LogWasteFlow, BranchWasteDeskScreen } from './waste';
export { StockOverviewScreen, StockItemsScreen, StockLedgerScreen, StockCardScreen } from './stock';

// Stock, Counting and Waste rebuild (Paper "Inventory · Counting redesign (Oct 7)"): the new screens, one public entry per area.
export { BlankSheetPage, CountRecordPage, CountsHomeScreen, CountSetupScreen, MyCountsScreen, PickSectionScreen, SignedCountScreen, StartCountScreen, CountScreen, ReviewCountScreen, ReviewSignScreen, SubmittedScreen } from './counting';

// Block 4 Branch day: the head's and member's phone screens (`branch-day/phone/`).
export * from './branch-day/phone';

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
export { StockMobileHeader } from './_shared/components/stock-mobile-header';
export { STOCK_DRAWER_MOTION, useReturnFocus } from './_shared/components/drawer-motion';
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

// The shell's one navigation table (`components/app/shell/nav-table.ts`) shows Central Store links by the server's capabilities.
export type { Capability } from './_shared/lib/capabilities';
export { usePermissions } from './_shared/hooks/use-permissions';
