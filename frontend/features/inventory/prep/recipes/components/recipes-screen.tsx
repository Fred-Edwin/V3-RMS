'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Topbar } from '@/components/app/shell/topbar';
import { LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import type { RecipeRow } from '../../_shared/types/prep-contract';
import { RECIPES_PER_PAGE, useRecipesList } from '../hooks/use-recipes';
import { PRESS_BUTTON } from '../lib/press';
import { RECIPES_COPY } from '../lib/recipes-states-copy';
import { RecipeDrawer } from './recipe-drawer';
import { RecipesListView, type ChangedFilter, type ShowFilter } from './recipes-list-view';

const SEARCH_DEBOUNCE_MS = 250;
const BREADCRUMB = { root: 'Central Store', section: 'Prep', screen: 'Usual recipes' } as const;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Usual recipes, the list (Paper step 24). Everyone with `prep.read` sees it; Edit, Set and "Set a recipe" show only
 * with `prep.recipes_write`. The list carries no costs, so there is nothing for `prep.see_costs` to hide here (the drawer shows one cost line).
 */
export function RecipesScreen() {
  const { can, ready } = usePermissions();
  const canRead = can('prep.read');
  const canWrite = can('prep.recipes_write');

  const [searchInput, setSearchInput] = React.useState('');
  const search = useDebounced(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [show, setShow] = React.useState<ShowFilter>('all');
  const [changed, setChanged] = React.useState<ChangedFilter>('any');
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<RecipeRow | null>(null);

  const { items, data, status, error, reload } = useRecipesList({ search: search || undefined, show, changed, page }, ready && canRead);

  const anyFilter = search !== '' || show !== 'all' || changed !== 'any';
  const clear = React.useCallback(() => {
    setSearchInput('');
    setShow('all');
    setChanged('any');
    setPage(1);
  }, []);

  if (!ready || !canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={BREADCRUMB} hideSearch className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          {!ready ? <LoadingState /> : <PermissionDeniedState title={RECIPES_COPY.permission.title} description={RECIPES_COPY.permission.description} />}
        </div>
      </div>
    );
  }

  const firstWithout = items.find((r) => r.recipe === null) ?? null;
  const setARecipe = () => {
    if (firstWithout) setOpen(firstWithout);
    else {
      setShow('none');
      setPage(1);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={BREADCRUMB}
        hideSearch
        actions={
          canWrite ? (
            <Button className={`px-3.5 ${PRESS_BUTTON}`} onClick={setARecipe}>
              Set a recipe
            </Button>
          ) : null
        }
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <RecipesListView
          loadStatus={status}
          error={error}
          data={data}
          rows={items}
          canWrite={canWrite}
          searchInput={searchInput}
          show={show}
          changed={changed}
          anyFilter={anyFilter}
          page={page}
          perPage={RECIPES_PER_PAGE}
          onSearch={(v) => {
            setSearchInput(v);
            setPage(1);
          }}
          onShow={(v) => {
            setShow(v);
            setPage(1);
          }}
          onChanged={(v) => {
            setChanged(v);
            setPage(1);
          }}
          onClear={clear}
          onRetry={() => void reload()}
          onOpen={setOpen}
          onPage={setPage}
        />
      </div>
      {canWrite ? (
        <RecipeDrawer
          itemId={open?.itemId ?? null}
          itemName={open?.itemName ?? ''}
          pastRunsAverageText={open?.pastRunsAverageText ?? null}
          onClose={() => setOpen(null)}
          onSaved={() => void reload()}
        />
      ) : null}
    </div>
  );
}
