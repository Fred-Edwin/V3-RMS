/**
 * Dispatch feature module — public entry point.
 *
 * Other feature modules import from here, never from this module's internals
 * (`FEATURE_REDO_PLAYBOOK.md` §9, `CODING_STANDARDS.md` §9).
 *
 * Block 2: the Store Attendant's phone screens (Dispatch tabs D1, N2, G3; pack D2 to D6; the dispatch file N1). The desktop
 * screens (the dispatch file, delivery notes, Carriers) are exported from `features/inventory/index.ts`.
 */
export { AttendantDispatchScreen } from './components/phone/attendant-dispatch-screen';
export { PackDepartmentScreen } from './components/phone/pack-department-screen';
export { PackOverviewScreen } from './components/phone/pack-overview-screen';
export { FinalReviewScreen } from './components/phone/final-review-screen';
export { ReviewLinesScreen } from './components/phone/review-lines-screen';
export { SentScreen } from './components/phone/sent-screen';
export { DispatchFileScreen } from './components/phone/dispatch-file-screen';
// Block 4 (Branch day, Today): the Branch Manager confirms a delivery on a department's behalf from the blocked day.
export { ConfirmForDepartmentDrawer } from './components/desktop/confirm-for-department-drawer';
