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

export type CreatePrepRecordInput = z.infer<typeof CreatePrepRecordSchema>;
export type PromotePrepRecipeInput = z.infer<typeof PromotePrepRecipeSchema>;
