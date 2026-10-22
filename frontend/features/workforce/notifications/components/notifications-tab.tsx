'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { TablePager } from '@/components/ui2/data-table/table-pager';

import { EmptyState, ErrorBlock, FOCUS_RING, InboxRow, ListSkeleton, MOTION, onHover, useNow } from '../../_shared';
import { plainQuery, useNotificationPage } from '../hooks/use-notification-page';
import { areaKind, safeHref, whenExact, whenWords } from '../lib/notification-words';

/**
 * The Inbox's Notifications tab (6b N6): the person's own Workforce notifications, newest first, in the kit's `InboxRow` (tone bar, area and
 * kind, when, title, text, one outlined action). Opening a row marks it read; "Mark all read" marks the page. Rows with no link get a
 * "Mark as read" action so nothing stays unread for want of somewhere to go. The texts come from the server and carry no pay figure.
 */
export function NotificationsTab() {
  const router = useRouter();
  const now = useNow();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const list = useNotificationPage(plainQuery(page, pageSize));
  const items = list.data?.items ?? [];
  const hasUnread = items.some((n) => !n.read);

  if (list.status === 'loading') return <div className="p-3"><ListSkeleton rows={4} /></div>;
  if (list.status === 'error' && !list.data) {
    return <div className="p-3"><ErrorBlock title="We could not load your notifications." line="Nothing was changed." onRetry={list.reload} /></div>;
  }
  if (items.length === 0) {
    return <div className="p-3"><EmptyState kind="nothingYet" title="No notifications yet" line="When something changes for you (a request answered, a payslip published), it shows here." /></div>;
  }

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div className="flex items-center justify-between">
        <h2 className="m-0 font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">Notifications</h2>
        <button
          type="button"
          disabled={!hasUnread}
          onClick={() => void list.markAllRead()}
          className={cn('font-wds-sans text-[13px] leading-4 text-wds-warning-fg disabled:opacity-60', MOTION, FOCUS_RING, onHover('underline'))}
        >
          Mark all read
        </button>
      </div>
      {list.status === 'error' ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">We could not refresh. The list shown is the last we had.</p> : null}
      <ul aria-label="Notifications" className={cn('m-0 flex list-none flex-col gap-2 p-0', list.status === 'error' && 'opacity-60')}>
        {items.map((n) => {
          const href = safeHref(n.href);
          return (
            <li key={n.id}>
              <InboxRow
                areaKind={areaKind(n)}
                kind={n.tone}
                when={whenWords(n.createdAt, now)}
                whenExact={whenExact(n.createdAt)}
                title={n.title}
                whoAndWhy={n.body}
                unread={!n.read}
                action={
                  href
                    ? { label: 'Open', onClick: () => { if (!n.read) void list.markRead([n.id]); router.push(href); } }
                    : n.read
                      ? undefined
                      : { label: 'Mark as read', onClick: () => void list.markRead([n.id]) }
                }
              />
            </li>
          );
        })}
      </ul>
      <TablePager
        page={page}
        perPage={pageSize}
        shown={items.length}
        total={list.data?.total ?? items.length}
        onPageChange={setPage}
        onPerPageChange={(n) => { setPageSize(n); setPage(1); }}
        className="px-0"
      />
    </div>
  );
}
