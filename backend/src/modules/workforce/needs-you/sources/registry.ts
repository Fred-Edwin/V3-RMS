import type { NeedsYouSource } from '../needs-you-types';

const sources = new Map<string, NeedsYouSource>();

/**
 * The pluggable registry (6b N5). Segments 4 and 5 call this at start-up with their own source; an empty registry is valid.
 * Registering an id twice replaces the first (so a test or a hot reload never doubles rows).
 */
export function registerNeedsYouSource(source: NeedsYouSource): void {
  sources.set(source.id, source);
}

export const registeredSources = (): NeedsYouSource[] => [...sources.values()];

/** Kind order for ties: the order sources were registered, then each source's own `kinds`. */
export const kindOrder = (): string[] => registeredSources().flatMap((s) => [...s.kinds]);

export const sourceForRow = (rowId: string): NeedsYouSource | undefined => registeredSources().find((s) => s.kinds.some((k) => rowId.startsWith(`${k}:`)));

/** Tests only: start from an empty registry. */
export const clearNeedsYouSources = (): void => sources.clear();
