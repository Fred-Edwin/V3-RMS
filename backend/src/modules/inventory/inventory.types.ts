/**
 * Inventory — Milestone One (Catalog, Suppliers & Restock Levels)
 * FROZEN API CONTRACT — TypeScript types.
 *
 * Every type here is inferred from the Zod schemas in `inventory-validators.ts`
 * — the schemas are the single definition, these are the compile-time view of
 * them. Do not hand-write a type that duplicates a schema; infer it.
 *
 * Plan: `docs/features/inventory/05-plan.md` §5.
 * Mirrored (by hand) in `frontend/types/inventory.ts`.
 */
import type { z } from 'zod';

import type {
  CategorySchema,
  CentralStoreLocationSchema,
  CreateCategorySchema,
  CreateItemSchema,
  CreateSupplierSchema,
  InventoryItemSchema,
  ItemCatalogMetaSchema,
  ItemMutationResponseSchema,
  ListCategoriesQuerySchema,
  ListItemsQuerySchema,
  ListRestockLevelsQuerySchema,
  ListSuppliersQuerySchema,
  RestockLevelRowSchema,
  SaveRestockLevelsSchema,
  SupplierSchema,
  UpdateCategorySchema,
  UpdateItemSchema,
  UpdateSupplierSchema,
  departmentTagSchema,
  inventoryItemTypeSchema,
  supplierPaymentTermsSchema,
} from './inventory-validators';

// --- Enums -----------------------------------------------------------------

export type InventoryItemType = z.infer<typeof inventoryItemTypeSchema>;
export type DepartmentTag = z.infer<typeof departmentTagSchema>;
export type SupplierPaymentTerms = z.infer<typeof supplierPaymentTermsSchema>;

// --- Central Store lookup ---------------------------------------------------

export type CentralStoreLocation = z.infer<typeof CentralStoreLocationSchema>;

// --- Categories ------------------------------------------------------------

export type Category = z.infer<typeof CategorySchema>;
export type ListCategoriesQuery = z.infer<typeof ListCategoriesQuerySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

// --- Items -----------------------------------------------------------------

export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type ItemCatalogMeta = z.infer<typeof ItemCatalogMetaSchema>;
export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;
export type CreateItemInput = z.infer<typeof CreateItemSchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
export type ItemMutationResponse = z.infer<typeof ItemMutationResponseSchema>;

// --- Suppliers -------------------------------------------------------------

export type Supplier = z.infer<typeof SupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof ListSuppliersQuerySchema>;
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;

// --- Restock levels --------------------------------------------------------

export type RestockLevelRow = z.infer<typeof RestockLevelRowSchema>;
export type ListRestockLevelsQuery = z.infer<typeof ListRestockLevelsQuerySchema>;
export type SaveRestockLevelsInput = z.infer<typeof SaveRestockLevelsSchema>;

// --- Response envelopes ----------------------------------------------------

/** Matches `API_CONTRACT.md` §1's standard envelope. */
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
export interface ItemCatalogListResponse extends Paginated<InventoryItem> {
  meta: ItemCatalogMeta;
}
