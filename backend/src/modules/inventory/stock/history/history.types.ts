import type { z } from 'zod';
import type { stockCardQuerySchema } from '../_shared/stock-contract';

export type { LedgerList, LedgerQuery, LedgerRow, StockCard } from '../_shared/stock-contract';
export type StockCardQuery = z.infer<typeof stockCardQuerySchema>;

/** S4: the CSV text and the file name it is downloaded as. */
export type LedgerExport = { filename: string; csv: string };
