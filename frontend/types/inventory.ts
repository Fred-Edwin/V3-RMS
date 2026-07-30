// Phase 1 (Central Store) inventory types. Quantities/prices are decimal
// strings on the wire (backend uses Prisma.Decimal) — never coerce to
// number for storage/transport, only for display formatting.

export type InventoryItemType = 'RAW' | 'PREPPED' | 'PASS_THROUGH';

export type DepartmentTag = 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING';

export interface InventoryItem {
  id: string;
  organizationId: string;
  name: string;
  type: InventoryItemType;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string;
  reorderLevel: string;
  departmentTags: DepartmentTag[];
  currentCost: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Only present when the caller passed `locationId` (e.g. Stock on Hand). */
  onHandQty?: string;
  /** Unit cost from the most recent RECEIVE transaction, distinct from currentCost's weighted average. Only present when the caller passed `locationId`. */
  lastReceivedUnitCost?: string;
}

export type LocationType = 'CENTRAL_STORE' | 'BRANCH_DEPARTMENT';

export interface InventoryLocation {
  id: string;
  organizationId: string;
  type: LocationType;
  name: string;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

/** `GET /suppliers` attaches a supplierItems count; detail views don't need it. */
export interface SupplierWithItemCount extends Supplier {
  _count: { supplierItems: number };
}

export interface SupplierItem {
  id: string;
  organizationId: string;
  supplierId: string;
  inventoryItemId: string;
  isDefault: boolean;
  lastPrice: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only present on `GET /suppliers/:id/items` — {id, name}. */
  inventoryItem?: { id: string; name: string };
  /** Only present on `GET /inventory-items/:id/suppliers` — {id, name}. */
  supplier?: { id: string; name: string };
}

export interface CreateInventoryItemInput {
  name: string;
  type: InventoryItemType;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string;
  reorderLevel: string;
  departmentTags: DepartmentTag[];
  defaultSupplierId?: string;
}

export type UpdateInventoryItemInput = Partial<Omit<CreateInventoryItemInput, 'defaultSupplierId'>> & {
  isActive?: boolean;
};

export interface CreateSupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput> & { isActive?: boolean };

export interface AssignSupplierItemInput {
  inventoryItemId: string;
  isDefault?: boolean;
  lastPrice?: string;
}

/** The full ledger slice for one item at one location — Stock on Hand's side-panel drill-in. */
export type InventoryTransactionType =
  | 'RECEIVE'
  | 'PREP_CONSUME'
  | 'PREP_PRODUCE'
  | 'WASTE'
  | 'ADJUSTMENT'
  | 'DISPATCH_OUT'
  | 'DISPATCH_IN'
  | 'MARKET_RECEIVE'
  | 'SALE';

export interface InventoryTransaction {
  id: string;
  organizationId: string;
  locationId: string;
  inventoryItemId: string;
  type: InventoryTransactionType;
  quantity: string;
  unitCost: string;
  reason: string | null;
  purchaseOrderLineId: string | null;
  prepRecordId: string | null;
  wasteLogId: string | null;
  stockCountLineId: string | null;
  userId: string;
  createdAt: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'CLOSED' | 'CANCELLED';

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  orderedQty: string;
  receivedQty: string;
  unitPrice: string;
  invoicePrice: string | null;
  receivedAt: string | null;
  /** Backend only includes this subset on the nested relation
   * (purchase-order-repository.ts's detailInclude) — not the full InventoryItem.
   * currentCost/conversionFactor let the UI flag a stale line price against
   * the item's current buy-unit cost. */
  inventoryItem: { id: string; name: string; buyUnit: string; currentCost: string; conversionFactor: string };
}

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  supplierId: string;
  locationId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  createdById: string;
  sentAt: string | null;
  cancelledAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: Supplier;
  lines: PurchaseOrderLine[];
}

export interface CreatePurchaseOrderLineInput {
  inventoryItemId: string;
  orderedQty: string;
  unitPrice: string;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  locationId: string;
  lines: CreatePurchaseOrderLineInput[];
}

// ─── Prep Records ───────────────────────────────────────────────────────────

export interface PrepRecordLine {
  id: string;
  prepRecordId: string;
  inputItemId: string;
  quantity: string;
  unitCost: string;
  inputItem: InventoryItem;
}

export interface PrepRecord {
  id: string;
  organizationId: string;
  locationId: string;
  outputItemId: string;
  actualYield: string;
  unitCost: string;
  recordedById: string;
  recordedAt: string;
  outputItem: InventoryItem;
  lines: PrepRecordLine[];
}

export interface CreatePrepRecordInput {
  locationId: string;
  outputItemId: string;
  actualYield: string;
  inputs: { inventoryItemId: string; quantity: string }[];
}

export interface RollingAverage {
  sampleCount: number;
  avgTotalInputQty: string | null;
  avgActualYield: string | null;
}

// ─── Prep Recipes (optional, Manager-only "promote" target) ────────────────

export interface PrepRecipeLine {
  id: string;
  inputItemId: string;
  quantity: string;
  inputItem: { id: string; name: string };
}

export interface PrepRecipe {
  id: string;
  organizationId: string;
  outputItemId: string;
  name: string;
  expectedYield: string;
  batchLabel: string | null;
  instructions: string | null;
  promotedFromId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  outputItem: { id: string; name: string };
  lines: PrepRecipeLine[];
}

export interface PromotePrepRecipeInput {
  name: string;
  expectedYield?: string;
  batchLabel?: string;
  instructions?: string;
}

// ─── Stock Counts ───────────────────────────────────────────────────────────
// expectedQty/gapQty are absent entirely (not null) in an Attendant-role
// response — D-14, enforced server-side. Model them as optional here rather
// than `| null`, since "the key may not exist" is the real contract.

export type StockCountStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED';

export interface StockCountLine {
  id: string;
  stockCountId: string;
  inventoryItemId: string;
  sequence: number;
  expectedQty?: string;
  countedQty: string | null;
  gapQty?: string;
  inventoryItem: { id: string; name: string; usageUnit: string };
}

export interface StockCount {
  id: string;
  organizationId: string;
  locationId: string;
  label: string;
  status: StockCountStatus;
  scheduledDate: string;
  createdById: string;
  submittedById: string | null;
  submittedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  lines: StockCountLine[];
}

export interface SubmitStockCountInput {
  lines: { lineId: string; countedQty: string }[];
}

/** Session creation — Manager-only (§8.3). */
export interface CreateStockCountInput {
  locationId: string;
  label: string;
  scheduledDate: string;
  inventoryItemIds: string[];
}

// ─── Waste Log ──────────────────────────────────────────────────────────────

export type WasteReason = 'SPOILED' | 'PREP_ERROR' | 'DROPPED' | 'EXPIRED' | 'OTHER';

export interface WasteLog {
  id: string;
  organizationId: string;
  locationId: string;
  inventoryItemId: string;
  quantity: string;
  reason: WasteReason;
  note: string | null;
  loggedById: string;
  loggedAt: string;
  inventoryItem: InventoryItem;
}

export interface CreateWasteLogInput {
  locationId: string;
  inventoryItemId: string;
  quantity: string;
  reason: WasteReason;
  note?: string;
}

// ─── Supplier Invoices / AP (D-13, §4a) ─────────────────────────────────────
// Manager-only — STORE_ATTENDANT has zero access to any of this, not even read.

export type SupplierInvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export type SupplierPaymentMethod =
  | 'MPESA'
  | 'CASH'
  | 'CARD'
  | 'SPLIT'
  | 'GUEST_SPLIT'
  | 'HOUSE_ACCOUNT'
  | 'CORPORATE_ACCOUNT'
  | 'CUSTOMER_CREDIT';

export interface SupplierPayment {
  id: string;
  organizationId: string;
  supplierInvoiceId: string;
  amount: string;
  method: SupplierPaymentMethod;
  paidAt: string;
  recordedById: string;
  createdAt: string;
}

export interface SupplierInvoice {
  id: string;
  organizationId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  referenceNumber: string;
  amount: string;
  amountPaid: string;
  status: SupplierInvoiceStatus;
  invoiceDate: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  /** Only {id, name} — backend does not include the full Supplier relation here. */
  supplier: { id: string; name: string };
  payments: SupplierPayment[];
}

export interface CreateSupplierInvoiceInput {
  supplierId: string;
  purchaseOrderId?: string;
  referenceNumber: string;
  amount: string;
  invoiceDate: string;
}

export interface RecordSupplierPaymentInput {
  amount: string;
  method: SupplierPaymentMethod;
  paidAt: string;
}

// ─── Reports (Manager-only, §4/§8.3) ────────────────────────────────────────

export interface StockValuationLine {
  inventoryItemId: string;
  name: string;
  type: InventoryItemType;
  usageUnit: string;
  onHandQty: string;
  currentCost: string;
  value: string;
}

export interface StockValuationReport {
  locationId: string;
  lines: StockValuationLine[];
  totalValue: string;
}

export interface LowStockAlertLine {
  inventoryItemId: string;
  name: string;
  onHandQty: string;
  reorderLevel: string;
  usageUnit: string;
}

export interface SupplierApAgingLine {
  supplierInvoiceId: string;
  supplierId: string;
  supplierName: string;
  referenceNumber: string;
  amount: string;
  amountPaid: string;
  outstanding: string;
  status: SupplierInvoiceStatus;
  invoiceDate: string;
  daysOutstanding: number;
  bucket: '0-7' | '8-30' | '31+';
}

export interface SupplierApAgingReport {
  lines: SupplierApAgingLine[];
  bySupplier: { supplierId: string; supplierName: string; totalOutstanding: string }[];
}

export interface PriceHistoryLine {
  purchaseOrderLineId: string;
  /** Null for ad-hoc ledger receives with no linked PO (no supplier to attribute). */
  poNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  unitPrice: string;
  invoicePrice: string | null;
  receivedQty: string;
  receivedAt: string | null;
}

export interface PrepYieldRun {
  prepRecordId: string;
  recordedAt: string;
  recordedById: string;
  totalInputQty: string;
  actualYield: string;
  unitCost: string;
  yieldRatio: string | null;
}

export interface PrepYieldReport {
  outputItemId: string;
  outputItemName?: string;
  runs: PrepYieldRun[];
  rollingAverage: RollingAverage;
}

export interface CountDiscrepancyLine {
  stockCountLineId: string;
  stockCountId: string;
  stockCountLabel: string;
  locationId: string;
  scheduledDate: string;
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  expectedQty: string;
  countedQty: string | null;
  gapQty: string;
  gapValue: string;
}

export interface TrueCostPerPreppedItemLine {
  outputItemId: string;
  outputItemName: string;
  usageUnit: string;
  mostRecentUnitCost: string | null;
  mostRecentRecordedAt: string | null;
  avgUnitCost: string | null;
  sampleCount: number;
}
