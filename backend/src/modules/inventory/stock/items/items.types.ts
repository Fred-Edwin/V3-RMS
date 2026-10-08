import type { z } from 'zod';
import type { stockItemsQuerySchema } from '../_shared/stock-contract';

export type { StockItemRow, StockItemsList } from '../_shared/stock-contract';
export type StockItemsQuery = z.infer<typeof stockItemsQuerySchema>;
