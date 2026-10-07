// Inventory — Milestone One (Catalog, Suppliers & Restock Levels)
// Mirrors the FROZEN backend contract by hand (no pnpm workspace in this repo,
// so there is no shared package to import from).
//
// Authoritative source: backend/src/modules/inventory/inventory-validators.ts
// (Zod schemas) + inventory.types.ts (z.infer types). If this file's shape
// disagrees with that one, the backend file wins — fix this file, not the
// other way around. A contract test on the backend enforces the reverse
// direction (serializer output satisfies the schemas).
//
// Wire-format rule: every decimal (quantity, factor, pack size, cost, restock
// level) crosses the wire as a string, never a JS number.
//
// Plan: docs/features/inventory/05-plan.md §5.
//
// LOCATION: this lives in the feature module, not `frontend/types/`, per the
// 2026-09-15 amendment to FEATURE_REDO_PLAYBOOK.md §9 (the frontend is now
// modularized by feature, mirroring backend/src/modules/). The legacy
// `frontend/types/inventory.ts` still describes the OLD Phase 1 shape and is
// deliberately left alone — the not-yet-redone inventory pages import it and
// stay alive until Session 5 removes them with their endpoints.

// ─── Enums ──────────────────────────────────────────────────────────────────

/** `STOCKED` is the renamed `PASS_THROUGH`. `RAW_INGREDIENT` may never be department-scoped. */
export type InventoryItemType = 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED';

export type DepartmentTag = 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING';

/** Pre-fills the per-receipt payment toggle; changeable per receipt. */
export type SupplierPaymentTerms = 'INVOICE_TO_FOLLOW' | 'PAY_NOW';

// ─── Categories ─────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  /** Live items only — what "Manage categories" renders as "38 items". */
  itemCount: number;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListCategoriesQuery {
  includeRetired?: boolean;
}

export interface CreateCategoryInput {
  name: string;
}

export interface UpdateCategoryInput {
  name: string;
}

// ─── Items ──────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  type: InventoryItemType;
  /** Null when the item's category was retired and none was reassigned. */
  categoryId: string | null;
  /** A default reference only — the item can still be received from any supplier. */
  preferredSupplierId: string | null;
  buyUnit: string;
  usageUnit: string;
  /** Null renders as "no conversion" (e.g. an item bought and used in kg). */
  conversionFactor: string | null;
  /** Null renders as "—". Supplier invoices price by pack, so this is common. */
  packSize: string | null;
  /** MUST be empty when `type` is `RAW_INGREDIENT`. */
  departmentTags: DepartmentTag[];
  category: { id: string; name: string } | null;
  preferredSupplier: { id: string; name: string } | null;
  currentCost: string;
  /** Null when no restock level has been set for this item at the Central Store. */
  centralStoreRestockLevel: string | null;
  /** Days the suggested restock level covers; null = the default of 15. Store Manager only (§30.8). */
  daysOfCover?: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The KPI strip on the Item Catalog screen (§29.3). Counts cover all live
 * items, regardless of the list's filters.
 */
export interface ItemCatalogMeta {
  itemsTracked: number;
  typesRepresented: number;
  categoryCount: number;
  retiredCategoryCount: number;
  departmentCount: number;
  supplierCount: number;
  /** Placeholder units from seeding: usage unit = buy unit, no pack size, no conversion. */
  needsSetup: number;
  /** Central Store items below their restock level. `null` for anyone but the Store Manager. */
  lowOrOut: number | null;
  /** Live items created in the last 7 days. */
  addedThisWeek: number;
  /** Live items per type, regardless of the list's filters — the counts on the type chips (§30.1). */
  typeCounts: Record<InventoryItemType, number>;
  /** Live items created in the last 7 days by a Store Attendant (§30.1). */
  addedByAttendant: number;
}

/** Why a search matched when it was a supplier's code or name rather than ours (§28.5). */
export interface ItemMatchedOn {
  supplier: { id: string; name: string };
  field: 'supplierItemCode' | 'supplierItemName';
  value: string;
  /** The matched line's name for the item, so a code match can show "Their name: …" (§30.1). */
  supplierItemName: string | null;
}

/**
 * A catalog list row. For a Store Attendant the four money / ordering fields
 * (`currentCost`, `centralStoreRestockLevel`, `preferredSupplier`,
 * `preferredSupplierId`) are absent at runtime (§29.4) even though this type
 * declares them; screens that render them must be Store-Manager-only.
 */
export interface InventoryItemListRow extends InventoryItem {
  /** Suppliers with at least one catalog line for the item (§30.1). */
  supplierCount: number;
  matchedOn: ItemMatchedOn | null;
}

/** One supplier's line for an item: their name and code, their pack, their price (§28.3). Prices are absent for attendants. */
export interface ItemSupplierLine {
  lineId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierItemName: string | null;
  supplierItemCode: string | null;
  buyUnit: string | null;
  packSize: string | null;
  lastPrice: string | null;
  lastPriceAt: string | null;
  /** Who set the price by hand; `null` when it came from a signed receipt or is unset (§30.3). */
  lastPriceSetBy: { id: string; name: string } | null;
  isPreferred: boolean;
  /** Seeding marked this line preferred; shows "Preferred · confirm" until confirmed. */
  preferredNeedsConfirm: boolean;
}

/** `GET /inventory/items/:id` — the item plus who sells it. */
export interface InventoryItemDetail extends InventoryItem {
  /** On hand at the Central Store only, from the ledger (§30.1). Store Manager only. */
  centralStoreOnHand: string;
  suppliers: ItemSupplierLine[];
}

export type ItemChangeKind = 'CREATED' | 'UPDATED' | 'RETIRED' | 'RESTORED' | 'SUPPLIER_ADDED' | 'SUPPLIER_PRICE_SET';

/** One line of an item's history (§30.4). `summary` is a sentence without the actor: show "{changedBy.name} {summary}". */
export interface ItemHistoryEntry {
  id: string;
  kind: ItemChangeKind;
  summary: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedBy: { id: string; name: string };
  createdAt: string;
}

/** `GET /inventory/items/:id/change-review` — counts for the "Review the change" step (§29.6). Always numbers. */
export interface ItemChangeReview {
  inventoryItemId: string;
  itemName: string;
  onHandQty: string;
  locationsHoldingStock: number;
  stockEntries: number;
  receipts: number;
  receiptLines: number;
  openOrders: number;
  hasHistory: boolean;
}

/** Add one supplier pack line (§28.3). `price` is a price set by hand, per the line's buy unit (§30.3). */
export interface AddSupplierLineInput {
  inventoryItemId: string;
  supplierItemName?: string | null;
  supplierItemCode?: string | null;
  buyUnit?: string | null;
  packSize?: string | null;
  isPreferred?: boolean;
  price?: string;
}

export interface ListItemsQuery {
  page?: number;
  perPage?: number;
  search?: string;
  type?: InventoryItemType;
  categoryId?: string;
  departmentTag?: DepartmentTag;
  includeRetired?: boolean;
  /** Only items still on placeholder units, oldest first (§29.3). */
  needsSetup?: boolean;
  /** Only Central Store items below their restock level — Store Manager only (§30.1). */
  lowOrOut?: boolean;
  /** `name` (default) or `newest` (§30.1). */
  sort?: 'name' | 'newest';
}

/**
 * `categoryName` is the create-on-the-fly path ("Pick from your list, or type
 * a new name to add it"). Exactly one of `categoryId` / `categoryName` may be
 * supplied.
 */
export interface CreateItemInput {
  name: string;
  type: InventoryItemType;
  categoryId?: string | null;
  categoryName?: string | null;
  preferredSupplierId?: string | null;
  buyUnit: string;
  usageUnit: string;
  conversionFactor?: string | null;
  packSize?: string | null;
  departmentTags: DepartmentTag[];
  /** Optional Central Store restock level, set inline from the item form. */
  centralStoreRestockLevel?: string | null;
  /** Days of cover for the suggested level; null clears it (back to 15). Store Manager only (§30.8). */
  daysOfCover?: string | null;
  /** Per buy unit, Store Manager only. Sets the item's cost per usage unit; creates no supplier line (§30.2). */
  usualPrice?: string | null;
}

export type UpdateItemInput = Partial<CreateItemInput>;

/**
 * A duplicate item name is a **warning, not an error** — the save succeeds
 * (201 create / 200 update) and the response carries this envelope either way.
 */
export interface ItemMutationResponse {
  item: InventoryItem;
  warnings: Array<{ code: 'DUPLICATE_ITEM_NAME'; message: string }>;
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  /** SUPPLIER-0001 */
  code: string;
  category: { id: string; name: string } | null;
  status: 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED';
  /** Free text; "—" when unknown. */
  address: string;
  defaultPaymentTerms: SupplierPaymentTerms;
  /**
   * AMENDMENT 2026-09-18 (Milestone Two S8): a real `Supplier` column
   * (`SupplierInvoice.dueDate` is computed from it) that no read model
   * exposed until now. Editable on the supplier form (`VU2-0`/`X6B-0`).
   */
  paymentDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListSuppliersQuery {
  page?: number;
  perPage?: number;
  search?: string;
  includeRetired?: boolean;
}

/** New purchase's quick-add: a name, and "—" as the address until the supplier page is filled in. */
export interface CreateSupplierInput {
  name: string;
  address: string;
  categoryId?: string | null;
  defaultPaymentTerms?: SupplierPaymentTerms;
  /** Optional — the backend's Prisma column default (30) applies when omitted. */
  paymentDays?: number;
  contacts?: Array<{ name: string; role: 'OTHER'; phone?: string | null; isPrimary: true }>;
}

// ─── Restock levels ─────────────────────────────────────────────────────────

export type RestockStatus = 'OUT' | 'LOW' | 'OK' | 'NO_LEVEL';

/**
 * `onHandQty` is derived live from the ledger on every read, never stored. It
 * can be negative — negative stock is allowed and flagged, never blocked.
 */
export interface RestockLevelRow {
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  /** Stocked, Raw ingredient or Prepped (§30.7). */
  itemType: InventoryItemType;
  onHandQty: string;
  level: string | null;
  isBelowLevel: boolean;
  /** `NO_LEVEL` when none is set; `OUT` when a level is set and on hand is 0 or less; `LOW` when below the level (§29.2). */
  status: RestockStatus;
  /** Average daily use × 15 days of cover (§29.5). Null with no history or no use at all. */
  suggestedLevel: string | null;
  /** `NEEDS_HISTORY`: under 14 days of use, so no suggestion yet. */
  suggestionNote: 'NEEDS_HISTORY' | null;
  /** The days of cover the suggestion used: the item's own, or "15" (§30.8). */
  daysOfCover: string;
}

/** "Whose levels" (§29.2): the Central Store, or a department at one branch. */
export type RestockScope = 'CENTRAL_STORE' | DepartmentTag;

export interface RestockScopeQuery {
  /** The older form, kept for the Department Head screens and the stock screens' Central Store id. */
  locationId?: string;
  scope?: RestockScope;
  /** Required with a department scope, rejected with `CENTRAL_STORE`. */
  branchId?: string;
}

export interface ListRestockLevelsQuery extends RestockScopeQuery {
  search?: string;
}

/**
 * Bulk upsert — both the Central Store and department restock screens are a
 * single "Save restock levels" button over many edited rows, so the write is
 * one atomic request, not one per row. `level: null` clears that item's level.
 */
export interface SaveRestockLevelsInput extends RestockScopeQuery {
  /** Stored on each change row; 200 characters at most. */
  reason?: string;
  levels: Array<{ inventoryItemId: string; level: string | null }>;
}

/** The strip above the list (§29.3). The four statuses add up to `total`. */
export interface RestockLevelsSummary {
  total: number;
  out: number;
  low: number;
  ok: number;
  noLevel: number;
  suggestionsDiffer: number;
}

/** A branch the Store Manager can pick next to a department chip (§30.6). */
export interface RestockBranchOption {
  id: string;
  name: string;
}

export interface RestockHistoryQuery extends RestockScopeQuery {
  /** One item; without it, the location's recent changes across items. */
  inventoryItemId?: string;
  limit?: number;
}

/** One change to a level (§30.5). `oldLevel` null = it was the first level; `newLevel` null = cleared. */
export interface RestockHistoryEntry {
  id: string;
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  oldLevel: string | null;
  newLevel: string | null;
  reason: string | null;
  changedBy: { id: string; name: string };
  createdAt: string;
}

// ─── Response envelopes ─────────────────────────────────────────────────────

/** Matches API_CONTRACT.md §1's standard envelope. */
export interface Paginated<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

/** The item catalog list additionally carries the KPI strip's counts. */
export interface ItemCatalogListResponse extends Paginated<InventoryItemListRow> {
  meta: ItemCatalogMeta;
}

export * from '../stock/types/stock';
export * from '../waste/department/types/waste';
export * from '../counting/types/count';
