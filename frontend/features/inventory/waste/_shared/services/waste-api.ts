/**
 * Waste's one HTTP service (contract §4.3, endpoints W1 to W4). Every call goes through `callApi`, the fixtures seam.
 * `BASE` is the only place the path prefix lives: the contract says "base /inventory/stock/waste" for W1 `GET /waste/items`;
 * the hand-off run confirms the final URL against the real router.
 */
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type { LogWasteInput, LogWasteResult, ReverseWasteInput, WasteEntry, WasteItems, WasteList, WasteListQuery } from '../types/waste-contract';

const BASE = '/inventory/stock/waste';
const callApi = makeCallApi(BASE);

export const wasteApi = {
  /** W1 */
  items: (query: { search?: string; limit?: number } = {}, signal?: AbortSignal) => callApi<WasteItems>('GET', `/items${queryString(query)}`, undefined, signal),
  /** W2. A repeated idempotency key returns the same batch with `replayed: true`. */
  log: (input: LogWasteInput) => callApi<LogWasteResult>('POST', '', input),
  /** W3 */
  list: (query: WasteListQuery = {}, signal?: AbortSignal) => callApi<WasteList>('GET', `${queryString(query)}`, undefined, signal),
  /** W4. No PIN. */
  reverse: (id: string, input: ReverseWasteInput) => callApi<WasteEntry>('POST', `/${id}/reverse`, input),
};
