'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover, useNow } from '../../../_shared';
import { needsYouSubtitle, safeOpens, seeAllLabel, showingTop, sinceWords } from '../lib/role-home-words';
import type { HomeNeedsYou, HomeSummaryRow } from '../types/role-home-types';

export const NEEDS_YOU_PAGE_HREF = '/app/workforce/needs-you';

const ACTION = cn('inline-flex items-center border border-wds-border-strong bg-wds-surface px-3.5 py-1.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'));
const LINK = cn('font-wds-sans text-[13px] font-medium leading-4 text-wds-warning-fg', MOTION, FOCUS_RING, onHover('underline'));

/** The coloured dot before a kind: red-brown for the Overdue row, amber for the rest. */
const Dot = ({ overdue }: { overdue: boolean }) => <span aria-hidden className={cn('size-2 shrink-0 rounded-full', overdue ? 'bg-wds-error-fg' : 'bg-wds-warning-fg')} />;

function DesktopRow({ row, now }: { row: HomeSummaryRow; now: Date }) {
  return (
    <tr className="border-b border-wds-neutral-100">
      <td className="w-[150px] px-3 py-3.5 align-top">
        <span className={cn('flex items-center gap-2 pt-0.5 font-wds-sans text-[13px] leading-4', row.overdue ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
          <Dot overdue={row.overdue} />
          {row.kindLabel}
        </span>
      </td>
      <td className="px-2 py-3.5 align-top">
        <span className="block font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{row.title}</span>
        <span className="block font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{row.line}</span>
      </td>
      <td className="w-[170px] px-2 py-3.5 align-top">
        <Link href={safeOpens(row.opens)} className={ACTION}>
          {row.action}
        </Link>
      </td>
      <td className={cn('w-[90px] px-3 py-3.5 text-right align-top font-wds-mono text-[11px] leading-4', row.overdue ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>{sinceWords(row.since, now)}</td>
    </tr>
  );
}

function PhoneCard({ row, now }: { row: HomeSummaryRow; now: Date }) {
  return (
    <li className={cn('flex flex-col gap-2 border border-wds-border border-l-[3px] bg-wds-surface px-3.5 py-3', row.overdue ? 'border-l-wds-error-fg' : 'border-l-wds-warning-fg')}>
      <span className={cn('flex items-center gap-2 font-wds-mono text-[10px] leading-3 tracking-[0.06em]', row.overdue ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>
        <Dot overdue={row.overdue} />
        {row.kindLabel.toUpperCase()}
        <span className="ml-auto">{sinceWords(row.since, now)}</span>
      </span>
      <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{row.title}</span>
      <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{row.line}</span>
      <Link href={safeOpens(row.opens)} className={cn(ACTION, 'h-11 w-full justify-center text-[14px]')}>
        {row.action}
      </Link>
    </li>
  );
}

/**
 * "Needs you" (Paper 1.1 to 1.11): one row per kind with a count, overdue first, the top five, then "Showing the top 5 of 14" and
 * "See all 14". Desktop is a table (Kind, Request, Where you decide, Since); the phone stacks each row into a card with a full-width
 * 44 px button.
 */
export function HomeNeedsYouTable({ needs, phone = false }: { needs: HomeNeedsYou; phone?: boolean }) {
  const now = useNow();
  const top = showingTop(needs.rows.length, needs.total);
  const seeAll = needs.total > 0 ? (
    <Link href={NEEDS_YOU_PAGE_HREF} className={LINK}>
      {seeAllLabel(needs.total)}
    </Link>
  ) : null;

  return (
    <section aria-label="Needs you" className="flex min-w-0 flex-col">
      <div className="flex items-baseline gap-2.5 pb-2.5">
        <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">Needs you</h2>
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{needsYouSubtitle(needs.total, needs.kinds)}</span>
        <span className="ml-auto">{seeAll}</span>
      </div>
      {phone ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {needs.rows.map((row) => (
            <PhoneCard key={row.key} row={row} now={now} />
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse border-t border-t-wds-neutral-800 text-left">
          <thead>
            <tr className="border-b border-wds-neutral-100 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">
              <th scope="col" className="px-3 py-2 font-normal">KIND</th>
              <th scope="col" className="px-2 py-2 font-normal">REQUEST</th>
              <th scope="col" className="px-2 py-2 font-normal">WHERE YOU DECIDE</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">SINCE</th>
            </tr>
          </thead>
          <tbody>
            {needs.rows.map((row) => (
              <DesktopRow key={row.key} row={row} now={now} />
            ))}
          </tbody>
        </table>
      )}
      {top ? (
        <div className="flex items-center justify-between border-t border-wds-neutral-100 px-3 py-3">
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{top}</span>
          {seeAll}
        </div>
      ) : null}
    </section>
  );
}
