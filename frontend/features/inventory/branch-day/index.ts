/**
 * Branch day: public entry point (Block 4). Other features import from here, never from this module's internals.
 * The contract mirror (the wire types of BD1 to BD21) and the wording table are shared with the phone screens; the desktop screens
 * are re-exported through `features/inventory/index.ts`.
 */
export * from './_shared/types/branch-day-contract';
export * from './_shared/lib/branch-day-copy';
export * from './desk';
