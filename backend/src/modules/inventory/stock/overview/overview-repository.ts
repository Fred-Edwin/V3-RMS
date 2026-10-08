import { stockRepository, type StoreTotals } from '../_shared/stock-repository';

/**
 * The Overview reads the store's totals from the shared stock repository and everything about counts from Counting's
 * `count-reads` (in the service); it owns no query of its own.
 */
export const overviewRepository = {
  storeTotals: (siteId: string, locationId: string): Promise<StoreTotals> => stockRepository.storeTotals(siteId, locationId),
};
