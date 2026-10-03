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
}

/** Why a search matched when it was a supplier's code or name rather than ours (§28.5). */
export interface ItemMatchedOn {
  supplier: { id: string; name: string };
  field: 'supplierItemCode' | 'supplierItemName';
  value: string;
}

/**
 * A catalog list row. For a Store Attendant the four money / ordering fields
 * (`currentCost`, `centralStoreRestockLevel`, `preferredSupplier`,
 * `preferredSupplierId`) are absent at runtime (§29.4) even though this type
 * declares them; screens that render them must be Store-Manager-only.
 */
export interface InventoryItemListRow extends InventoryItem {
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
  isPreferred: boolean;
  /** Seeding marked this line preferred; shows "Preferred · confirm" until confirmed. */
  preferredNeedsConfirm: boolean;
}

/** `GET /inventory/items/:id` — the item plus who sells it. */
export interface InventoryItemDetail extends InventoryItem {
  suppliers: ItemSupplierLine[];
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

/** Add one supplier pack line (§28.3). The backend takes no price here: prices come from signed receipts. */
export interface AddSupplierLineInput {
  inventoryItemId: string;
  supplierItemName?: string | null;
  supplierItemCode?: string | null;
  buyUnit?: string | null;
  packSize?: string | null;
  isPreferred?: boolean;
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
  contactName: string | null;
  category: { id: string; name: string } | null;
  phone: string | null;
  email: string | null;
  /** Free text, e.g. "Nyeri town" — shown on the supplier detail header. */
  location: string | null;
  defaultPaymentTerms: SupplierPaymentTerms;
  /**
   * AMENDMENT 2026-09-18 (Milestone Two S8): a real `Supplier` column
   * (`SupplierInvoice.dueDate` is computed from it) that no read model
   * exposed until now. Editable on the supplier form (`VU2-0`/`X6B-0`).
   */
  paymentDays: number;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListSuppliersQuery {
  page?: number;
  perPage?: number;
  search?: string;
  includeRetired?: boolean;
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string | null;
  categoryId?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  defaultPaymentTerms?: SupplierPaymentTerms;
  /** Optional — the backend's Prisma column default (30) applies when omitted. */
  paymentDays?: number;
}

/**
 * Every field genuinely optional — omitting `defaultPaymentTerms` from a
 * PATCH must never change it. Do not derive this from `CreateSupplierInput`
 * with every field made optional plus a default; the backend schema was
 * deliberately rewritten (2026-09-15) to avoid exactly that trap. Only send
 * `defaultPaymentTerms` when the user actually edits the payment-terms toggle.
 */
export interface UpdateSupplierInput {
  name?: string;
  contactName?: string | null;
  categoryId?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  defaultPaymentTerms?: SupplierPaymentTerms;
  paymentDays?: number;
}

// ─── Restock levels ─────────────────────────────────────────────────────────

/**
 * `onHandQty` is derived live from the ledger on every read, never stored. It
 * can be negative — negative stock is allowed and flagged, never blocked.
 */
export interface RestockLevelRow {
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  onHandQty: string;
  level: string | null;
  isBelowLevel: boolean;
}

export interface ListRestockLevelsQuery {
  /**
   * Store Manager passes the Central Store location explicitly. A Department
   * Head omits it — the server resolves their own department and rejects any
   * other location with 403.
   */
  locationId?: string;
  search?: string;
}

/**
 * Bulk upsert — both the Central Store and department restock screens are a
 * single "Save restock levels" button over many edited rows, so the write is
 * one atomic request, not one per row. `level: null` clears that item's level.
 */
export interface SaveRestockLevelsInput {
  locationId?: string;
  levels: Array<{ inventoryItemId: string; level: string | null }>;
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

// ─── Milestone Two — Receiving & Supplier AP ───────────────────────────────
// Kept in its own file (./receiving.ts) since it's a separate milestone's
// contract, re-exported here so `features/inventory` (this module's public
// entry) exposes both milestones' types from one place.
export * from './receiving';

// ─── Milestone Three — Prep ────────────────────────────────────────────────
export * from './prep';
export * from './stock';
export * from './waste';
export * from './count';
