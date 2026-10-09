import { useLoader } from '../../_shared/hooks/use-async';
import { useBlock2Nudge } from '../../_shared/hooks/use-block2-nudge';
import type { DispatchFile } from '../../dispatch/_shared/types/dispatch-contract';
import type { ConfirmPreview, CountView, ListDeliveries, ListDeliveriesQuery } from '../_shared/types/deliveries-contract';
import { deliveriesApi } from '../services/deliveries-phone-api';

/** V1: Deliveries waiting (D7) and My deliveries (G2). The key carries every filter so a change reloads. */
export function useDeliveriesList(query: ListDeliveriesQuery) {
  const key = `deliveries:${query.tab ?? 'waiting'}:${query.from ?? ''}:${query.to ?? ''}:${query.result ?? ''}:${query.page ?? 1}:${query.pageSize ?? 25}`;
  const loader = useLoader<ListDeliveries>(key, () => deliveriesApi.list(query), 'Could not load deliveries.');
  useBlock2Nudge(() => void loader.reload());
  return loader;
}

/**
 * V2: the blind count. Loaded once and NOT reloaded by a nudge: a reload would put the server's counts over what the person is
 * typing. The screen keeps its own typed values and sends them with the autosave.
 */
export function useCountView(id: string) {
  return useLoader<CountView>(`count:${id}`, () => deliveriesApi.countView(id), 'Could not load this delivery.');
}

/** V5: the summary where the sent figure first appears. */
export function useConfirmPreview(id: string) {
  return useLoader<ConfirmPreview>(`confirm-preview:${id}`, () => deliveriesApi.confirmPreview(id), 'Could not load the summary.');
}

/** The department's read-only delivery file (N3). */
export function useDeliveryFile(id: string) {
  const loader = useLoader<DispatchFile>(`delivery-file:${id}`, () => deliveriesApi.file(id), 'Could not load this delivery.');
  useBlock2Nudge(() => void loader.reload());
  return loader;
}
