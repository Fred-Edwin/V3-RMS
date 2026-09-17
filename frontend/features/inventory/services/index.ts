/**
 * Inventory Milestone One — service module.
 *
 * Points at the real backend now that it's built and its test suite passes
 * (692+ tests, 2026-09-15). The mock (`inventory-mock-service.ts`) is kept
 * for `/dev/inventory-preview` and offline development — swap this single
 * export back to it if the backend is ever unavailable; no hook or screen
 * needs to change either way, since both modules share the same function
 * signatures.
 */
export * from './inventory-api-service';
export * from './receiving-api-service';
