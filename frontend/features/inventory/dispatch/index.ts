/**
 * Dispatch feature module — public entry point.
 *
 * Other feature modules import from here, never from this module's internals
 * (`FEATURE_REDO_PLAYBOOK.md` §9, `CODING_STANDARDS.md` §9).
 *
 * Milestone Five (Dispatch & Branch Receiving), Session A — Central Store
 * dispatch queue, fulfil & sign, delivery note. Session B adds the branch
 * receiving/discrepancy side.
 */

// Contract types, mirroring the frozen backend contract.
export * from './types';

// Session A screens.
export { DispatchQueueFulfilScreen } from './components/screens/dispatch-queue-fulfil-screen';
export { DeliveryNoteScreen } from './components/screens/delivery-note-screen';

// Session B screens.
export { BranchIncomingConfirmScreen } from './components/screens/branch-incoming-confirm-screen';
export { BranchIncomingScreenMobile } from './components/screens/branch-incoming-screen-mobile';
export { ConfirmReceiptScreenMobile } from './components/screens/confirm-receipt-screen-mobile';
export { DiscrepancyResolutionScreen } from './components/screens/discrepancy-resolution-screen';
export { DiscrepancyDetailScreen } from './components/screens/discrepancy-detail-screen';
export { DiscrepanciesListScreen } from './components/screens/discrepancies-list-screen';
