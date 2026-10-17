import * as React from 'react';

import type { WorkforceCapability } from './capabilities';

/**
 * The Home card registry (Paper Chapter 1, step 04: "Home is a stack of cards. Every module brings its own."; `docs/ROADMAP.md` rule 8).
 *
 * A slice registers a card here: who may see it (by capability, never by role name), where it sits, how urgent it is, its data hook and
 * the component that draws it. The page renders the registered cards the person may see, most urgent first, and leaves out a card with
 * nothing to show (no data source yet, or an empty answer). When nothing is left, the page shows the States kit's empty state.
 *
 * This file is pure (no hooks, no DOM) so ordering, omission, capability visibility and the empty state are tested directly.
 * Registering a card is `registerHomeCard(defineHomeCard({ ... }))` in the slice's own file, imported from `../cards/index.ts`.
 */

/** Desktop is the five-role Home; phone is the stack for staff, a department head and a manager on a phone. */
export type HomeSurface = 'desktop' | 'phone';

/**
 * Where a card sits on the desktop page (the phone is one stack in rank order).
 * - `kpi`   the strip of numbers under the greeting (only the first `kpi` card is drawn as the strip; slices add cells through it)
 * - `main`  the wide left column
 * - `side`  the narrow right column
 * - `wide`  full width below the columns
 */
export type HomeSlot = 'kpi' | 'main' | 'side' | 'wide';

export type CardDataState<T> =
  /** Nothing feeds this card yet. The card is left out, not drawn empty. */
  | { status: 'no-source' }
  | { status: 'loading' }
  | { status: 'error'; retry?: () => void }
  /** `data` must be the same object between renders unless it changed (a query result), or the page re-sorts on every render. */
  | { status: 'ready'; data: T };

export interface HomeCardDefinition<T> {
  /** Stable id: `workforce.waiting-for-you`. The ledger (`docs/features/workforce/chapter-1-ledger.md`) lists it. */
  id: string;
  /** Spoken name, used for the error state and the section label. */
  title: string;
  surfaces: readonly HomeSurface[];
  slot: HomeSlot;
  /** The person sees the card when they hold at least one of these. An empty list means everyone who is signed in. */
  anyCapability: readonly WorkforceCapability[];
  /** The card's place in Paper's stack (lower first). Also the tie-break between equal urgencies. */
  order: number;
  /** Lower is more urgent, on the same scale as `order`. A clock-in that is due returns a number below the shift card's `order`. Default: `order`. */
  urgency?: (data: T) => number;
  /** True when there is nothing to show; the card then disappears. */
  isEmpty: (data: T) => boolean;
  useData: () => CardDataState<T>;
  Card: React.ComponentType<{ data: T; surface: HomeSurface }>;
}

/** The type-erased card the registry holds, so cards with different data share one list. The one cast sits in `defineHomeCard`. */
export interface HomeCard {
  id: string;
  title: string;
  surfaces: readonly HomeSurface[];
  slot: HomeSlot;
  anyCapability: readonly WorkforceCapability[];
  order: number;
  useData: () => CardDataState<unknown>;
  rank: (data: unknown) => number;
  isEmpty: (data: unknown) => boolean;
  render: (data: unknown, surface: HomeSurface) => React.ReactElement;
}

export function defineHomeCard<T>(def: HomeCardDefinition<T>): HomeCard {
  return {
    id: def.id,
    title: def.title,
    surfaces: def.surfaces,
    slot: def.slot,
    anyCapability: def.anyCapability,
    order: def.order,
    useData: () => def.useData() as CardDataState<unknown>,
    rank: (data) => (def.urgency ? def.urgency(data as T) : def.order),
    isEmpty: (data) => def.isEmpty(data as T),
    render: (data, surface) => React.createElement(def.Card, { data: data as T, surface }),
  };
}

// ── The registry ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const registry = new Map<string, HomeCard>();

/** Adds a card. A second card with the same id is a mistake (two slices fighting over one place), so it throws. */
export function registerHomeCard(card: HomeCard): void {
  if (registry.has(card.id)) throw new Error(`Home card "${card.id}" is registered twice`);
  registry.set(card.id, card);
}

/** Every registered card, in Paper's order. */
export function getHomeCards(): readonly HomeCard[] {
  return Array.from(registry.values()).sort((a, b) => a.order - b.order);
}

/** Test seam: start from an empty registry. */
export function resetHomeCardsForTests(): void {
  registry.clear();
}

// ── Pure rules ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Whether this person may see this card on this surface: by capability only. */
export function canSeeCard(card: HomeCard, surface: HomeSurface, can: (capability: WorkforceCapability) => boolean): boolean {
  if (!card.surfaces.includes(surface)) return false;
  return card.anyCapability.length === 0 || card.anyCapability.some(can);
}

export function visibleCards(cards: readonly HomeCard[], surface: HomeSurface, can: (capability: WorkforceCapability) => boolean): HomeCard[] {
  return cards.filter((card) => canSeeCard(card, surface, can));
}

export interface ArrangedCard {
  card: HomeCard;
  data: unknown;
  rank: number;
}

export interface ArrangedHome {
  /** Cards to draw, most urgent first. Error cards stay (the person needs to know it failed); empty and source-less cards are gone. */
  cards: ArrangedCard[];
  errors: HomeCard[];
  /** `loading`: nothing to draw yet and something is still loading. `empty`: nothing at all to show. `ready`: at least one card or error. */
  page: 'loading' | 'empty' | 'ready';
}

/**
 * Orders the visible cards by urgency and drops the ones with nothing to show.
 * `states` has one entry per visible card, in any order; a card with no entry yet counts as loading.
 */
export function arrangeHome(cards: readonly HomeCard[], states: Readonly<Record<string, CardDataState<unknown>>>): ArrangedHome {
  const shown: ArrangedCard[] = [];
  const errors: HomeCard[] = [];
  let loading = false;
  for (const card of cards) {
    const state = states[card.id] ?? { status: 'loading' as const };
    if (state.status === 'no-source') continue;
    if (state.status === 'loading') {
      loading = true;
      continue;
    }
    if (state.status === 'error') {
      errors.push(card);
      continue;
    }
    if (card.isEmpty(state.data)) continue;
    shown.push({ card, data: state.data, rank: card.rank(state.data) });
  }
  shown.sort((a, b) => a.rank - b.rank || a.card.order - b.card.order);
  const page = shown.length > 0 || errors.length > 0 ? 'ready' : loading ? 'loading' : 'empty';
  return { cards: shown, errors, page };
}

/** The drawn cards of one desktop slot, keeping the urgency order. */
export function inSlot(arranged: ArrangedHome, slot: HomeSlot): ArrangedCard[] {
  return arranged.cards.filter((a) => a.card.slot === slot);
}
