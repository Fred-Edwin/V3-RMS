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
