/**
 * The Prep states kit: one reusable loading, empty, error and locked treatment, and this table is the per-screen wording
 * (Paper step 23). Never a state design per screen.
 */
export const PREP_STATES_COPY = {
  home: {
    errorTitle: "Couldn't load Prep",
    errorDescription: 'Check your connection and try again.',
  },
  prepAgain: {
    emptyTitle: 'No prep runs yet',
    emptyDescription: 'Pick "Something else" to record the first one. It will show here next time.',
  },
  recentRuns: {
    emptyTitle: 'No runs recorded yet',
    emptyDescription: 'Runs you record show up here, newest first.',
    errorTitle: "Couldn't load recent runs",
  },
  runs: {
    emptyTitle: 'No prep runs found',
    emptyDescription: 'Runs recorded at the Central Store show up here.',
    filteredEmptyTitle: 'No runs match',
    filteredEmptyDescription: 'Try a different search or clear the filters.',
    errorTitle: "Couldn't load runs",
  },
  record: {
    outputsErrorTitle: "Couldn't load the prepped items",
    outputsEmptyTitle: 'No prepped items yet',
    outputsEmptyDescription: 'Add a prepped item in the Catalog first, then record a run for it.',
    outputNotFoundTitle: "That item can't be prepped",
    outputNotFoundDescription: 'It may have been retired. Pick another item.',
    saveFailed: "Couldn't record the run. Nothing was saved. Try again.",
    checkFailed: "Couldn't check the yield. You can still record the run.",
  },
  locked: {
    title: 'Ask the Store Manager',
    description: 'This run is more than 24 hours old, so only the Store Manager can change it.',
  },
} as const;

/** The yield-reason chips on the confirm step (Paper step 7). */
export const YIELD_REASONS = [
  { value: 'TRIMMED_MORE', label: 'Trimmed more' },
  { value: 'SPILLAGE', label: 'Spillage' },
  { value: 'BURNT', label: 'Burnt' },
  { value: 'OTHER', label: 'Other' },
] as const;
