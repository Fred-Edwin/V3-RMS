// Legacy Phase 1 inventory types. Trimmed 2026-09-15 to just what
// services/inventoryService.ts's surviving Locations functions need — every
// other Phase 1 type (items, suppliers-with-catalog-fields, purchase orders,
// prep, stock counts, waste, supplier invoices/AP, reports) described a
// route Inventory Milestone One's backend session deleted (see
// docs/features/inventory/05-plan.md §1.4). Those types had no remaining
// caller anywhere in the frontend; removed as dead code rather than kept
// "just in case".
//
// The new Milestone One catalog/supplier/restock-level shapes live in
// frontend/features/inventory/types/ instead, mirroring the frozen backend
// contract (backend/src/modules/inventory/inventory-validators.ts).
//
// This file survives only because /locations and /locations/central-store
// are unchanged by Milestone One (plan §1.3) — Location itself was not
// touched. If services/inventoryService.ts's Locations block is ever
// absorbed into features/inventory/, delete this file too.

export type LocationType = 'CENTRAL_STORE' | 'BRANCH_DEPARTMENT';

export interface InventoryLocation {
  id: string;
  organizationId: string;
  type: LocationType;
  name: string;
  isActive: boolean;
}
