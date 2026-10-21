'use client';

import { useMemo } from 'react';

import { NeedsYouCard, OverdueCard, useNeedsYou, useOverdue, type NeedsYouState, type OverdueState } from '../../needs-you';
import { defineHomeCard, type CardDataState } from '../lib/card-registry';

/**
 * "Needs you" and "Overdue" (Segment 6a, Paper Chapter 15). They replace "Waiting for you", "Overdue approvals" and the pay run steps:
 * one card of what waits for THIS person's decision, oldest first, the same rows the menu badges count. The server decides who has rows
 * (the Director only their own plus Overdue); a card with no rows is not drawn. Seen by whoever holds `needs_you.read`.
 */

function stateOf<T extends { status: string }>(remote: T, ready: boolean): CardDataState<T> {
  if (remote.status === 'loading') return { status: 'loading' };
  if (remote.status === 'error' && !ready) return { status: 'error' };
  return { status: 'ready', data: remote };
}

function useNeedsYouCardData(): CardDataState<NeedsYouState> {
  const state = useNeedsYou(true);
  return useMemo((): CardDataState<NeedsYouState> => {
    const base = stateOf(state, state.list !== null);
    return base.status === 'error' ? { status: 'error', retry: state.reload } : base;
  }, [state]);
}

function useOverdueCardData(): CardDataState<OverdueState> {
  const state = useOverdue(true);
  return useMemo((): CardDataState<OverdueState> => {
    const base = stateOf(state, state.data !== null);
    return base.status === 'error' ? { status: 'error', retry: state.reload } : base;
  }, [state]);
}

export const needsYouCard = defineHomeCard<NeedsYouState>({
  id: 'workforce.needs-you',
  title: 'Needs you',
  surfaces: ['desktop'],
  slot: 'main',
  anyCapability: ['needs_you.read'],
  // First in the stack: it is the Home's headline for these roles.
  order: 5,
  isEmpty: (d) => (d.list?.rows.length ?? 0) === 0,
  useData: useNeedsYouCardData,
  Card: ({ data }) => <NeedsYouCard state={data} />,
});

export const needsYouPhoneCard = defineHomeCard<NeedsYouState>({
  id: 'workforce.needs-you.phone',
  title: 'Needs you',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['needs_you.read'],
  order: 20,
  isEmpty: (d) => (d.list?.rows.length ?? 0) === 0,
  useData: useNeedsYouCardData,
  Card: ({ data }) => <NeedsYouCard state={data} phone />,
});

export const overdueCard = defineHomeCard<OverdueState>({
  id: 'workforce.overdue',
  title: 'Overdue',
  surfaces: ['desktop'],
  slot: 'main',
  anyCapability: ['needs_you.remind'],
  order: 6,
  isEmpty: (d) => (d.data?.rows.length ?? 0) === 0,
  useData: useOverdueCardData,
  Card: ({ data }) => <OverdueCard state={data} />,
});
