'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { Today } from '../../_shared/types/branch-day-contract';
import { branchDayDeskApi } from '../services/branch-day-desk-api';
import { dayPaths } from '../lib/desk-paths';

const paths = dayPaths('/app/branch/day');

/** The line under the title: who has not counted, or that the day can close. Names only what blocks the close. */
export function dayCardLine(day: NonNullable<Today['day']>): string {
  if (day.canClose) return 'All departments have counted.';
  const blocking = day.blockers.filter((b) => b.severity === 'BLOCKS');
  const notCounted = blocking.filter((b) => b.kind === 'DEPARTMENT_NOT_COUNTED').map((b) => b.department?.name ?? '');
  const deliveries = blocking.filter((b) => b.kind === 'DELIVERY_NOT_CONFIRMED').map((b) => b.department?.name ?? '');
  const parts: string[] = [];
  if (notCounted.length > 0) parts.push(`${notCounted.join(', ')} ${notCounted.length === 1 ? 'has' : 'have'} not counted.`);
  if (deliveries.length > 0) parts.push(`${deliveries.join(', ')} ${deliveries.length === 1 ? 'has' : 'have'} not confirmed a delivery.`);
  return parts.join(' ');
}

/**
 * The Branch Manager's Dashboard card for today's Branch day (phase 3 walk, finding 16; Paper "UX walk phase 3 proposals", artboard 3).
 * Red while anything blocks the close, green when the day is ready, and nothing once it is closed or if the day cannot be read. The
 * number is the same `summary.todo` the sidebar badge shows. `onVisibleChange` lets the page hide its "Nothing pending" line.
 */
export function DashboardDayCard({ onVisibleChange }: { onVisibleChange?: (visible: boolean) => void }) {
  const [day, setDay] = React.useState<Today['day'] | null>(null);
  const [branchName, setBranchName] = React.useState('');

  React.useEffect(() => {
    const controller = new AbortController();
    branchDayDeskApi
      .today({}, controller.signal)
      .then((today) => {
        setDay(today.day);
        setBranchName(today.branch.name);
      })
      .catch(() => {
        /* the card is a shortcut, not a gate: no card when the day cannot be read */
      });
    return () => controller.abort();
  }, []);

  const visible = day !== null && !day.closed;
  React.useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  if (!day || day.closed) return null;
  const ready = day.canClose;
  const todo = day.summary.todo;
  return (
    <div className={cn('flex flex-wrap items-center gap-4 border border-l-[3px] bg-white px-[18px] py-4', ready ? 'border-wds-success-border border-l-wds-success-fg' : 'border-wds-error-border border-l-wds-error-fg')}>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <p className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">
          {ready ? `${branchName} day is ready to close` : `${branchName} day · ${todo} ${todo === 1 ? 'thing' : 'things'} to do before it can close`}
        </p>
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{dayCardLine(day)}</p>
      </div>
      <Link
        href={paths.today()}
        className="flex h-9 shrink-0 items-center bg-gradient-to-b from-[var(--wds-primary-btn-start)] to-[#4A1D00] px-4 font-wds-sans text-[13px] font-medium text-[#FCF7F2] outline-none transition-opacity duration-100 focus-visible:shadow-wds-ring active:opacity-80"
      >
        Open Today
      </Link>
    </div>
  );
}
