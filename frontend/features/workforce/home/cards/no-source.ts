import type { CardDataState } from '../lib/card-registry';

const NO_SOURCE: CardDataState<never> = { status: 'no-source' };

/**
 * The data hook of a card whose slice has not been built. The card is registered (who sees it, where it sits, how it looks) but leaves
 * the page until the slice swaps this for its real hook. Each swap is one line in the card's file and one tick in
 * `docs/features/workforce/chapter-1-ledger.md`. The answer is one constant object so the page does not re-arrange on every render.
 */
export const noSource =
  <T>() =>
  (): CardDataState<T> =>
    NO_SOURCE;
