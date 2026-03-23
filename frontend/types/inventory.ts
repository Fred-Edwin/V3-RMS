// ─── Enums ────────────────────────────────────────────────────────────────────

export const RequisitionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DISPATCHED: 'DISPATCHED',
  RECEIVED: 'RECEIVED',
  PARTIAL: 'PARTIAL',
} as const;
export type RequisitionStatus = (typeof RequisitionStatus)[keyof typeof RequisitionStatus];

export const StocktakeStation = {
  KITCHEN: 'KITCHEN',
  BARISTA: 'BARISTA',
  WAITER: 'WAITER',
} as const;
export type StocktakeStation = (typeof StocktakeStation)[keyof typeof StocktakeStation];

// ─── Suppliers ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Raw Ingredients ──────────────────────────────────────────────────────────

export interface RawIngredient {
  id: string;
  name: string;
  unit: string;
  currentStockCk: number;
  reorderThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  conversions?: IngredientConversion[];
}

// ─── Ingredient Conversions ───────────────────────────────────────────────────

export interface IngredientConversion {
  id: string;
  menuItemId: string;
  ingredientId: string;
  quantityPerPortion: number;
  createdAt: string;
  updatedAt: string;
  menuItem?: { id: string; name: string };
  ingredient?: RawIngredient;
}

// ─── Supplier Deliveries ──────────────────────────────────────────────────────

export interface SupplierDelivery {
  id: string;
  ingredientId: string;
  supplierId: string;
  quantity: number;
  deliveredAt: string;
  loggedById: string;
  notes: string | null;
  createdAt: string;
  ingredient?: { id: string; name: string; unit: string };
  supplier?: { id: string; name: string };
  loggedBy?: { id: string; name: string };
}

// ─── Requisitions ─────────────────────────────────────────────────────────────

export interface RequisitionItem {
  id: string;
  requisitionId: string;
  menuItemId: string;
  requestedQty: number;
  dispatchedQty: number | null;
  receivedQty: number | null;
  hasDiscrepancy: boolean;
  menuItem?: { id: string; name: string };
}

export interface RequisitionItemWithCapacity extends RequisitionItem {
  canFulfilQty: number;
}

export interface Requisition {
  id: string;
  organizationId: string;
  submittedById: string;
  status: RequisitionStatus;
  notes: string | null;
  isMidDay: boolean;
  submittedAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: RequisitionItem[];
  organization?: { id: string; name: string };
  submittedBy?: { id: string; name: string };
}

export interface RequisitionWithCapacity extends Omit<Requisition, 'items'> {
  items: RequisitionItemWithCapacity[];
}

// ─── Branch Stock ─────────────────────────────────────────────────────────────

// Flat shape returned by GET /inventory/stock/branch/all-items — all menu items
// with current stock qty (0 for items not yet in BranchStock). Used by stocktake form.
export interface MenuItemStocktakeRow {
  menuItemId: string;
  name: string;
  currentQty: number;
  lowStockThreshold: number;
  category: { name: string; prepStation: 'KITCHEN' | 'BARISTA' | 'BOTH' };
}

export interface BranchStockItem {
  id: string;
  organizationId: string;
  menuItemId: string;
  currentQty: number;
  lowStockThreshold: number;
  updatedAt: string;
  menuItem?: { id: string; name: string; category?: { prepStation: 'KITCHEN' | 'BARISTA' | 'BOTH' } };
}

// ─── Consumables ──────────────────────────────────────────────────────────────

export interface Consumable {
  id: string;
  name: string;
  unit: string;
  station: StocktakeStation;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumableStock {
  id: string;
  organizationId: string;
  consumableId: string;
  currentQty: number;
  updatedAt: string;
  consumable?: Consumable;
}

// ─── Stocktake ────────────────────────────────────────────────────────────────

export interface StocktakeEntry {
  id: string;
  sessionId: string;
  station: StocktakeStation;
  menuItemId: string | null;
  consumableId: string | null;
  expectedQty: number;
  actualQty: number;
  variance: number;
  note: string | null;
  createdAt: string;
  menuItem?: { id: string; name: string };
}

export interface StocktakeSession {
  id: string;
  organizationId: string;
  conductedById: string;
  date: string;
  completedAt: string | null;
  createdAt: string;
  entries: StocktakeEntry[];
  conductedBy?: { id: string; name: string };
}

// ─── Inventory Overview ───────────────────────────────────────────────────────

export interface BranchInventorySummary {
  branch: { id: string; name: string };
  requisitionCount: number;
  statuses: RequisitionStatus[];
  discrepancyCount: number;
}

export interface InventoryOverview {
  branches: BranchInventorySummary[];
  ingredients: RawIngredient[];
  belowThreshold: RawIngredient[];
}

// ─── API request payloads ─────────────────────────────────────────────────────

export interface CreateRequisitionPayload {
  notes?: string;
  isMidDay?: boolean;
  items: Array<{ menuItemId: string; requestedQty: number }>;
}

export interface DispatchRequisitionPayload {
  items: Array<{ requisitionItemId: string; dispatchedQty: number }>;
}

export interface ReceiveRequisitionPayload {
  items: Array<{ requisitionItemId: string; receivedQty: number }>;
}

export interface SubmitStocktakePayload {
  date: string;
  entries: Array<{
    station: StocktakeStation;
    menuItemId?: string;
    consumableId?: string;
    expectedQty: number;
    actualQty: number;
    note?: string;
  }>;
}

export interface StocktakeVariancePayload {
  organizationId: string;
  sessionId: string;
  highVarianceItems: Array<{ name: string; variance: number; expectedQty: number }>;
}

export interface DiscrepancyEntry {
  id: string;
  requisitionId: string;
  menuItemId: string;
  requestedQty: number;
  dispatchedQty: number | null;
  receivedQty: number | null;
  hasDiscrepancy: boolean;
  createdAt: string;
  updatedAt: string;
  menuItem: { id: string; name: string };
  requisition: {
    id: string;
    organizationId: string;
    submittedAt: string;
    organization: { id: string; name: string };
  };
}

// Extends StocktakeSession with cross-org organization field (DIRECTOR view)
export interface AllStocktakeSession extends StocktakeSession {
  organization: { id: string; name: string };
}
