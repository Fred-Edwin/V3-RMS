import { z } from 'zod';
import { quantitySchema } from './inventory-item-schemas';

export const PrepRecordIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

const prepInputLineSchema = z.object({
  inventoryItemId: z.string().uuid('inventoryItemId must be a valid UUID'),
  quantity: quantitySchema,
});

export const CreatePrepRecordSchema = z.object({
  locationId: z.string().uuid('locationId must be a valid UUID'),
  outputItemId: z.string().uuid('outputItemId must be a valid UUID'),
  actualYield: quantitySchema,
  /** Recipe's expected yield scaled by this run's ingredient ratios — omitted when no recipe exists. */
  scaledExpectedYield: quantitySchema.optional(),
  inputs: z.array(prepInputLineSchema).min(1, 'At least one input line is required'),
});

export const PrepRecordListQuerySchema = z.object({
  outputItemId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});

export const RollingAverageQuerySchema = z.object({
  outputItemId: z.string().uuid('outputItemId must be a valid UUID'),
});

export const PromotePrepRecipeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  expectedYield: quantitySchema.optional(),
  batchLabel: z.string().trim().max(100).optional(),
  instructions: z.string().trim().max(5000).optional(),
});

const recipeInputLineSchema = z.object({
  inventoryItemId: z.string().uuid('inventoryItemId must be a valid UUID'),
  quantity: quantitySchema,
});

/**
 * Directly authors a Prep Recipe — creates the output InventoryItem (type
 * PREPPED) and the PrepRecipe + lines in one atomic call. Reopens D-12's
 * "no predefined recipe requirement": recipes remain optional to *use* (Log
 * Prep still falls back to a blank slate if none exists) but are now
 * authored up front by the Store Manager rather than only ever promoted
 * after the fact from a past PrepRecord.
 */
export const CreatePrepRecipeSchema = z.object({
  outputItemName: z.string().trim().min(1, 'Name is required').max(200),
  usageUnit: z.string().trim().min(1, 'Usage unit is required').max(20),
  expectedYield: quantitySchema,
  batchLabel: z.string().trim().max(100).optional(),
  instructions: z.string().trim().max(5000).optional(),
  inputs: z.array(recipeInputLineSchema).min(1, 'At least one input line is required'),
});

export const UpdatePrepRecipeSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  expectedYield: quantitySchema.optional(),
  batchLabel: z.string().trim().max(100).optional(),
  instructions: z.string().trim().max(5000).optional(),
  inputs: z.array(recipeInputLineSchema).min(1, 'At least one input line is required').optional(),
});

export type CreatePrepRecordInput = z.infer<typeof CreatePrepRecordSchema>;
export type PromotePrepRecipeInput = z.infer<typeof PromotePrepRecipeSchema>;
export type CreatePrepRecipeInput = z.infer<typeof CreatePrepRecipeSchema>;
export type UpdatePrepRecipeInput = z.infer<typeof UpdatePrepRecipeSchema>;
