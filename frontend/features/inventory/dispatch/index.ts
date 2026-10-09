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

// Block 2 phone screens (the Store Attendant): Dispatch tabs (D1, N2, G3), pack (D2 to D6), the dispatch file (N1).
export { AttendantDispatchScreen } from './components/phone/attendant-dispatch-screen';
export { PackDepartmentScreen } from './components/phone/pack-department-screen';
export { PackOverviewScreen } from './components/phone/pack-overview-screen';
export { FinalReviewScreen } from './components/phone/final-review-screen';
export { ReviewLinesScreen } from './components/phone/review-lines-screen';
export { SentScreen } from './components/phone/sent-screen';
export { DispatchFileScreen } from './components/phone/dispatch-file-screen';
