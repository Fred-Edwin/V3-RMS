/**
 * Usual recipes: the one copy table for every state (Paper step 42 `1UXT-0`, "Usual recipes, states").
 * Screens read their words from here; nothing is written inline.
 */
export const RECIPES_COPY = {
  empty: {
    title: 'No usual recipes yet',
    description: 'Set one so runs are judged against it.',
  },
  filteredEmpty: {
    title: 'No recipes match',
    description: 'Nothing fits these filters. Clear them to see every prepped item.',
    action: 'Clear filters',
  },
  error: {
    title: 'Couldn’t load the usual recipes',
    description: 'Try again.',
  },
  loadingLabel: 'Loading the usual recipes',
  permission: {
    title: 'Not available for your role',
    description: 'Usual recipes are not available for your role.',
  },
  saveError: {
    title: 'Not saved',
    description: 'Nothing changed. Try again.',
  },
  drawerLoadError: 'Couldn’t load this recipe. Try again.',
} as const;

export const RECIPES_HELP =
  'How it works: write the recipe once, for one batch. The system scales the target to any batch size. 10 kg chicken gives 38 portions, so 20 kg should give about 76.';

export const SHOW_OPTIONS = [
  { value: 'all', label: 'All recipes' },
  { value: 'has', label: 'With a recipe' },
  { value: 'none', label: 'Without a recipe' },
] as const;

export const CHANGED_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'older', label: 'Older than 30 days' },
] as const;
