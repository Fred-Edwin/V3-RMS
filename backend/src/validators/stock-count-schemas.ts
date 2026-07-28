import { z } from 'zod';
import { nonNegativeQuantitySchema } from './inventory-item-schemas';

export const StockCountIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const CreateStockCountSchema = z.object({
  locationId: z.string().uuid('locationId must be a valid UUID'),
  label: z.string().trim().min(1, 'Label is required').max(200),
  scheduledDate: z.string().datetime({ message: 'scheduledDate must be an ISO datetime string' }),
  inventoryItemIds: z
    .array(z.string().uuid('each inventoryItemId must be a valid UUID'))
    .min(1, 'At least one item is required'),
});

const submitStockCountLineSchema = z.object({
  lineId: z.string().uuid('lineId must be a valid UUID'),
  countedQty: nonNegativeQuantitySchema,
});

export const SubmitStockCountSchema = z.object({
  lines: z.array(submitStockCountLineSchema).min(1, 'At least one line is required'),
});

export const StockCountListQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'APPROVED']).optional(),
});

export type CreateStockCountInput = z.infer<typeof CreateStockCountSchema>;
export type SubmitStockCountLineInput = z.infer<typeof submitStockCountLineSchema>;
export type SubmitStockCountInput = z.infer<typeof SubmitStockCountSchema>;
