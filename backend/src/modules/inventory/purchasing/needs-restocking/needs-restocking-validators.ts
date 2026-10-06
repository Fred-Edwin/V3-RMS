import { z } from 'zod';

export const NeedsQuerySchema = z.object({
  group: z.enum(['supplier', 'item']).default('supplier'),
  supplierId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['urgent', 'name', 'value']).default('urgent'),
});

export const CatalogQuerySchema = z.object({
  supplierId: z.string().uuid(),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  filter: z.enum(['low', 'all', 'selected']).default('low'),
});
