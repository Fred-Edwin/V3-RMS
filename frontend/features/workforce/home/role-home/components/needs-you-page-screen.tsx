'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { MobileTopbar } from '@/components/app/shell/mobile-topbar';
import { Topbar } from '@/components/app/shell/topbar';
import { TopbarBell } from '@/components/app/shell/topbar-bell';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { Picker } from '@/components/ui2/picker';
import { SearchInput } from '@/components/ui2/search-input';
import { useAuthStore } from '@/store/authStore';

import { EmptyState, FOCUS_RING, FilterChip, MOTION, initialsOf, onHover, useNow, useWorkforceNavDrawer } from '../../../_shared';
import { useUnreadStore } from '../../../notifications';
import { useNeedsYouPage } from '../hooks/use-needs-you-page';
import { needsYouPageLine, safeOpens, sinceWords } from '../lib/role-home-words';
import type { NeedsYouPage } from '../types/role-home-types';
import { HomeError, HomeLoading, HomeNothingWaiting } from './home-states';

// The Kind and Site lists are one bordered box each with the label inside (Paper 1.12); the picker's own border is dropped.
const SELECT = cn('h-[30px] border-0 bg-transparent pl-0 pr-3 font-wds-sans text-[13px] text-wds-text-ink', MOTION, FOCUS_RING);
const FILTER_BOX = 'flex h-8 items-center gap-1.5 border border-wds-border-strong bg-wds-surface pl-3 font-wds-sans text-[13px] leading-4 text-wds-text-secondary';
const ACTION = cn('inline-flex h-7 items-center border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'));

function Rows({ page }: { page: NeedsYouPage }) {
  const now = useNow();
  return (
    <table className="w-full table-fixed border-collapse border-t border-t-wds-neutral-800 text-left">
      <thead>
        <tr className="h-8 border-b border-wds-neutral-100 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">
          <th scope="col" className="w-[162px] py-0 pl-3 font-normal">KIND</th>
          <th scope="col" className="py-0 font-normal">REQUEST</th>
          <th scope="col" className="w-[150px] py-0 font-normal">SITE</th>
          <th scope="col" className="w-[150px] py-0 font-normal">WHERE YOU DECIDE</th>
          <th scope="col" className="w-[92px] py-0 pr-3 text-right font-normal">SINCE</th>
        </tr>
      </thead>
      <tbody>
        {page.rows.map((r) => (
          <tr key={r.id} className="h-[52px] border-b border-wds-neutral-100">
            <td className="py-1.5 pl-3 align-middle">
              <span className={cn('flex items-center gap-2 font-wds-sans text-[13px] leading-4', r.overdue ? 'font-medium text-wds-error-fg' : 'text-wds-text-ink')}>
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', r.overdue ? 'bg-wds-error-fg' : 'bg-wds-warning-fg')} />
                {r.overdue ? 'Overdue' : r.kindLabel}
              </span>
            </td>
            <td className="py-1.5 align-middle">
              <div className="flex flex-col gap-0.5">
                <span className="block font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{r.text}</span>
                <span className="block font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.line}</span>
              </div>
            </td>
            <td className="py-1.5 align-middle font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.siteName ?? ''}</td>
            <td className="py-1.5 align-middle">
              <Link href={safeOpens(r.opens)} className={ACTION}>
                {r.action}
              </Link>
            </td>
            <td className={cn('py-1.5 pr-3 text-right align-middle font-wds-mono text-[11px] leading-[14px]', r.overdue ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>{sinceWords(r.since, now)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Needs you, "See all" (Paper 1.12), `/app/workforce/needs-you`: every item that waits for the person, one per row, overdue first, with
 * a search, a chip per kind with its count, a Kind and a Site list, and a numbered pager with rows per page. The server filters and pages.
 * The row's button opens the page where it is decided.
 */
export function NeedsYouPageScreen() {
  const user = useAuthStore((s) => s.user);
  const { open: openMenu } = useWorkforceNavDrawer();
  const unread = useUnreadStore((s) => s.unread);
  const { filters, change, remote } = useNeedsYouPage();
  const page = remote.data;
  const kinds = page ? page.groups.filter((g) => g.key !== 'overdue').length : 0;
  const nothingAtAll = page !== null && page.all === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ root: 'Workforce', section: 'Overview', sectionHref: '/app/workforce', screen: 'Needs you' }}
        hideSearch
        actions={<TopbarBell href="/app/workforce/notifications" unread={unread} />}
        className="hidden lg:flex"
      />
      <MobileTopbar title="Needs you" orgLabel={(user?.organizationName ?? 'COMPANY').toUpperCase()} initials={initialsOf(user?.name ?? '')} onMenuClick={openMenu} className="lg:hidden" />
      <main aria-label="Needs you" className="min-h-0 flex-1 overflow-y-auto bg-wds-canvas">
        <div className="flex flex-col gap-4 px-4 pb-10 pt-6 md:px-8 md:pt-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-wds-sans text-[26px] font-semibold leading-8 tracking-[-0.02em] text-wds-text-ink">Needs you</h1>
            {page ? <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{needsYouPageLine(page.all, kinds)}</p> : null}
          </div>

          {remote.status === 'error' && !page ? (
            <HomeError error={remote.error} onRetry={remote.reload} />
          ) : !page ? (
            <HomeLoading />
          ) : nothingAtAll ? (
            <HomeNothingWaiting />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  value={filters.q}
                  onChange={(e) => change({ q: e.target.value })}
                  placeholder="Search a person or request"
                  aria-label="Search a person or request"
                  shortcutHint=""
                  className="w-[260px] max-w-full"
                />
                <FilterChip label="All" count={page.all} selected={filters.group === ''} onClick={() => change({ group: '' })} />
                {page.groups.map((g) => (
                  <FilterChip
                    key={g.key}
                    label={g.label}
                    count={g.count}
                    selected={filters.group === g.key}
                    onClick={() => change({ group: filters.group === g.key ? '' : g.key })}
                    className={g.key === 'overdue' && filters.group !== g.key ? 'border-wds-error-fg text-wds-error-fg' : undefined}
                  />
                ))}
                <span className="ml-auto flex items-center gap-2">
                  <span className={FILTER_BOX}>
                    Kind
                    <Picker
                      value={filters.group}
                      onValueChange={(v) => change({ group: v })}
                      options={[{ value: '', label: 'All' }, ...page.groups.map((g) => ({ value: g.key, label: g.label }))]}
                      aria-label="Kind"
                      chips={false}
                      className={SELECT}
                    />
                  </span>
                  <span className={FILTER_BOX}>
                    Site
                    <Picker
                      value={filters.siteId}
                      onValueChange={(v) => change({ siteId: v })}
                      options={[{ value: '', label: 'All' }, ...page.sites.map((s) => ({ value: s.id, label: s.name }))]}
                      aria-label="Site"
                      chips={false}
                      className={SELECT}
                    />
                  </span>
                </span>
              </div>

              {remote.status === 'error' ? <HomeError error={remote.error} onRetry={remote.reload} className="border-t-0 pt-0" /> : null}
              {page.total === 0 ? (
                <EmptyState kind="nothingFound" title="Nothing matches" line="Clear the search or the filters to see everything that needs you." action={{ label: 'Clear filters', onClick: () => change({ q: '', group: '', siteId: '' }) }} />
              ) : (
                <div className={cn(remote.status === 'error' && 'opacity-70')}>
                  <Rows page={page} />
                  <TablePager
                    page={filters.page}
                    perPage={filters.pageSize}
                    shown={page.rows.length}
                    total={page.total}
                    onPageChange={(p) => change({ page: p })}
                    onPerPageChange={(n) => change({ pageSize: n, page: 1 })}
                    variant="paper"
                    className="px-3"
                  />
                </div>
              )}
              {page.partial ? <p role="status" className="m-0 font-wds-sans text-[12px] text-wds-warning-fg">Some requests could not be loaded. Try again.</p> : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
