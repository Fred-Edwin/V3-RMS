'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { useAttendantData } from '../../hooks/use-attendant';
import type { NoticeAction, NoticeType, NoticeView, NoticesFilter } from '../../types/attendant';
import { PURCHASING, orderHref, receiveHref } from './order-cards';
import { useUrlParams } from './gate';
import { FilterChips, HeaderLink, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, PrimaryButton, SecondaryButton, timeHHmm, useGoBack } from './phone-kit';

const FILTERS: NoticesFilter[] = ['all', 'unread', 'needs'];

const TILE: Record<NoticeType, string> = {
  RETURNED: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  APPROVED: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
  DUE_TODAY: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg',
  OVERDUE: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg',
  CLOSED: 'border-wds-border bg-wds-neutral-100 text-wds-text-secondary',
};

const ICON: Record<NoticeType, React.ReactNode> = {
  RETURNED: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  APPROVED: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  DUE_TODAY: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  OVERDUE: <path d="M12 3L2.5 20h19L12 3zM12 10v4.5M12 17.5v.5" />,
  CLOSED: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
};

const ACTION_LABEL: Record<NoticeAction, string> = { EDIT_AND_RESEND: 'Edit and resend', PRINT_OR_SHARE: 'Print or share', RECEIVE_DELIVERY: 'Receive delivery', CALL_SUPPLIER: 'Call supplier' };

function hrefFor(n: NoticeView): string {
  return n.action === 'RECEIVE_DELIVERY' ? receiveHref(n.orderId) : orderHref(n.orderId);
}

function Notice({ notice, onOpen }: { notice: NoticeView; onOpen: (n: NoticeView) => void }) {
  return (
    <li className={cn('flex gap-3 border-b border-wds-border bg-white py-3 first:border-t', notice.unread ? 'border-l-[3px] border-l-[var(--wds-primary-btn-start)] pl-[17px] pr-5' : 'px-5')}>
      <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center border', TILE[notice.type])}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ICON[notice.type]}
        </svg>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={hrefFor(notice)} onClick={() => onOpen(notice)} className="flex flex-col gap-0.5 rounded-wds-sm outline-none focus-visible:shadow-wds-ring">
          <span className="flex items-start justify-between gap-3">
            <span className={cn('font-wds-sans text-[14px] leading-[18px] text-wds-text-ink', notice.unread ? 'font-semibold' : 'font-normal')}>
              {notice.unread ? <span className="sr-only">Unread. </span> : null}
              {notice.title}
            </span>
            <span className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{timeHHmm(notice.at)}</span>
          </span>
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{notice.body}</span>
          <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-faint">
            {notice.reference ?? 'Draft'} · {notice.supplierName}
          </span>
        </Link>
        {notice.action ? (
          <div className="mt-[3px]">
            {notice.action === 'EDIT_AND_RESEND' ? (
              <PrimaryButton size="wide" href={hrefFor(notice)} onClick={() => onOpen(notice)}>
                {ACTION_LABEL[notice.action]}
              </PrimaryButton>
            ) : (
              <SecondaryButton size="wide" href={hrefFor(notice)} onClick={() => onOpen(notice)}>
                {ACTION_LABEL[notice.action]}
              </SecondaryButton>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** 28N: what happened to the Attendant's orders: approved, sent back, due, late, closed. */
export function NotificationsScreen() {
  const back = useGoBack(PURCHASING);
  const { params, set } = useUrlParams();
  const filter = (FILTERS.includes(params.get('filter') as NoticesFilter) ? params.get('filter') : 'all') as NoticesFilter;
  const { data, status, error, reload, service } = useAttendantData(`attendant:notices:${filter}`, (s) => s.getNotices(filter), 'We could not load your notifications.');
  const [failure, setFailure] = React.useState<string | null>(null);
  const counts = data?.counts;
  const total = data ? data.groups.reduce((n, g) => n + g.notices.length, 0) : 0;

  const markRead = (n: NoticeView): void => {
    if (!n.unread) return;
    service.markNoticesRead([n.key]).catch(() => undefined);
  };
  const markAll = async (): Promise<void> => {
    setFailure(null);
    try {
      await service.markAllNoticesRead();
    } catch {
      setFailure('We could not mark them read. Try again.');
    }
  };

  return (
    <PhoneScreen
      header={
        <B2Header
          title="Notifications"
          subtitle={counts ? `${counts.unread} unread · ${counts.needsMe} you can act on` : 'Approvals and deliveries'}
          leading="back"
          onBack={back}
          place="HUB"
          action={
            <HeaderLink onClick={() => void markAll()} disabled={!counts || counts.unread === 0}>
              Mark all read
            </HeaderLink>
          }
        />
      }
    >
      <FilterChips
        label="Show"
        active={filter}
        onChange={(key) => set({ filter: key === 'all' ? null : key })}
        chips={[
          { key: 'all', label: 'All', count: counts?.all },
          { key: 'unread', label: 'Unread', count: counts?.unread },
          { key: 'needs', label: 'Needs me', count: counts?.needsMe },
        ]}
      />
      {status === 'loading' || status === 'idle' ? (
        <PhoneLoading rows={4} label="Loading your notifications" />
      ) : (
        <>
          {status === 'error' ? <PhoneError className="m-5" onRetry={() => void reload()} message={error} /> : null}
          {failure ? (
            <p role="alert" className="m-5 border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
              {failure}
            </p>
          ) : null}
          {data && total === 0 ? <PhoneEmpty title="You are all caught up" line="New approvals and deliveries appear here." /> : null}
          {data?.groups.map((g) => (
            <section key={g.day} aria-labelledby={`n-${g.day}`}>
              <div className="flex items-center justify-between px-5 pb-2 pt-3.5">
                <h2 id={`n-${g.day}`} className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.08em] text-wds-text-secondary">
                  {g.label}
                </h2>
                <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-faint">{g.notices.length}</span>
              </div>
              <ul>
                {g.notices.map((n) => (
                  <Notice key={n.key} notice={n} onOpen={markRead} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </PhoneScreen>
  );
}
