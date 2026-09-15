/**
 * Inventory Milestone One — service module.
 *
 * Exports the mock implementation for now. This session builds against a
 * mock of the frozen contract and never waits on the parallel backend build
 * (per the session brief) — swapping this file's re-export for a real
 * `apiClient`-backed implementation is a later, separate change and does not
 * touch any hook or screen that imports from here.
 */
export * from './inventory-mock-service';
export { CENTRAL_STORE_LOCATION_ID } from './mock-data';
