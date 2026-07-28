import { z } from 'zod';

export const LocationQuerySchema = z.object({
  locationId: z.string().uuid('locationId must be a valid UUID'),
});

export const PriceHistoryQuerySchema = z.object({
  inventoryItemId: z.string().uuid('inventoryItemId must be a valid UUID'),
  supplierId: z.string().uuid('supplierId must be a valid UUID').optional(),
});

export const PrepYieldQuerySchema = z.object({
  outputItemId: z.string().uuid('outputItemId must be a valid UUID').optional(),
});

export const CountDiscrepancyQuerySchema = z.object({
  locationId: z.string().uuid('locationId must be a valid UUID').optional(),
  stockCountId: z.string().uuid('stockCountId must be a valid UUID').optional(),
});

export type LocationQueryInput = z.infer<typeof LocationQuerySchema>;
export type PriceHistoryQueryInput = z.infer<typeof PriceHistoryQuerySchema>;
export type PrepYieldQueryInput = z.infer<typeof PrepYieldQuerySchema>;
export type CountDiscrepancyQueryInput = z.infer<typeof CountDiscrepancyQuerySchema>;
