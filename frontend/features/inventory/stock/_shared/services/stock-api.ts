/**
 * Stock's one HTTP service (contract §4.2, endpoints S1 to S5). Every call goes through `callApi`, the fixtures seam.
 */
import { env } from '@/lib/env';
import { ApiError } from '@/types/api';
import { useAuthStore } from '@/store/authStore';
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type { LedgerList, LedgerQuery, StockCard, StockCardQuery, StockItemsList, StockItemsQuery, StockOverview } from '../types/stock-contract';

const BASE = '/inventory/stock';
const callApi = makeCallApi(BASE);

export const stockApi = {
  /** S1 */
  overview: () => callApi<StockOverview>('GET', '/overview'),
  /** S2 */
  items: (query: StockItemsQuery = {}, signal?: AbortSignal) => callApi<StockItemsList>('GET', `/items${queryString(query)}`, undefined, signal),
  /** S3 */
  ledger: (query: LedgerQuery = {}, signal?: AbortSignal) => callApi<LedgerList>('GET', `/ledger${queryString(query)}`, undefined, signal),
  /** S5 */
  card: (itemId: string, query: StockCardQuery = {}) => callApi<StockCard>('GET', `/ledger/${itemId}${queryString(query)}`),
  /** S4. The CSV for these filters, every row (at most 10,000; 413 EXPORT_TOO_LARGE). */
  exportLedger: async (query: Omit<LedgerQuery, 'page' | 'pageSize'> = {}): Promise<{ blob: Blob; fileName: string }> => {
    const accessToken = useAuthStore.getState().accessToken;
    const response = await fetch(`${env.apiUrl}${BASE}/ledger/export${queryString(query)}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string; code?: string; details?: unknown } };
      throw new ApiError(payload.error?.message ?? 'Request failed', response.status, payload.error?.code ?? 'UNKNOWN_ERROR', payload.error?.details);
    }
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'stock-ledger.csv';
    return { blob: await response.blob(), fileName };
  },
};
