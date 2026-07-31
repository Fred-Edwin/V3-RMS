import { apiClient } from '@/lib/apiClient';
import type {
  AssignSupplierItemInput,
  CountDiscrepancyLine,
  CreateInventoryItemInput,
  CreatePrepRecipeInput,
  CreatePrepRecordInput,
  CreatePurchaseOrderInput,
  CreateStockCountInput,
  CreateSupplierInput,
  CreateSupplierInvoiceInput,
  CreateWasteLogInput,
  InventoryItem,
  InventoryLocation,
  InventoryTransaction,
  LowStockAlertLine,
  PrepRecipe,
  PrepRecord,
  PriceHistoryLine,
  PrepYieldReport,
  PromotePrepRecipeInput,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderSuggestion,
  RecordSupplierPaymentInput,
  RollingAverage,
  StockCount,
  StockValuationReport,
  SubmitStockCountInput,
  Supplier,
  SupplierApAgingReport,
  SupplierInvoice,
  SupplierInvoiceStatus,
  SupplierItem,
  SupplierWithItemCount,
  TrueCostPerPreppedItemLine,
  UpdateInventoryItemInput,
  UpdatePrepRecipeInput,
  UpdateSupplierInput,
  WasteLog,
  WasteReason,
} from '@/types/inventory';

// ─── Locations ─────────────────────────────────────────────────────────────
// Phase 1 has exactly one Location per organization (type CENTRAL_STORE) —
// every other inventory call needs its id, so this is resolved once and
// reused rather than re-fetched per screen.

export async function listLocations(token: string): Promise<InventoryLocation[]> {
  return apiClient.get<InventoryLocation[]>('/locations', token);
}

export async function getCentralStoreLocation(token: string): Promise<InventoryLocation | null> {
  const locations = await listLocations(token);
  return locations.find((l) => l.type === 'CENTRAL_STORE') ?? null;
}

// One-time setup, SYSTEM_ADMIN only. The backend resolves the owning
// organization to the hub org itself — no organization is sent from here.
export async function createCentralStoreLocation(
  token: string,
  name?: string,
): Promise<InventoryLocation> {
  return apiClient.post<InventoryLocation>('/locations/central-store', name ? { name } : {}, token);
}

// ─── Inventory Items ───────────────────────────────────────────────────────

export async function listInventoryItems(
  token: string,
  params: { locationId?: string; isActive?: boolean } = {},
): Promise<InventoryItem[]> {
  const query = new URLSearchParams();
  if (params.locationId) query.set('locationId', params.locationId);
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive));
  const qs = query.toString();
  return apiClient.get<InventoryItem[]>(`/inventory-items${qs ? `?${qs}` : ''}`, token);
}

export async function getInventoryItem(id: string, token: string): Promise<InventoryItem> {
  return apiClient.get<InventoryItem>(`/inventory-items/${id}`, token);
}

export async function createInventoryItem(
  input: CreateInventoryItemInput,
  token: string,
): Promise<InventoryItem> {
  return apiClient.post<InventoryItem>('/inventory-items', input, token);
}

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
  token: string,
): Promise<InventoryItem> {
  return apiClient.patch<InventoryItem>(`/inventory-items/${id}`, input, token);
}

export async function deactivateInventoryItem(id: string, token: string): Promise<InventoryItem> {
  return apiClient.delete<InventoryItem>(`/inventory-items/${id}`, token);
}

/** Manual cost override — Manager-only. `newBuyUnitCost` is entered in buy-unit terms
 * (e.g. Ksh 350 per pouch); the backend converts to a per-usage-unit currentCost. Posts
 * an auditable zero-qty ADJUSTMENT transaction carrying the reason, not a silent overwrite. */
export async function adjustInventoryItemCost(
  id: string,
  input: { newBuyUnitCost: string; reason: string; locationId: string },
  token: string,
): Promise<InventoryItem> {
  return apiClient.post<InventoryItem>(`/inventory-items/${id}/adjust-cost`, input, token);
}

/** Movement history (full ledger slice) for one item at one location — Stock on Hand's side panel. */
export async function getInventoryItemTransactions(
  id: string,
  locationId: string,
  token: string,
): Promise<InventoryTransaction[]> {
  return apiClient.get<InventoryTransaction[]>(
    `/inventory-items/${id}/transactions?locationId=${locationId}`,
    token,
  );
}

export async function getInventoryItemSuppliers(id: string, token: string): Promise<SupplierItem[]> {
  return apiClient.get<SupplierItem[]>(`/inventory-items/${id}/suppliers`, token);
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function listSuppliers(token: string, isActive?: boolean): Promise<SupplierWithItemCount[]> {
  const qs = isActive === undefined ? '' : `?isActive=${isActive}`;
  return apiClient.get<SupplierWithItemCount[]>(`/suppliers${qs}`, token);
}

export async function getSupplier(id: string, token: string): Promise<Supplier> {
  return apiClient.get<Supplier>(`/suppliers/${id}`, token);
}

export async function createSupplier(input: CreateSupplierInput, token: string): Promise<Supplier> {
  return apiClient.post<Supplier>('/suppliers', input, token);
}

export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput,
  token: string,
): Promise<Supplier> {
  return apiClient.patch<Supplier>(`/suppliers/${id}`, input, token);
}

export async function deactivateSupplier(id: string, token: string): Promise<Supplier> {
  return apiClient.delete<Supplier>(`/suppliers/${id}`, token);
}

export async function getSupplierItems(supplierId: string, token: string): Promise<SupplierItem[]> {
  return apiClient.get<SupplierItem[]>(`/suppliers/${supplierId}/items`, token);
}

export async function assignSupplierItem(
  supplierId: string,
  input: AssignSupplierItemInput,
  token: string,
): Promise<SupplierItem> {
  return apiClient.post<SupplierItem>(`/suppliers/${supplierId}/items`, input, token);
}

export async function removeSupplierItem(
  supplierId: string,
  itemId: string,
  token: string,
): Promise<void> {
  await apiClient.delete(`/suppliers/${supplierId}/items/${itemId}`, token);
}

// ─── Purchase Orders ────────────────────────────────────────────────────────

export async function listPurchaseOrders(
  token: string,
  status?: PurchaseOrderStatus,
): Promise<PurchaseOrder[]> {
  const qs = status ? `?status=${status}` : '';
  return apiClient.get<PurchaseOrder[]>(`/purchase-orders${qs}`, token);
}

export async function getPurchaseOrder(id: string, token: string): Promise<PurchaseOrder> {
  return apiClient.get<PurchaseOrder>(`/purchase-orders/${id}`, token);
}

/** Creates a DRAFT purchase order. Both STORE_MANAGER and STORE_ATTENDANT can
 * call this — only STORE_MANAGER can subsequently send it (no send/cancel
 * function is exposed from this service on purpose; Attendant's screens must
 * never render or wire a send action). */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  token: string,
): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>('/purchase-orders', input, token);
}

/** Receiving: one call per PO line, per §8.1 row 7 / §8.2 screen 3's tap-per-line flow. */
export async function receivePurchaseOrderLine(
  purchaseOrderId: string,
  lineId: string,
  input: { receivedQty: string; invoicePrice: string },
  token: string,
): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>(
    `/purchase-orders/${purchaseOrderId}/lines/${lineId}/receive`,
    input,
    token,
  );
}

/** Edit a DRAFT PO's lines — Manager-only. Rejected by the backend once the order has left DRAFT. */
export async function updatePurchaseOrderLines(
  id: string,
  lines: CreatePurchaseOrderInput['lines'],
  token: string,
): Promise<PurchaseOrder> {
  return apiClient.patch<PurchaseOrder>(`/purchase-orders/${id}/lines`, { lines }, token);
}

/** Send a DRAFT PO to the supplier — Manager-only (§8.3). */
export async function sendPurchaseOrder(id: string, token: string): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/send`, {}, token);
}

/** Pull a SENT PO back to DRAFT — Manager-only. Rejected once any line has been received. */
export async function unsendPurchaseOrder(id: string, token: string): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/unsend`, {}, token);
}

/** Cancel a PO — Manager-only (§8.3). */
export async function cancelPurchaseOrder(id: string, token: string): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, {}, token);
}

/** Reverse a mistaken receiving confirm on one line — Manager-only. Posts an offsetting ledger adjustment. */
export async function reversePurchaseOrderLineReceipt(
  purchaseOrderId: string,
  lineId: string,
  token: string,
): Promise<PurchaseOrder> {
  return apiClient.post<PurchaseOrder>(
    `/purchase-orders/${purchaseOrderId}/lines/${lineId}/reverse-receipt`,
    {},
    token,
  );
}

/** Low-stock-driven prefill suggestion for a new PO — targets 2x reorder level. */
export async function suggestPurchaseOrder(
  locationId: string,
  token: string,
): Promise<PurchaseOrderSuggestion[]> {
  return apiClient.get(`/purchase-orders/suggest?locationId=${locationId}`, token);
}

// ─── Prep Records ───────────────────────────────────────────────────────────

export async function createPrepRecord(input: CreatePrepRecordInput, token: string): Promise<PrepRecord> {
  return apiClient.post<PrepRecord>('/prep-records', input, token);
}

export async function listPrepRecords(
  token: string,
  params: { outputItemId?: string; locationId?: string } = {},
): Promise<PrepRecord[]> {
  const query = new URLSearchParams();
  if (params.outputItemId) query.set('outputItemId', params.outputItemId);
  if (params.locationId) query.set('locationId', params.locationId);
  const qs = query.toString();
  return apiClient.get<PrepRecord[]>(`/prep-records${qs ? `?${qs}` : ''}`, token);
}

export async function getPrepRecord(id: string, token: string): Promise<PrepRecord> {
  return apiClient.get<PrepRecord>(`/prep-records/${id}`, token);
}

/** Rolling-average soft-reference hint (D-12) — informational only, never a validation gate. */
export async function getPrepRollingAverage(outputItemId: string, token: string): Promise<RollingAverage> {
  return apiClient.get<RollingAverage>(`/prep-records/rolling-average?outputItemId=${outputItemId}`, token);
}

// ─── Prep Recipes (optional, Manager-only "promote" target) ────────────────

export async function listPrepRecipes(token: string): Promise<PrepRecipe[]> {
  return apiClient.get<PrepRecipe[]>('/prep-recipes', token);
}

export async function getPrepRecipe(id: string, token: string): Promise<PrepRecipe> {
  return apiClient.get<PrepRecipe>(`/prep-recipes/${id}`, token);
}

/** Promotes a Prep Record into a saved PrepRecipe — Manager-only (§8.3). */
export async function promotePrepRecordToRecipe(
  prepRecordId: string,
  input: PromotePrepRecipeInput,
  token: string,
): Promise<PrepRecipe> {
  return apiClient.post<PrepRecipe>(`/prep-records/${prepRecordId}/promote`, input, token);
}

/** Recipe for a given output item, or null if none exists — Log Prep's pre-fill lookup. */
export async function getPrepRecipeByOutputItem(
  outputItemId: string,
  token: string,
): Promise<PrepRecipe | null> {
  return apiClient.get<PrepRecipe | null>(`/prep-recipes/by-output?outputItemId=${outputItemId}`, token);
}

/**
 * Directly authors a Prep Recipe — Manager-only. Creates the output
 * InventoryItem (type PREPPED) and the recipe together (D-12 reopened —
 * see UI_UX_DESIGN_AUDIT.md Flow 3).
 */
export async function createPrepRecipe(input: CreatePrepRecipeInput, token: string): Promise<PrepRecipe> {
  return apiClient.post<PrepRecipe>('/prep-recipes', input, token);
}

/** Edits a recipe's own fields/lines — Manager-only. Never touches past PrepRecords. */
export async function updatePrepRecipe(
  id: string,
  input: UpdatePrepRecipeInput,
  token: string,
): Promise<PrepRecipe> {
  return apiClient.patch<PrepRecipe>(`/prep-recipes/${id}`, input, token);
}

// ─── Stock Counts ───────────────────────────────────────────────────────────

export async function listStockCounts(
  token: string,
  params: { locationId?: string; status?: string } = {},
): Promise<StockCount[]> {
  const query = new URLSearchParams();
  if (params.locationId) query.set('locationId', params.locationId);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiClient.get<StockCount[]>(`/stock-counts${qs ? `?${qs}` : ''}`, token);
}

export async function getStockCount(id: string, token: string): Promise<StockCount> {
  return apiClient.get<StockCount>(`/stock-counts/${id}`, token);
}

/** Session creation — either role, at any time (revised 2026-07-30). */
export async function createStockCount(input: CreateStockCountInput, token: string): Promise<StockCount> {
  return apiClient.post<StockCount>('/stock-counts', input, token);
}

/** Submits ALL counted lines in one call — see Stock Count execution screen
 * for why this is invoked once, on final Submit, not per-line like Receiving. */
export async function submitStockCount(
  id: string,
  input: SubmitStockCountInput,
  token: string,
): Promise<StockCount> {
  return apiClient.post<StockCount>(`/stock-counts/${id}/submit`, input, token);
}

/** Approve — posts adjustment transactions, Manager-only (§8.3). */
export async function approveStockCount(id: string, token: string): Promise<StockCount> {
  return apiClient.post<StockCount>(`/stock-counts/${id}/approve`, {}, token);
}

/** Correct counted quantities on a SUBMITTED session before approving — Manager-only, added 2026-07-30. */
export async function correctStockCountLines(
  id: string,
  input: SubmitStockCountInput,
  token: string,
): Promise<StockCount> {
  return apiClient.patch<StockCount>(`/stock-counts/${id}/lines`, input, token);
}

// ─── Waste Log ──────────────────────────────────────────────────────────────

export async function createWasteLog(input: CreateWasteLogInput, token: string): Promise<WasteLog> {
  return apiClient.post<WasteLog>('/waste-logs', input, token);
}

export async function listWasteLogs(
  token: string,
  params: { locationId?: string; reason?: WasteReason } = {},
): Promise<WasteLog[]> {
  const query = new URLSearchParams();
  if (params.locationId) query.set('locationId', params.locationId);
  if (params.reason) query.set('reason', params.reason);
  const qs = query.toString();
  return apiClient.get<WasteLog[]>(`/waste-logs${qs ? `?${qs}` : ''}`, token);
}

// ─── Supplier Invoices / AP (Manager-only — D-13, §4a) ─────────────────────

export async function listSupplierInvoices(
  token: string,
  params: { supplierId?: string; status?: SupplierInvoiceStatus } = {},
): Promise<SupplierInvoice[]> {
  const query = new URLSearchParams();
  if (params.supplierId) query.set('supplierId', params.supplierId);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiClient.get<SupplierInvoice[]>(`/supplier-invoices${qs ? `?${qs}` : ''}`, token);
}

export async function getSupplierInvoice(id: string, token: string): Promise<SupplierInvoice> {
  return apiClient.get<SupplierInvoice>(`/supplier-invoices/${id}`, token);
}

export async function createSupplierInvoice(
  input: CreateSupplierInvoiceInput,
  token: string,
): Promise<SupplierInvoice> {
  return apiClient.post<SupplierInvoice>('/supplier-invoices', input, token);
}

export async function recordSupplierPayment(
  invoiceId: string,
  input: RecordSupplierPaymentInput,
  token: string,
): Promise<SupplierInvoice> {
  return apiClient.post<SupplierInvoice>(`/supplier-invoices/${invoiceId}/payments`, input, token);
}

// ─── Reports (Manager-only — §4/§8.3) ──────────────────────────────────────

export async function getStockValuationReport(
  locationId: string,
  token: string,
): Promise<StockValuationReport> {
  return apiClient.get<StockValuationReport>(
    `/inventory-reports/stock-valuation?locationId=${locationId}`,
    token,
  );
}

export async function getLowStockAlertsReport(
  locationId: string,
  token: string,
): Promise<LowStockAlertLine[]> {
  return apiClient.get<LowStockAlertLine[]>(
    `/inventory-reports/low-stock-alerts?locationId=${locationId}`,
    token,
  );
}

export async function getSupplierApAgingReport(token: string): Promise<SupplierApAgingReport> {
  return apiClient.get<SupplierApAgingReport>('/inventory-reports/supplier-ap-aging', token);
}

export async function getPriceHistoryReport(
  inventoryItemId: string,
  token: string,
  supplierId?: string,
): Promise<PriceHistoryLine[]> {
  const qs = new URLSearchParams({ inventoryItemId, ...(supplierId ? { supplierId } : {}) });
  return apiClient.get<PriceHistoryLine[]>(`/inventory-reports/price-history?${qs.toString()}`, token);
}

export async function getPrepYieldReport(
  token: string,
  outputItemId?: string,
): Promise<PrepYieldReport | PrepYieldReport[]> {
  const qs = outputItemId ? `?outputItemId=${outputItemId}` : '';
  return apiClient.get<PrepYieldReport | PrepYieldReport[]>(`/inventory-reports/prep-yield${qs}`, token);
}

export async function getCountDiscrepancyReport(
  token: string,
  params: { locationId?: string; stockCountId?: string } = {},
): Promise<CountDiscrepancyLine[]> {
  const query = new URLSearchParams();
  if (params.locationId) query.set('locationId', params.locationId);
  if (params.stockCountId) query.set('stockCountId', params.stockCountId);
  const qs = query.toString();
  return apiClient.get<CountDiscrepancyLine[]>(`/inventory-reports/count-discrepancy${qs ? `?${qs}` : ''}`, token);
}

export async function getTrueCostPerPreppedItemReport(token: string): Promise<TrueCostPerPreppedItemLine[]> {
  return apiClient.get<TrueCostPerPreppedItemLine[]>('/inventory-reports/prepped-item-cost', token);
}
