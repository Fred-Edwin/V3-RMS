'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { DateRange } from '@/components/ui2/date-range-picker';
import { effectiveRange, nairobiToday, presetRange, type DatePreset } from '@/components/ui2/data-table/table-dates';

/**
 * URL state for the Attendant's phone lists (My counts, My waste): the date range (`from`, `to`, Nairobi days), the page, and any
 * other filter keys the screen names. A hand-edited or half-written range falls back to `startingPreset`, so the screen always has
 * a real range. `setQuery` changes the URL in place (no history entry per click) and clears the page unless the patch sets it.
 */
export function usePhoneListParams(startingPreset: Exclude<DatePreset, 'any' | 'today'>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [today] = React.useState(() => nairobiToday());
  const fromParam = params.get('from') ?? '';
  const toParam = params.get('to') ?? '';
  const range: DateRange = React.useMemo(() => {
    const chosen = effectiveRange({ from: fromParam, to: toParam }, { fromKey: 'from', toKey: 'to' }, startingPreset, today);
    return chosen ?? (presetRange(startingPreset, today) as DateRange);
  }, [fromParam, toParam, startingPreset, today]);
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1);

  const setQuery = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      if (!('page' in patch)) next.delete('page');
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  return { today, range, page, params, setQuery };
}
