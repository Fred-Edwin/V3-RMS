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
  AttendantInventoryItemSchema,
  AttendantItemMutationResponseSchema,
  CategorySchema,
  CentralStoreLocationSchema,
  CreateCategorySchema,
  CreateItemSchema,
  InventoryItemListRowSchema,
  InventoryItemSchema,
  ItemCatalogMetaSchema,
  ItemChangeReviewSchema,
  ItemHistoryEntrySchema,
  ItemHistoryQuerySchema,
  ItemMutationResponseSchema,
  ListCategoriesQuerySchema,
  ListItemsQuerySchema,
  ListRestockLevelsQuerySchema,
  PutBackRestockLevelSchema,
  RestockHistoryEntrySchema,
  RestockHistoryQuerySchema,
  RestockLevelRowSchema,
  RestockLevelsSummaryQuerySchema,
  RestockLevelsSummarySchema,
  RestoreItemSchema,
  RetireItemQuerySchema,
  SaveRestockLevelsSchema,
  UpdateCategorySchema,
  UpdateItemSchema,
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
export type InventoryItemListRow = z.infer<typeof InventoryItemListRowSchema>;
export type ItemCatalogMeta = z.infer<typeof ItemCatalogMetaSchema>;
export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;
export type CreateItemInput = z.infer<typeof CreateItemSchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
export type ItemMutationResponse = z.infer<typeof ItemMutationResponseSchema>;
export type AttendantInventoryItem = z.infer<typeof AttendantInventoryItemSchema>;
export type AttendantItemListRow = AttendantInventoryItem & Pick<InventoryItemListRow, 'matchedOn' | 'supplierCount'>;
export type AttendantItemMutationResponse = z.infer<typeof AttendantItemMutationResponseSchema>;
export type ItemChangeReview = z.infer<typeof ItemChangeReviewSchema>;
export type ItemHistoryEntry = z.infer<typeof ItemHistoryEntrySchema>;
export type ItemHistoryQuery = z.infer<typeof ItemHistoryQuerySchema>;
export type RetireItemQuery = z.infer<typeof RetireItemQuerySchema>;
export type RestoreItemInput = z.infer<typeof RestoreItemSchema>;

// --- Restock levels --------------------------------------------------------

export type RestockLevelRow = z.infer<typeof RestockLevelRowSchema>;
export type ListRestockLevelsQuery = z.infer<typeof ListRestockLevelsQuerySchema>;
export type SaveRestockLevelsInput = z.infer<typeof SaveRestockLevelsSchema>;
export type RestockLevelsSummary = z.infer<typeof RestockLevelsSummarySchema>;
export type RestockLevelsSummaryQuery = z.infer<typeof RestockLevelsSummaryQuerySchema>;
export type RestockHistoryQuery = z.infer<typeof RestockHistoryQuerySchema>;
export type RestockHistoryEntry = z.infer<typeof RestockHistoryEntrySchema>;
export type PutBackRestockLevelInput = z.infer<typeof PutBackRestockLevelSchema>;

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
export interface ItemCatalogListResponse extends Paginated<InventoryItemListRow | AttendantItemListRow> {
  meta: ItemCatalogMeta;
}
