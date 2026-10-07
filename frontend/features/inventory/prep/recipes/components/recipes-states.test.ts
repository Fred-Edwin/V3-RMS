import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import fixtures from '../../_shared/types/prep-contract.fixtures.json';
import type { RecipeDetail, RecipesList } from '../../_shared/types/prep-contract';
import { RECIPES_COPY } from '../lib/recipes-states-copy';
import { RecipeLineView } from './recipe-line';
import { RecipesListView, type RecipesListViewProps } from './recipes-list-view';

const list = fixtures.recipesList as RecipesList;
const noop = () => undefined;

const base: RecipesListViewProps = {
  loadStatus: 'ready',
  error: null,
  data: list,
  rows: list.items,
  canWrite: true,
  searchInput: '',
  show: 'all',
  changed: 'any',
  anyFilter: false,
  page: 1,
  perPage: 25,
  onSearch: noop,
  onShow: noop,
  onChanged: noop,
  onClear: noop,
  onRetry: noop,
  onOpen: noop,
  onPage: noop,
};
const html = (over: Partial<RecipesListViewProps>): string => renderToStaticMarkup(createElement(RecipesListView, { ...base, ...over }));

describe('Usual recipes list states', () => {
  it('loading shows skeleton rows and no data', () => {
    const out = html({ loadStatus: 'loading', rows: [], data: null });
    expect(out).toContain('Loading the usual recipes');
    expect(out).not.toContain('Marinated chicken');
  });

  it('rows show the recipe text, the no-recipe wording and the write buttons', () => {
    const out = html({});
    expect(out).toContain('10 kg chicken, cut · 1 kg garlic-ginger paste');
    expect(out).toContain('No recipe yet · judged on the average of past runs (about 3 kg)');
    expect(out).toContain('Edit the recipe for Marinated chicken');
    expect(out).toContain('Set the recipe for House sauce');
    expect(out).toContain('25 prepped items · 24 without a target');
  });

  it('read-only has no Edit or Set button', () => {
    const out = html({ canWrite: false });
    expect(out).toContain('10 kg chicken, cut');
    expect(out).not.toContain('Edit the recipe');
    expect(out).not.toContain('Set the recipe');
  });

  it('empty uses the copy table', () => {
    const out = html({ rows: [], data: { items: [], total: 0, totalItems: 0, withoutRecipe: 0 } });
    expect(out).toContain(RECIPES_COPY.empty.title);
    expect(out).toContain(RECIPES_COPY.empty.description);
    expect(out).not.toContain('Clear filters');
  });

  it('filtered-empty offers Clear filters', () => {
    const out = html({ rows: [], data: { items: [], total: 0, totalItems: 25, withoutRecipe: 24 }, anyFilter: true, searchInput: 'zzz' });
    expect(out).toContain(RECIPES_COPY.filteredEmpty.title);
    expect(out).toContain('Clear filters');
  });

  it('error says it could not load and offers Retry', () => {
    const out = html({ loadStatus: 'error', error: 'boom', rows: [], data: null });
    expect(out).toContain('Couldn’t load the usual recipes');
    expect(out).toContain('Retry');
  });
});

describe('RecipeLine (Catalog item, read-only)', () => {
  const detail: RecipeDetail = {
    itemId: 'chicken',
    itemName: 'Marinated chicken',
    unit: 'portions',
    current: {
      version: 2,
      targetYield: '38',
      lines: [
        { itemId: 'a', itemName: 'Chicken, cut', unit: 'kg', amount: '10', isMain: true },
        { itemId: 'b', itemName: 'Garlic-ginger paste', unit: 'kg', amount: '1', isMain: false },
      ],
      changedAt: '2026-10-08T08:00:00.000Z',
      changedBy: { id: 'u', name: 'Joseph Mwangi', initials: 'JM', roleLabel: 'Store Manager' },
      reason: null,
    },
    suggestFromLastRun: null,
    history: [],
  };
  const render = (props: Parameters<typeof RecipeLineView>[0]): string => renderToStaticMarkup(createElement(RecipeLineView, props));

  it('shows lines, main flag, target and who changed it', () => {
    const out = render({ detail, status: 'ready', canEdit: false });
    expect(out).toContain('10 kg · main');
    expect(out).toContain('Should give');
    expect(out).toContain('38 portions');
    expect(out).toContain('Changed 8 Oct by Joseph Mwangi');
    expect(out).toContain('Only the Store Manager and the System Admin can edit it');
  });

  it('shows the no-recipe, loading and error states', () => {
    expect(render({ detail: { ...detail, current: null }, status: 'ready', canEdit: false })).toContain('No usual recipe yet');
    expect(render({ detail: null, status: 'loading', canEdit: false })).toContain('Loading the usual recipe');
    expect(render({ detail: null, status: 'error', canEdit: false })).toContain('Couldn’t load the usual recipe');
  });
});
