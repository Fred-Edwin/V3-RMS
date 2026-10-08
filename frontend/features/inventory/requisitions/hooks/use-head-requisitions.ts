import { useLoader } from '../../_shared/hooks/use-async';
import type { HistoryMine, HistoryMineQuery, Home, RequisitionFile } from '../_shared/types/requisitions-contract';
import { requisitionsApi } from '../services/requisitions-phone-api';

/** R7: the head's Requisitions home. */
export function useHeadHome() {
  return useLoader<Home>('req-home', () => requisitionsApi.home(), 'Could not load requisitions.');
}

/** R3: the file, as a head sees it (own department only, no money). */
export function useHeadFile(id: string) {
  return useLoader<RequisitionFile>(`req-file:${id}`, () => requisitionsApi.file(id), 'Could not load this requisition.');
}

/** R9: the head's past requisitions. The key carries every filter so a change reloads. */
export function useHistoryMine(query: HistoryMineQuery) {
  const key = `req-history:${query.from ?? ''}:${query.to ?? ''}:${query.status ?? ''}:${query.page ?? 1}:${query.pageSize ?? 25}`;
  return useLoader<HistoryMine>(key, () => requisitionsApi.historyMine(query), 'Could not load your past requisitions.');
}
