import { apiClient } from '@/lib/apiClient';
import type {
  Supplier,
  RawIngredient,
  IngredientConversion,
  SupplierDelivery,
  Requisition,
  RequisitionWithCapacity,
  BranchStockItem,
  MenuItemStocktakeRow,
  StocktakeSession,
  InventoryOverview,
  StocktakeEntry,
  CreateRequisitionPayload,
  DispatchRequisitionPayload,
  ReceiveRequisitionPayload,
  SubmitStocktakePayload,
  DiscrepancyEntry,
  AllStocktakeSession,
} from '@/types/inventory';

const BASE = '/inventory';

export const inventoryService = {
  // ─── Suppliers ─────────────────────────────────────────────────────────────

  getSuppliers: (token: string) =>
    apiClient.get<Supplier[]>(`${BASE}/suppliers`, token),

  createSupplier: (
    data: { name: string; phone?: string; email?: string },
    token: string,
  ) => apiClient.post<Supplier>(`${BASE}/suppliers`, data, token),

  updateSupplier: (id: string, data: Partial<Supplier>, token: string) =>
    apiClient.patch<Supplier>(`${BASE}/suppliers/${id}`, data, token),

  // ─── Raw Ingredients ───────────────────────────────────────────────────────

  getIngredients: (token: string) =>
    apiClient.get<RawIngredient[]>(`${BASE}/ingredients`, token),

  createIngredient: (
    data: { name: string; unit: string; reorderThreshold: number },
    token: string,
  ) => apiClient.post<RawIngredient>(`${BASE}/ingredients`, data, token),

  updateIngredient: (
    id: string,
    data: Partial<RawIngredient>,
    token: string,
  ) => apiClient.patch<RawIngredient>(`${BASE}/ingredients/${id}`, data, token),

  // ─── Ingredient Conversions ────────────────────────────────────────────────

  getIngredientConversions: (ingredientId: string, token: string) =>
    apiClient.get<IngredientConversion[]>(`${BASE}/ingredients/${ingredientId}/conversions`, token),

  createIngredientConversion: (
    ingredientId: string,
    data: { menuItemId: string; quantityPerPortion: number },
    token: string,
  ) =>
    apiClient.post<IngredientConversion>(
      `${BASE}/ingredients/${ingredientId}/conversions`,
      data,
      token,
    ),

  // ─── Supplier Deliveries ───────────────────────────────────────────────────

  getDeliveries: (
    filters: { ingredientId?: string; supplierId?: string; from?: string; to?: string },
    token: string,
  ) => {
    const params = new URLSearchParams();
    if (filters.ingredientId) params.set('ingredientId', filters.ingredientId);
    if (filters.supplierId) params.set('supplierId', filters.supplierId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return apiClient.get<SupplierDelivery[]>(`${BASE}/deliveries${qs ? `?${qs}` : ''}`, token);
  },

  logDelivery: (
    data: { ingredientId: string; supplierId: string; quantity: number; notes?: string },
    token: string,
  ) => apiClient.post<{ delivery: SupplierDelivery; ingredient: RawIngredient }>(`${BASE}/deliveries`, data, token),

  // ─── Requisitions — CK view ────────────────────────────────────────────────

  getRequisitions: (
    filters: { status?: string; date?: string },
    token: string,
  ) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.date) params.set('date', filters.date);
    const qs = params.toString();
    return apiClient.get<Requisition[]>(`${BASE}/requisitions${qs ? `?${qs}` : ''}`, token);
  },

  getRequisitionById: (id: string, token: string) =>
    apiClient.get<RequisitionWithCapacity>(`${BASE}/requisitions/${id}`, token),

  dispatchRequisition: (id: string, data: DispatchRequisitionPayload, token: string) =>
    apiClient.post<Requisition>(`${BASE}/requisitions/${id}/dispatch`, data, token),

  // ─── Requisitions — Branch view ────────────────────────────────────────────

  getRequisitionsForBranch: (filters: { status?: string }, token: string) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    const qs = params.toString();
    return apiClient.get<Requisition[]>(`${BASE}/requisitions/branch${qs ? `?${qs}` : ''}`, token);
  },

  createRequisition: (data: CreateRequisitionPayload, token: string) =>
    apiClient.post<Requisition>(`${BASE}/requisitions`, data, token),

  receiveRequisition: (id: string, data: ReceiveRequisitionPayload, token: string) =>
    apiClient.post<Requisition>(`${BASE}/requisitions/${id}/receive`, data, token),

  // ─── Branch Stock ──────────────────────────────────────────────────────────

  getBranchStock: (token: string) =>
    apiClient.get<BranchStockItem[]>(`${BASE}/stock/branch`, token),

  // All active menu items with current branch stock qty (0 for items not yet stocked).
  // Used by the stocktake form so Managers can count every item from day one.
  getMenuItemsWithBranchStock: (token: string) =>
    apiClient.get<MenuItemStocktakeRow[]>(`${BASE}/stock/branch/all-items`, token),

  // ─── Stocktake ─────────────────────────────────────────────────────────────

  getStocktakes: (filters: { from?: string; to?: string }, token: string) => {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return apiClient.get<StocktakeSession[]>(`${BASE}/stocktake${qs ? `?${qs}` : ''}`, token);
  },

  submitStocktake: (data: SubmitStocktakePayload, token: string) =>
    apiClient.post<StocktakeSession>(`${BASE}/stocktake`, data, token),

  getCentralStocktakes: (token: string) =>
    apiClient.get<RawIngredient[]>(`${BASE}/stocktake/central`, token),

  submitCentralStocktake: (
    data: { date: string; entries: Array<{ ingredientId: string; actualQty: number }> },
    token: string,
  ) => apiClient.post<{ date: string; entries: Array<{ ingredient: RawIngredient; actualQty: number; variance: number }> }>(
    `${BASE}/stocktake/central`,
    data,
    token,
  ),

  // ─── Overview & Reports ────────────────────────────────────────────────────

  getInventoryOverview: (token: string) =>
    apiClient.get<InventoryOverview>(`${BASE}/overview`, token),

  getShrinkageReport: (
    filters: { branchId?: string; from?: string; to?: string },
    token: string,
  ) => {
    const params = new URLSearchParams();
    if (filters.branchId) params.set('branchId', filters.branchId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return apiClient.get<StocktakeEntry[]>(`${BASE}/reports/shrinkage${qs ? `?${qs}` : ''}`, token);
  },

  getDiscrepancyReport: (
    filters: { branchId?: string; from?: string; to?: string },
    token: string,
  ) => {
    const params = new URLSearchParams();
    if (filters.branchId) params.set('branchId', filters.branchId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return apiClient.get<DiscrepancyEntry[]>(`${BASE}/reports/discrepancies${qs ? `?${qs}` : ''}`, token);
  },

  getAllStocktakeSessions: (filters: { from?: string; to?: string }, token: string) => {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return apiClient.get<AllStocktakeSession[]>(`${BASE}/stocktake/all${qs ? `?${qs}` : ''}`, token);
  },
};
