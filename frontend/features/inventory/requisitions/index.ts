/**
 * Requisitions feature module — public entry point.
 *
 * Other feature modules import from here, never from this module's internals
 * (`FEATURE_REDO_PLAYBOOK.md` §9, `CODING_STANDARDS.md` §9). Add an export
 * here only when something outside this feature legitimately needs it.
 *
 * Block 1: the Department Head's phone screens are the rebuilt ones below. The old contract types are still re-exported until the
 * desktop PR deletes the old approval screens; the new mirror is `_shared/types/requisitions-contract.ts`.
 */

// Old contract types (removed with the old desktop screens).
export * from './types';

// The Department Head's phone screens (Paper steps 1 to 6, 10, 14, 15, 18 and G1).
export { HeadHomeScreen } from './components/phone/head-home-screen';
export { HeadFileScreen } from './components/phone/head-file-screen';
export { HeadEditScreen } from './components/phone/head-edit-screen';
export { HeadAdditionScreen } from './components/phone/head-addition-screen';
export { HeadHistoryScreen } from './components/phone/head-history-screen';
