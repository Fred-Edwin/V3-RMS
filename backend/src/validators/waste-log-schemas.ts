import { z } from 'zod';
import { quantitySchema } from './inventory-item-schemas';

export const WasteLogIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

const wasteReasonEnum = z.enum(['SPOILED', 'PREP_ERROR', 'DROPPED', 'EXPIRED', 'OTHER']);

export const CreateWasteLogSchema = z.object({
  locationId: z.string().uuid('locationId must be a valid UUID'),
  inventoryItemId: z.string().uuid('inventoryItemId must be a valid UUID'),
  quantity: quantitySchema,
  reason: wasteReasonEnum,
  note: z.string().trim().max(500).optional(),
});

export const WasteLogListQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  reason: wasteReasonEnum.optional(),
});

export type CreateWasteLogInput = z.infer<typeof CreateWasteLogSchema>;
