import { useCallback } from 'react';

import { getThresholds, getCountPrint, getVerifierCount, listCounts } from '../services/count-api-service';
import type { CountKind, CountList, CountPrint, Thresholds, VerifierCountView } from '../types/count';
import { useResource } from '../../stock/hooks/use-stock';

/** Store Manager: the counts list (rail / mobile list / hub Counts card). */
export function useCountList(kind?: CountKind, limit = 30, enabled = true) {
  const r = useResource<CountList>(enabled ? `counts:${kind ?? 'all'}:${limit}` : null, () => listCounts(kind, limit), "Couldn't load counts.");
  return { list: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

/**
 * One count's full verifier view. `seed` lets a mutation hand back the fresh
 * view without a refetch (the API returns it on every decide / return / approve).
 */
export function useVerifierCount(countId: string | null) {
  const r = useResource<VerifierCountView>(countId ? `count:${countId}` : null, () => getVerifierCount(countId as string), "Couldn't load this count.");
  return { count: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

export function useCountPrint(countId: string | null) {
  const r = useResource<CountPrint>(countId ? `count-print:${countId}` : null, () => getCountPrint(countId as string), "Couldn't load the verification document.");
  return { print: r.data, status: r.status, error: r.error, reload: r.reload };
}

/** Loads on open only (the drawer is mounted closed on the hub). */
export function useThresholds(enabled: boolean) {
  const fetcher = useCallback(() => getThresholds(), []);
  const r = useResource<Thresholds>(enabled ? 'thresholds' : null, fetcher, "Couldn't load thresholds.");
  return { thresholds: r.data, status: r.status, error: r.error, reload: r.reload };
}
