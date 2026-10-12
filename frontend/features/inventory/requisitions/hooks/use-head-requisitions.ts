import { useLoader } from '../../_shared/hooks/use-async';
import type { HistoryMine, HistoryMineQuery, Home, RequisitionFile } from '../_shared/types/requisitions-contract';
import { requisitionsApi } from '../services/requisitions-phone-api';
import { useBadgesNudge } from './use-badges-nudge';

/** R7: the head's Requisitions home. Reloads when the Branch Manager or the store changes something. */
export function useHeadHome() {
  const loader = useLoader<Home>('req-home', () => requisitionsApi.home(), 'Could not load requisitions.');
  useBadgesNudge(() => void loader.reload());
  return loader;
}

/** R3: the file, as a head sees it (own department only, no money). Reloads on a nudge, so "the manager changed a line" shows at once. */
export function useHeadFile(id: string) {
  const loader = useLoader<RequisitionFile>(`req-file:${id}`, () => requisitionsApi.file(id), 'Could not load this requisition.');
  useBadgesNudge(() => void loader.reload());
  return loader;
}

/** R9: the head's past requisitions. The key carries every filter so a change reloads. */
export function useHistoryMine(query: HistoryMineQuery) {
  const key = `req-history:${query.from ?? ''}:${query.to ?? ''}:${query.status ?? ''}:${query.page ?? 1}:${query.pageSize ?? 25}`;
  const loader = useLoader<HistoryMine>(key, () => requisitionsApi.historyMine(query), 'Could not load your past requisitions.');
  useBadgesNudge(() => void loader.reload());
  return loader;
}
