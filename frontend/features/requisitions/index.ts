/**
 * Requisitions feature module — public entry point.
 *
 * Other feature modules import from here, never from this module's internals
 * (`FEATURE_REDO_PLAYBOOK.md` §9, `CODING_STANDARDS.md` §9). Add an export
 * here only when something outside this feature legitimately needs it.
 *
 * Milestone Four, Session A — Department Head fill only. Session B adds the
 * branch-manager approve/return/edit side.
 */

// Contract types, mirroring the frozen backend contract.
export * from './types';

// Session A screens.
export { DepartmentLandingScreen } from './components/screens/department-landing-screen';
export { RequisitionsListScreen } from './components/screens/requisitions-list-screen';
export { RequisitionSectionFillScreen } from './components/screens/requisition-section-fill-screen';
