/**
 * Inventory's public file: the only thing other modules may import from `modules/inventory/`
 * (see .dependency-cruiser.cjs). Sub-modules inside Inventory import each other directly.
 */
export { postStockMovement, type PostStockMovementInput } from './stock/ledger/ledger-door';
