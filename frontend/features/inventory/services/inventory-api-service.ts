/**
 * Inventory Milestone One — real backend implementation of the frozen
 * contract (`../types`, mirroring `backend/src/modules/inventory/
 * inventory-validators.ts`).
 *
 * Reads the access token via `useAuthStore.getState()` rather than taking it
 * as a parameter (same pattern as `lib/logout.ts`).
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { ApiResponseEnvelope } from '@/types/api';
import type {
  AddSupplierLineInput,
  Category,
  CreateCategoryInput,
  CreateItemInput,
  CreateSupplierInput,
  InventoryItem,
  InventoryItemDetail,
  InventoryItemListRow,
  ItemCatalogListResponse,
  ItemChangeReview,
  ItemMutationResponse,
  ListCategoriesQuery,
  ListItemsQuery,
  ListRestockLevelsQuery,
  ListSuppliersQuery,
  Paginated,
  RestockLevelRow,
  SaveRestockLevelsInput,
  Supplier,
  UpdateCategoryInput,
  UpdateItemInput,
  UpdateSupplierInput,
} from '../types';

function token(): string | undefined {
  return useAuthStore.getState().accessToken ?? undefined;
}

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function listCategories(query: ListCategoriesQuery = {}): Promise<Category[]> {
  return apiClient.get<Category[]>(`/inventory/categories${toQueryString(query)}`, token());
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  return apiClient.post<Category>('/inventory/categories', input, token());
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  return apiClient.patch<Category>(`/inventory/categories/${id}`, input, token());
}

export async function retireCategory(id: string): Promise<void> {
  await apiClient.delete<void>(`/inventory/categories/${id}`, token());
}

export async function restoreCategory(id: string): Promise<Category> {
  return apiClient.post<Category>(`/inventory/categories/${id}/restore`, {}, token());
}

// ─── Items ──────────────────────────────────────────────────────────────────

/** The item list endpoint additionally carries `meta` (the KPI strip counts), not declared on the shared envelope type. */
type ItemListEnvelope = ApiResponseEnvelope<InventoryItemListRow[]> & { meta?: ItemCatalogListResponse['meta'] };

export async function listItems(query: ListItemsQuery = {}): Promise<ItemCatalogListResponse> {
  const envelope = (await apiClient.getWithEnvelope<InventoryItemListRow[]>(
    `/inventory/items${toQueryString(query)}`,
    token()
  )) as ItemListEnvelope;
  if (!envelope.meta) {
    throw new Error('Item list response is missing meta — contract drift with the backend.');
  }
  return {
    data: envelope.data ?? [],
    pagination: envelope.pagination ?? { total: 0, page: 1, perPage: 20, totalPages: 1 },
    meta: envelope.meta,
  };
}

/** The item plus who sells it (`suppliers[]`, §28.3). */
export async function getItem(id: string): Promise<InventoryItemDetail> {
  return apiClient.get<InventoryItemDetail>(`/inventory/items/${id}`, token());
}

/** Counts behind the "Review the change" step (§29.6). Store Manager only. */
export async function getItemChangeReview(id: string): Promise<ItemChangeReview> {
  return apiClient.get<ItemChangeReview>(`/inventory/items/${id}/change-review`, token());
}

export async function createItem(input: CreateItemInput): Promise<ItemMutationResponse> {
  return apiClient.post<ItemMutationResponse>('/inventory/items', input, token());
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<ItemMutationResponse> {
  return apiClient.patch<ItemMutationResponse>(`/inventory/items/${id}`, input, token());
}

export async function retireItem(id: string): Promise<void> {
  await apiClient.delete<void>(`/inventory/items/${id}`, token());
}

export async function restoreItem(id: string): Promise<InventoryItem> {
  return apiClient.post<InventoryItem>(`/inventory/items/${id}/restore`, {}, token());
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function listSuppliers(query: ListSuppliersQuery = {}): Promise<Paginated<Supplier>> {
  const envelope = await apiClient.getWithEnvelope<Supplier[]>(
    `/inventory/suppliers${toQueryString(query)}`,
    token()
  );
  return {
    data: envelope.data ?? [],
    pagination: envelope.pagination ?? { total: 0, page: 1, perPage: 20, totalPages: 1 },
  };
}

export async function getSupplier(id: string): Promise<Supplier> {
  return apiClient.get<Supplier>(`/inventory/suppliers/${id}`, token());
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return apiClient.post<Supplier>('/inventory/suppliers', input, token());
}

export async function updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
  return apiClient.patch<Supplier>(`/inventory/suppliers/${id}`, input, token());
}

export async function retireSupplier(id: string): Promise<void> {
  await apiClient.delete<void>(`/inventory/suppliers/${id}`, token());
}

export async function restoreSupplier(id: string): Promise<Supplier> {
  return apiClient.post<Supplier>(`/inventory/suppliers/${id}/restore`, {}, token());
}

/**
 * Add one supplier pack line for an item (§28.3). A line with the same
 * buy unit and pack size already on file is a 409 `PACK_LINE_EXISTS` whose
 * message names the existing line — show it inline.
 */
export async function addSupplierLine(supplierId: string, input: AddSupplierLineInput): Promise<void> {
  await apiClient.post<unknown>(`/inventory/suppliers/${supplierId}/items`, input, token());
}

// ─── Restock levels ─────────────────────────────────────────────────────────

/**
 * `actor` is accepted for signature parity with the mock (which needs it to
 * fake per-role scoping) but ignored here — the real backend resolves scope
 * server-side from the authenticated actor's role/department, per D-15.
 */
export async function listRestockLevels(
  query: ListRestockLevelsQuery,
  // Kept for the restock drawers' call shape until the restock-levels session replaces them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _actor?: { role: 'STORE_MANAGER' | 'DEPARTMENT_HEAD' }
): Promise<RestockLevelRow[]> {
  return apiClient.get<RestockLevelRow[]>(`/inventory/restock-levels${toQueryString(query)}`, token());
}

export async function saveRestockLevels(
  input: SaveRestockLevelsInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _actor?: { role: 'STORE_MANAGER' | 'DEPARTMENT_HEAD' }
): Promise<RestockLevelRow[]> {
  return apiClient.put<RestockLevelRow[]>('/inventory/restock-levels', input, token());
}

/**
 * Post-freeze addition (2026-09-15, owner-approved) — lets a Store Manager
 * discover the Central Store's locationId to pass to the restock-levels
 * endpoints above. See `backend/src/modules/inventory/inventory-service.ts`'s
 * `getCentralStoreLocation` for why this was needed.
 */
export async function getCentralStoreLocation(): Promise<{ id: string }> {
  return apiClient.get<{ id: string }>('/inventory/central-store-location', token());
}
