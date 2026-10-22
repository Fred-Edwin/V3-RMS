'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { SearchInput } from '@/components/ui2/search-input';
import { SheetTitle } from '@/components/ui2/sheet';

import { EmptyState, ErrorBlock, FOCUS_RING, FilterChip, ListSkeleton, MOTION, onHover, useNow } from '../../_shared';
import { useNotificationPage } from '../hooks/use-notification-page';
import { AREA_LABEL, unreadLine } from '../lib/notification-words';
import type { NotificationArea, NotificationPage, NotificationQuery, WorkforceNotification } from '../types/notification-types';
import { NotificationDays } from './notification-rows';

/** How long typing in the search box waits before the list is asked again. */
const SEARCH_WAIT_MS = 250;

/** Debounces what is typed so every keystroke does not go to the server. */
function useDebounced(value: string, wait: number): string {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), wait);
    return () => window.clearTimeout(id);
  }, [value, wait]);
  return settled;
}

interface ChipsProps {
  data: NotificationPage;
  query: NotificationQuery;
  phone: boolean;
  onAll: () => void;
  onUnread: () => void;
  onArea: (area: NotificationArea) => void;
}

/** All, Unread, then one chip per area the person has rows in. "All" clears every filter; Unread and an area can be combined. */
function Chips({ data, query, phone, onAll, onUnread, onArea }: ChipsProps) {
  const size = phone ? 'h-9 text-[14px]' : 'h-7';
  const none = !query.unreadOnly && query.area === null;
  return (
    <div role="group" aria-label="Filter notifications" className={cn('flex gap-1.5', phone ? '-mr-4 overflow-x-auto pb-0.5 pr-4' : 'flex-wrap')}>
      <FilterChip label="All" count={data.all} selected={none} onClick={onAll} className={cn('shrink-0 px-2.5', size)} />
      <FilterChip label="Unread" count={data.unread} selected={query.unreadOnly} onClick={onUnread} className={cn('shrink-0 px-2.5', size)} />
      {data.areas.map((a) => (
        <FilterChip
          key={a.area}
          label={AREA_LABEL[a.area]}
          count={a.count}
          selected={query.area === a.area}
          onClick={() => onArea(a.area)}
          className={cn('shrink-0 px-2.5', size, a.area === 'SECURITY' && query.area !== a.area && 'text-wds-error-fg')}
        />
      ))}
    </div>
  );
}

/** The Previous / "Page 1 of 2" / Next row of the phone page (44 px buttons). */
function PhonePager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const button = cn('flex h-11 w-24 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[14px] disabled:cursor-not-allowed disabled:text-wds-neutral-400', MOTION, FOCUS_RING);
  return (
    <nav aria-label="Pagination" className="flex shrink-0 items-center justify-between gap-3 border-t border-wds-border bg-wds-canvas px-4 pb-3.5 pt-2.5">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={button}>
        Previous
      </button>
      <p aria-live="polite" className="m-0 font-wds-mono text-xs leading-4 text-wds-text-secondary">
        Page {page} of {pages}
      </p>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(button, 'font-medium text-wds-text-ink')}>
        Next
      </button>
    </nav>
  );
}

export interface NotificationListProps {
  /** `drawer` is the desktop panel (header drawn here, numbered pager); `page` is the phone page (the shell draws the top bar). */
  variant: 'drawer' | 'page';
  /** The drawer's close button, drawn at the right of its header. */
  closeSlot?: React.ReactNode;
  /** Called when a row with a link is used, so the drawer can close before the page opens. */
  onLeave?: () => void;
  /** Reads and refreshes only while true (the drawer is mounted all the time but closed). */
  active?: boolean;
}

/**
 * The notifications (Paper 13.1 drawer, 13.2 phone page): a search, chips (All, Unread, one per area), the rows under day headings and
 * a pager. The server filters and pages (`q`, `area`, `unread`, `page`); the counts on the chips are the person's whole set. Using a row
 * marks it read; "Mark all read" marks everything.
 */
export function NotificationList({ variant, closeSlot, onLeave, active = true }: NotificationListProps) {
  const phone = variant === 'page';
  const now = useNow();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [area, setArea] = React.useState<NotificationArea | null>(null);
  const [typed, setTyped] = React.useState('');
  const q = useDebounced(typed, SEARCH_WAIT_MS);
  const query = React.useMemo<NotificationQuery>(() => ({ page, pageSize, unreadOnly, area, q }), [page, pageSize, unreadOnly, area, q]);
  const list = useNotificationPage(query, active);
  const data = list.data;
  const items = data?.items ?? [];
  const filtered = unreadOnly || area !== null || q.trim() !== '';

  const change = (next: { unreadOnly?: boolean; area?: NotificationArea | null }): void => {
    if (next.unreadOnly !== undefined) setUnreadOnly(next.unreadOnly);
    if (next.area !== undefined) setArea(next.area);
    setPage(1);
  };
  const clearAll = (): void => {
    setTyped('');
    change({ unreadOnly: false, area: null });
  };
  const use = (n: WorkforceNotification): void => {
    if (!n.read) void list.markRead([n.id]);
    if (n.href) onLeave?.();
  };

  const unread = data?.unread ?? 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const markAll = (
    <button
      type="button"
      disabled={unread === 0}
      onClick={() => void list.markAllRead()}
      className={cn('font-wds-sans font-medium leading-[18px] text-wds-warning-fg disabled:opacity-50', phone ? 'h-8 text-sm' : 'text-[13px]', MOTION, FOCUS_RING, onHover('underline'))}
    >
      Mark all read
    </button>
  );

  const body = (): React.ReactNode => {
    if (list.status === 'loading') return <div className="p-4"><ListSkeleton rows={5} /></div>;
    if (list.status === 'error' && !data) return <div className="p-4"><ErrorBlock title="We could not load your notifications." line="Nothing was changed." onRetry={list.reload} /></div>;
    if (data && data.all === 0) return <EmptyState kind="nothingYet" title="No notifications yet" line="When something changes for you (a request answered, a payslip published), it shows here." className="m-4" />;
    if (items.length === 0 && unreadOnly && area === null && q.trim() === '') {
      return (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <svg aria-hidden width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-wds-success-fg">
            <circle cx="12" cy="12" r="10" />
            <path d="M7.5 12.5l3 3 6-6.5" />
          </svg>
          <h3 className="m-0 font-wds-sans text-base font-semibold leading-5 text-wds-text-ink">You&apos;re all caught up</h3>
          <p className="m-0 font-wds-sans text-xs leading-[18px] text-wds-text-secondary">Nothing is unread. Earlier notifications stay under All.</p>
          <button type="button" onClick={() => change({ unreadOnly: false })} className={cn('mt-1 font-wds-sans text-[13px] font-medium text-wds-warning-fg', MOTION, FOCUS_RING, onHover('underline'))}>
            Show all
          </button>
        </div>
      );
    }
    if (items.length === 0) {
      return <EmptyState kind="nothingFound" title="Nothing matches" line="Clear the search or the filters to see everything." action={{ label: 'Clear filters', onClick: clearAll }} className="m-4" />;
    }
    return (
      <div className={cn(list.status === 'error' && 'opacity-60')}>
        {list.status === 'error' ? <p role="alert" className="m-0 px-5 py-2 font-wds-sans text-xs leading-4 text-wds-warning-fg">We could not refresh. The list shown is the last we had.</p> : null}
        <NotificationDays items={items} now={now} phone={phone} onUse={use} />
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {phone ? null : (
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-wds-border px-5">
          <div className="flex grow flex-col">
            <SheetTitle asChild>
              <h2 className="m-0 font-wds-sans text-lg font-semibold leading-6 tracking-[-0.01em] text-wds-text-ink">Notifications</h2>
            </SheetTitle>
            <p aria-live="polite" className="m-0 font-wds-sans text-xs leading-4 text-wds-text-secondary">
              {unreadLine(unread)}
            </p>
          </div>
          {markAll}
          {closeSlot}
        </div>
      )}
      <div className={cn('flex shrink-0 flex-col gap-2.5 border-b border-wds-border', phone ? 'px-4 pb-3 pt-3.5' : 'px-5 pb-3 pt-3.5')}>
        <SearchInput
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setPage(1);
          }}
          placeholder="Search notifications"
          aria-label="Search notifications"
          shortcutHint=""
          className={cn('w-full', phone && 'h-11 px-3.5 [&_input]:text-[15px]')}
        />
        {data ? <Chips data={data} query={query} phone={phone} onAll={() => change({ unreadOnly: false, area: null })} onUnread={() => change({ unreadOnly: !unreadOnly })} onArea={(a) => change({ area: area === a ? null : a })} /> : null}
        {phone ? (
          <div className="flex items-center justify-between">
            <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{data ? (filtered ? `${data.total} of ${data.all} shown` : `${data.all} ${data.all === 1 ? 'notification' : 'notifications'}`) : ' '}</p>
            {markAll}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{body()}</div>
      {data && data.total > 0 ? (
        phone ? (
          <PhonePager page={data.page} pages={pages} onPage={setPage} />
        ) : (
          <TablePager
            page={data.page}
            perPage={pageSize}
            shown={items.length}
            total={data.total}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            variant="paper"
            className="shrink-0 border-t border-wds-border px-5"
          />
        )
      ) : null}
    </div>
  );
}
