'use client';

import * as React from 'react';

import { useLoader } from '../../../_shared/hooks/use-async';
import { listRecipes } from '../../recipes/services/recipes-api-service';
import { prepApi } from '../../_shared/services/prep-api';

export interface FilterOptions {
  outputs: { value: string; label: string }[];
  people: { value: string; label: string }[];
}

const EMPTY: FilterOptions = { outputs: [], people: [] };

/**
 * The choices behind the Output and Person filters, for anyone holding `prep.read`. Outputs are every live prepped item (the Usual
 * recipes list, which has one row per item); people are whoever recorded one of the latest 100 runs, because the contract has no
 * "people" endpoint. Loaded once per screen, and a failure only leaves the dropdowns short, never blocks the table.
 */
export function useFilterOptions(): FilterOptions {
  const loader = useLoader(
    'prep-filter-options',
    async (): Promise<FilterOptions> => {
      const [recipes, runs] = await Promise.all([listRecipes({ perPage: 100 }), prepApi.listRuns({ perPage: 100 })]);
      const people = new Map<string, string>();
      for (const run of runs.items) people.set(run.by.id, run.by.name);
      return {
        outputs: recipes.items.map((row) => ({ value: row.itemId, label: row.itemName })).sort((a, b) => a.label.localeCompare(b.label)),
        people: Array.from(people, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
      };
    },
    'Could not load the filters.'
  );
  return React.useMemo(() => loader.data ?? EMPTY, [loader.data]);
}
