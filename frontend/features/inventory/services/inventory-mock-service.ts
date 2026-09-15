/**
 * Inventory Milestone One — in-memory mock implementation of the frozen
 * contract (`../types`, mirroring `backend/src/modules/inventory/
 * inventory-validators.ts`). Lets every screen run end-to-end with no
 * backend, per the session brief — never wait on the parallel backend build.
 *
 * Every function has the same signature the real `inventory-service.ts`
 * will have, so swapping the mock for the real HTTP module later is a
 * one-line change at the call site (see `index.ts`).
 */
import { ApiError } from '@/types/api';
import type {
  Category,
  CreateCategoryInput,
  CreateItemInput,
  CreateSupplierInput,
  InventoryItem,
  ItemCatalogListResponse,
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
import {
  CATEGORY_SEED,
  CENTRAL_STORE_LOCATION_ID,
  DEPARTMENT_RESTOCK_LEVEL_SEED,
  ITEM_CATALOG_META,
  ITEM_SEED,
  RESTOCK_LEVEL_SEED,
  SUPPLIER_SEED,
  nextId,
} from './mock-data';

/** Simulated network latency — small, just enough for loading states to be visible. */
const LATENCY_MS = 220;
const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

let categories = [...CATEGORY_SEED];
let items = [...ITEM_SEED];
let suppliers = [...SUPPLIER_SEED];
let centralRestockLevels = [...RESTOCK_LEVEL_SEED];
let departmentRestockLevels = [...DEPARTMENT_RESTOCK_LEVEL_SEED];

function paginate<T>(rows: T[], page: number, perPage: number): Paginated<T> {
  const total = rows.length;
  const start = (page - 1) * perPage;
  return {
    data: rows.slice(start, start + perPage),
    pagination: { total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) },
  };
}

function notFound(entity: string): never {
  throw new ApiError(`${entity} not found`, 404, 'NOT_FOUND');
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function listCategories(query: ListCategoriesQuery = {}): Promise<Category[]> {
  await delay();
  return categories.filter((c) => query.includeRetired || !c.retiredAt);
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  await delay();
  const nameLower = input.name.trim().toLowerCase();
  if (categories.some((c) => !c.retiredAt && c.name.toLowerCase() === nameLower)) {
    throw new ApiError('A category with that name already exists', 409, 'DUPLICATE_CATEGORY_NAME');
  }
  const category: Category = {
    id: nextId('cat'),
    name: input.name.trim(),
    itemCount: 0,
    retiredAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  categories = [...categories, category];
  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  await delay();
  const existing = categories.find((c) => c.id === id);
  if (!existing) notFound('Category');
  const nameLower = input.name.trim().toLowerCase();
  if (categories.some((c) => c.id !== id && !c.retiredAt && c.name.toLowerCase() === nameLower)) {
    throw new ApiError('A category with that name already exists', 409, 'DUPLICATE_CATEGORY_NAME');
  }
  const updated: Category = { ...existing, name: input.name.trim(), updatedAt: new Date().toISOString() };
  categories = categories.map((c) => (c.id === id ? updated : c));
  return updated;
}

export async function retireCategory(id: string): Promise<void> {
  await delay();
  const existing = categories.find((c) => c.id === id);
  if (!existing) notFound('Category');
  categories = categories.map((c) => (c.id === id ? { ...c, retiredAt: new Date().toISOString() } : c));
}

export async function restoreCategory(id: string): Promise<Category> {
  await delay();
  const existing = categories.find((c) => c.id === id);
  if (!existing) notFound('Category');
  if (categories.some((c) => c.id !== id && !c.retiredAt && c.name.toLowerCase() === existing.name.toLowerCase())) {
    throw new ApiError('A live category already holds that name', 409, 'DUPLICATE_CATEGORY_NAME');
  }
  const updated: Category = { ...existing, retiredAt: null, updatedAt: new Date().toISOString() };
  categories = categories.map((c) => (c.id === id ? updated : c));
  return updated;
}

// ─── Items ──────────────────────────────────────────────────────────────────

function resolveCategory(categoryId?: string | null, categoryName?: string | null): { id: string; name: string } | null {
  if (categoryId) {
    const found = categories.find((c) => c.id === categoryId);
    return found ? { id: found.id, name: found.name } : null;
  }
  if (categoryName) {
    const trimmed = categoryName.trim();
    const existing = categories.find((c) => !c.retiredAt && c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return { id: existing.id, name: existing.name };
    const created: Category = {
      id: nextId('cat'),
      name: trimmed,
      itemCount: 0,
      retiredAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    categories = [...categories, created];
    return { id: created.id, name: created.name };
  }
  return null;
}

function resolveSupplier(preferredSupplierId?: string | null): { id: string; name: string } | null {
  if (!preferredSupplierId) return null;
  const found = suppliers.find((s) => s.id === preferredSupplierId);
  return found ? { id: found.id, name: found.name } : null;
}

function findDuplicateNameWarning(name: string, excludeId?: string): ItemMutationResponse['warnings'] {
  const nameLower = name.trim().toLowerCase();
  const duplicate = items.some((i) => i.id !== excludeId && !i.retiredAt && i.name.toLowerCase() === nameLower);
  return duplicate
    ? [{ code: 'DUPLICATE_ITEM_NAME' as const, message: `Another item is already named "${name.trim()}".` }]
    : [];
}

export async function listItems(query: ListItemsQuery = {}): Promise<ItemCatalogListResponse> {
  await delay();
  const page = query.page ?? 1;
  const perPage = query.perPage ?? 20;
  let rows = items.filter((i) => query.includeRetired || !i.retiredAt);
  if (query.type) rows = rows.filter((i) => i.type === query.type);
  if (query.categoryId) rows = rows.filter((i) => i.categoryId === query.categoryId);
  if (query.departmentTag) rows = rows.filter((i) => i.departmentTags.includes(query.departmentTag!));
  if (query.search) {
    const s = query.search.trim().toLowerCase();
    rows = rows.filter((i) => i.name.toLowerCase().includes(s));
  }
  const paged = paginate(rows, page, perPage);
  return { ...paged, meta: ITEM_CATALOG_META };
}

export async function getItem(id: string): Promise<InventoryItem> {
  await delay();
  const found = items.find((i) => i.id === id);
  if (!found) notFound('Item');
  return found;
}

const RAW_DEPARTMENT_MESSAGE =
  "Raw ingredients can't be scoped to a department — they're only issued via requisition as prepped or stocked items.";

export async function createItem(input: CreateItemInput): Promise<ItemMutationResponse> {
  await delay();
  if (input.type === 'RAW_INGREDIENT' && input.departmentTags.length > 0) {
    throw new ApiError(RAW_DEPARTMENT_MESSAGE, 422, 'RAW_INGREDIENT_NO_DEPARTMENT', {
      field: 'departmentTags',
    });
  }
  if (input.categoryId && input.categoryName) {
    throw new ApiError('Provide either categoryId or categoryName, not both', 422, 'VALIDATION_ERROR', {
      field: 'categoryName',
    });
  }

  const category = resolveCategory(input.categoryId, input.categoryName);
  const preferredSupplier = resolveSupplier(input.preferredSupplierId);
  const nowIso = new Date().toISOString();

  const item: InventoryItem = {
    id: nextId('item'),
    name: input.name.trim(),
    type: input.type,
    categoryId: category?.id ?? null,
    preferredSupplierId: preferredSupplier?.id ?? null,
    buyUnit: input.buyUnit.trim(),
    usageUnit: input.usageUnit.trim(),
    conversionFactor: input.conversionFactor ?? null,
    packSize: input.packSize ?? null,
    departmentTags: input.departmentTags,
    category,
    preferredSupplier,
    currentCost: '0',
    centralStoreRestockLevel: input.centralStoreRestockLevel ?? null,
    retiredAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const warnings = findDuplicateNameWarning(item.name);
  items = [...items, item];

  if (input.centralStoreRestockLevel !== undefined && input.centralStoreRestockLevel !== null) {
    centralRestockLevels = [
      ...centralRestockLevels,
      {
        inventoryItemId: item.id,
        itemName: item.name,
        usageUnit: item.usageUnit,
        onHandQty: '0',
        level: input.centralStoreRestockLevel,
        isBelowLevel: Number.parseFloat(input.centralStoreRestockLevel) > 0,
      },
    ];
  }

  return { item, warnings };
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<ItemMutationResponse> {
  await delay();
  const existing = items.find((i) => i.id === id);
  if (!existing) notFound('Item');

  const nextType = input.type ?? existing.type;
  const nextDepartmentTags = input.departmentTags ?? existing.departmentTags;
  if (nextType === 'RAW_INGREDIENT' && nextDepartmentTags.length > 0) {
    throw new ApiError(RAW_DEPARTMENT_MESSAGE, 422, 'RAW_INGREDIENT_NO_DEPARTMENT', {
      field: 'departmentTags',
    });
  }
  if (input.categoryId && input.categoryName) {
    throw new ApiError('Provide either categoryId or categoryName, not both', 422, 'VALIDATION_ERROR', {
      field: 'categoryName',
    });
  }

  const category =
    input.categoryId !== undefined || input.categoryName !== undefined
      ? resolveCategory(input.categoryId, input.categoryName)
      : existing.category;
  const preferredSupplier =
    input.preferredSupplierId !== undefined ? resolveSupplier(input.preferredSupplierId) : existing.preferredSupplier;

  const updated: InventoryItem = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    type: nextType,
    categoryId: category?.id ?? null,
    preferredSupplierId: preferredSupplier?.id ?? null,
    buyUnit: input.buyUnit?.trim() ?? existing.buyUnit,
    usageUnit: input.usageUnit?.trim() ?? existing.usageUnit,
    conversionFactor: input.conversionFactor !== undefined ? input.conversionFactor : existing.conversionFactor,
    packSize: input.packSize !== undefined ? input.packSize : existing.packSize,
    departmentTags: nextDepartmentTags,
    category,
    preferredSupplier,
    updatedAt: new Date().toISOString(),
  };

  const warnings = findDuplicateNameWarning(updated.name, id);
  items = items.map((i) => (i.id === id ? updated : i));

  if (input.centralStoreRestockLevel !== undefined) {
    const existingRow = centralRestockLevels.find((r) => r.inventoryItemId === id);
    if (existingRow) {
      centralRestockLevels = centralRestockLevels.map((r) =>
        r.inventoryItemId === id
          ? {
              ...r,
              level: input.centralStoreRestockLevel ?? null,
              isBelowLevel:
                input.centralStoreRestockLevel != null &&
                Number.parseFloat(r.onHandQty) < Number.parseFloat(input.centralStoreRestockLevel),
            }
          : r
      );
    } else if (input.centralStoreRestockLevel !== null) {
      centralRestockLevels = [
        ...centralRestockLevels,
        {
          inventoryItemId: id,
          itemName: updated.name,
          usageUnit: updated.usageUnit,
          onHandQty: '0',
          level: input.centralStoreRestockLevel,
          isBelowLevel: Number.parseFloat(input.centralStoreRestockLevel) > 0,
        },
      ];
    }
  }

  return { item: updated, warnings };
}

export async function retireItem(id: string): Promise<void> {
  await delay();
  const existing = items.find((i) => i.id === id);
  if (!existing) notFound('Item');
  items = items.map((i) => (i.id === id ? { ...i, retiredAt: new Date().toISOString() } : i));
}

export async function restoreItem(id: string): Promise<InventoryItem> {
  await delay();
  const existing = items.find((i) => i.id === id);
  if (!existing) notFound('Item');
  const updated = { ...existing, retiredAt: null, updatedAt: new Date().toISOString() };
  items = items.map((i) => (i.id === id ? updated : i));
  return updated;
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function listSuppliers(query: ListSuppliersQuery = {}): Promise<Paginated<Supplier>> {
  await delay();
  const page = query.page ?? 1;
  const perPage = query.perPage ?? 20;
  let rows = suppliers.filter((s) => query.includeRetired || !s.retiredAt);
  if (query.search) {
    const s = query.search.trim().toLowerCase();
    rows = rows.filter((sup) => sup.name.toLowerCase().includes(s));
  }
  return paginate(rows, page, perPage);
}

export async function getSupplier(id: string): Promise<Supplier> {
  await delay();
  const found = suppliers.find((s) => s.id === id);
  if (!found) notFound('Supplier');
  return found;
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  await delay();
  const category = input.categoryId ? categories.find((c) => c.id === input.categoryId) ?? null : null;
  const nowIso = new Date().toISOString();
  const supplier: Supplier = {
    id: nextId('sup'),
    name: input.name.trim(),
    contactName: input.contactName?.trim() ?? null,
    category: category ? { id: category.id, name: category.name } : null,
    phone: input.phone?.trim() ?? null,
    email: input.email?.trim() ?? null,
    location: input.location?.trim() ?? null,
    defaultPaymentTerms: input.defaultPaymentTerms ?? 'INVOICE_TO_FOLLOW',
    retiredAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  suppliers = [...suppliers, supplier];
  return supplier;
}

/**
 * Only touches fields actually present in `input` — mirrors the frozen
 * `UpdateSupplierSchema` amendment (2026-09-15): omitting
 * `defaultPaymentTerms` must never reset it. Every field here follows the
 * same "only if present" rule, not just payment terms.
 */
export async function updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
  await delay();
  const existing = suppliers.find((s) => s.id === id);
  if (!existing) notFound('Supplier');

  const category =
    input.categoryId !== undefined
      ? (() => {
          const found = input.categoryId ? categories.find((c) => c.id === input.categoryId) : null;
          return found ? { id: found.id, name: found.name } : null;
        })()
      : existing.category;

  const updated: Supplier = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    contactName: input.contactName !== undefined ? input.contactName?.trim() ?? null : existing.contactName,
    category,
    phone: input.phone !== undefined ? input.phone?.trim() ?? null : existing.phone,
    email: input.email !== undefined ? input.email?.trim() ?? null : existing.email,
    location: input.location !== undefined ? input.location?.trim() ?? null : existing.location,
    defaultPaymentTerms: input.defaultPaymentTerms !== undefined ? input.defaultPaymentTerms : existing.defaultPaymentTerms,
    updatedAt: new Date().toISOString(),
  };
  suppliers = suppliers.map((s) => (s.id === id ? updated : s));
  return updated;
}

export async function retireSupplier(id: string): Promise<void> {
  await delay();
  const existing = suppliers.find((s) => s.id === id);
  if (!existing) notFound('Supplier');
  const blockingItems = items.filter((i) => !i.retiredAt && i.preferredSupplierId === id);
  if (blockingItems.length > 0) {
    throw new ApiError(
      `${blockingItems.length} item(s) still name this supplier as preferred`,
      409,
      'SUPPLIER_IN_USE',
      { items: blockingItems.map((i) => ({ id: i.id, name: i.name })) }
    );
  }
  suppliers = suppliers.map((s) => (s.id === id ? { ...s, retiredAt: new Date().toISOString() } : s));
}

export async function restoreSupplier(id: string): Promise<Supplier> {
  await delay();
  const existing = suppliers.find((s) => s.id === id);
  if (!existing) notFound('Supplier');
  const updated = { ...existing, retiredAt: null, updatedAt: new Date().toISOString() };
  suppliers = suppliers.map((s) => (s.id === id ? updated : s));
  return updated;
}

// ─── Restock levels ─────────────────────────────────────────────────────────

/**
 * `role` mirrors the D-15 scoping rule (§5.2): a Store Manager must pass
 * `locationId` (the Central Store) explicitly, a Department Head omits it
 * and gets their own department resolved server-side.
 */
export async function listRestockLevels(
  query: ListRestockLevelsQuery,
  actor: { role: 'STORE_MANAGER' | 'DEPARTMENT_HEAD' }
): Promise<RestockLevelRow[]> {
  await delay();
  if (actor.role === 'STORE_MANAGER' && !query.locationId) {
    throw new ApiError('locationId is required for a Store Manager', 422, 'VALIDATION_ERROR');
  }
  let rows = actor.role === 'STORE_MANAGER' ? centralRestockLevels : departmentRestockLevels;
  if (query.search) {
    const s = query.search.trim().toLowerCase();
    rows = rows.filter((r) => r.itemName.toLowerCase().includes(s));
  }
  return rows;
}

export async function saveRestockLevels(
  input: SaveRestockLevelsInput,
  actor: { role: 'STORE_MANAGER' | 'DEPARTMENT_HEAD' }
): Promise<RestockLevelRow[]> {
  await delay();
  const target = actor.role === 'STORE_MANAGER' ? 'central' : 'department';
  const apply = (rows: RestockLevelRow[]): RestockLevelRow[] =>
    rows.map((row) => {
      const edit = input.levels.find((l) => l.inventoryItemId === row.inventoryItemId);
      if (!edit) return row;
      return {
        ...row,
        level: edit.level,
        isBelowLevel: edit.level != null && Number.parseFloat(row.onHandQty) < Number.parseFloat(edit.level),
      };
    });

  if (target === 'central') {
    centralRestockLevels = apply(centralRestockLevels);
    return centralRestockLevels;
  }
  departmentRestockLevels = apply(departmentRestockLevels);
  return departmentRestockLevels;
}

/** Mirrors the real `getCentralStoreLocation` endpoint's signature for parity — see `inventory-api-service.ts`. */
export async function getCentralStoreLocation(): Promise<{ id: string }> {
  await delay();
  return { id: CENTRAL_STORE_LOCATION_ID };
}
