import { useMemo } from 'react';

import { listItems } from '../../../services';
import { useLoader } from '../../../_shared/hooks/use-async';

export interface IngredientOption {
  itemId: string;
  name: string;
  unit: string;
}

const PER_PAGE = 100;
const MAX_PAGES = 5;

/** Every live catalog item (raw, stocked or prepped) an ingredient can be picked from, loaded once when the drawer opens. */
export function useIngredientOptions(enabled: boolean) {
  const loader = useLoader<IngredientOption[]>(
    enabled ? 'ingredient-options' : null,
    async () => {
      const out: IngredientOption[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = await listItems({ page, perPage: PER_PAGE, sort: 'name' });
        for (const row of res.data) out.push({ itemId: row.id, name: row.name, unit: row.usageUnit });
        if (page >= res.pagination.totalPages) break;
      }
      return out;
    },
    'Couldn’t load the item list.'
  );
  const options = useMemo(() => loader.data ?? [], [loader.data]);
  return { options, status: loader.status, error: loader.error };
}
