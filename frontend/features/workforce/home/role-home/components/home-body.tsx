'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import type { RemoteError } from '../../../_shared';
import { HomeKpiCards } from './home-kpi-cards';
import { HomeLatestList } from './home-latest';
import { HomeNeedsYouTable } from './home-needs-you-table';
import { HomeError, HomeNothingWaiting } from './home-states';
import type { HomeView } from '../types/role-home-types';

/**
 * Everything under the greeting on Home, for every role (Paper 1.1 to 1.11): the number cards, then "Needs you" beside "Latest" on a
 * desktop (stacked on a phone). A person with no Needs you list (staff, heads) gets the cards and Latest, and the registered action
 * cards (clock, team today, this week) are passed in as `actions`. `stale` greys the page when a refresh failed after a good answer.
 */
export interface HomeBodyProps {
  view: HomeView;
  phone: boolean;
  actions?: React.ReactNode;
  refreshError?: RemoteError | null;
  onRetry: () => void;
  onMarkAllRead: () => void;
  markingRead?: boolean;
}

export function HomeBody({ view, phone, actions, refreshError, onRetry, onMarkAllRead, markingRead }: HomeBodyProps) {
  const needs = view.needsYou;
  const latest = phone ? view.latest.slice(0, 3) : view.latest;
  return (
    <div className={cn('flex flex-col', phone ? 'gap-5' : 'gap-6', refreshError && 'opacity-70')}>
      {refreshError ? <HomeError error={refreshError} onRetry={onRetry} className="border-t-0 pt-0" /> : null}
      <HomeKpiCards kpis={view.kpis} phone={phone} />
      {actions}
      <div className={cn('flex gap-8', phone ? 'flex-col' : 'flex-col xl:flex-row xl:items-start')}>
        {needs ? (
          <div className="min-w-0 grow basis-0">{needs.total > 0 ? <HomeNeedsYouTable needs={needs} phone={phone} /> : <HomeNothingWaiting />}</div>
        ) : null}
        {latest.length > 0 ? (
          <div className={cn('shrink-0', !phone && 'xl:w-[340px]', !needs && !phone && 'xl:grow')}>
            <HomeLatestList items={latest} onMarkAllRead={onMarkAllRead} busy={markingRead} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
