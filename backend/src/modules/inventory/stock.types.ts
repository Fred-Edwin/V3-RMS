/**
 * Inventory — Milestone Six, Session 1 (Stock position & ledger)
 * FROZEN API CONTRACT — TypeScript types, inferred from `stock-validators.ts`.
 * Mirrored (by hand) in `frontend/features/inventory/types/stock.ts`.
 */
import type { z } from 'zod';

import type {
  AttendantStockSummarySchema,
  LedgerLocationSchema,
  LedgerQuerySchema,
  LedgerRowSchema,
  LedgerSchema,
  LedgerSummarySchema,
  ListStockQuerySchema,
  StockListSchema,
  StockRowSchema,
  StockSummarySchema,
  TodaysCountSchema,
  inventoryTransactionTypeSchema,
} from './stock-validators';

export type InventoryTransactionTypeValue = z.infer<typeof inventoryTransactionTypeSchema>;
export type TodaysCount = z.infer<typeof TodaysCountSchema>;

export type ListStockQuery = z.infer<typeof ListStockQuerySchema>;
export type StockRow = z.infer<typeof StockRowSchema>;
export type StockList = z.infer<typeof StockListSchema>;

export type StockSummary = z.infer<typeof StockSummarySchema>;
export type AttendantStockSummary = z.infer<typeof AttendantStockSummarySchema>;

export type LedgerQuery = z.infer<typeof LedgerQuerySchema>;
export type LedgerLocation = z.infer<typeof LedgerLocationSchema>;
export type LedgerSummary = z.infer<typeof LedgerSummarySchema>;
export type LedgerRow = z.infer<typeof LedgerRowSchema>;
export type Ledger = z.infer<typeof LedgerSchema>;
