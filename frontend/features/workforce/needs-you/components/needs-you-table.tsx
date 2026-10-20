'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { kindLabel, opensFor, rowName, sinceTone, sinceWords, whereLabel } from '../lib/needs-you-words';
import type { NeedsYouRow } from '../types/needs-you-types';

/** The keyboard ring for a stretched link is drawn on the row-sized overlay, inside the row, so it is never clipped by the table. */
const ROW_RING = 'outline-none focus-visible:after:shadow-[inset_0_0_0_3px_var(--wds-ring)]';

const TONE: Record<ReturnType<typeof sinceTone>, string> = {
  default: 'text-wds-text-secondary',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
};

/**
 * The desktop card (Paper Chapter 15 step 1): KIND, REQUEST, WHERE YOU DECIDE, SINCE. Each row is one link (a stretched anchor on the
 * request), so the whole row is the target and a screen reader hears one name. The amber fill, bold text and 3 px bar mean "new since you last
 * opened Home" and nothing else. Nothing is decided here: the row opens the page where it is decided.
 */
export function NeedsYouTable({ rows, now, dim = false }: { rows: readonly NeedsYouRow[]; now: Date; dim?: boolean }) {
  return (
    <Table look="workforce" aria-label="Needs you" className={cn(dim && 'opacity-60')}>
      <TableHeader>
        <TableRow className="h-9">
          <TableHead className="w-[90px]">Kind</TableHead>
          <TableHead>Request</TableHead>
          <TableHead className="w-[130px]">Where you decide</TableHead>
          <TableHead className="w-[100px]">Since</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const href = opensFor(row);
          return (
            <TableRow key={row.id} size="compact" className={cn('relative h-12', row.isNew && 'bg-wds-warning-bg')}>
              <TableCell className={cn('font-wds-sans text-[13px] leading-4', row.isNew ? 'font-semibold text-wds-text-ink shadow-[inset_3px_0_0_var(--wds-caramel-500)]' : 'text-wds-text-ink')}>{kindLabel(row.kind)}</TableCell>
              <TableCell className={cn('py-3 font-wds-sans text-[13px] leading-4', row.isNew ? 'font-semibold text-wds-text-ink' : 'text-wds-text-ink')}>
                <Link href={href} aria-label={rowName(row, now)} className={cn('after:absolute after:inset-0 after:content-[""]', ROW_RING)}>
                  {row.text}
                </Link>
              </TableCell>
              <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{whereLabel(href)}</TableCell>
              <TableCell className={cn('font-wds-mono text-[11px] leading-[14px]', TONE[sinceTone(row.since, now)])}>{sinceWords(row.since, now)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
