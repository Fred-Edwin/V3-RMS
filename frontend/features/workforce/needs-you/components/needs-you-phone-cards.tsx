'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, TAP_TARGET, onHover } from '../../_shared';
import { kindLabel, opensFor, rowName, sinceTone, sinceWords } from '../lib/needs-you-words';
import type { NeedsYouRow } from '../types/needs-you-types';

const TONE = { default: 'text-wds-text-secondary', warning: 'text-wds-warning-fg', error: 'text-wds-error-fg' } as const;

/**
 * The same rows as a stack of cards on a phone (Paper draws no phone card for this; built in the Chapter 1 phone card style).
 * One card per row: a 3 px edge (amber when new), the kind in mono, the text, since, and a 44 px Open link.
 */
export function NeedsYouPhoneCards({ rows, now, dim = false }: { rows: readonly NeedsYouRow[]; now: Date; dim?: boolean }) {
  return (
    <ul aria-label="Needs you" className={cn('m-0 flex list-none flex-col gap-2 p-0', dim && 'opacity-60')}>
      {rows.map((row) => (
        <li key={row.id} className={cn('flex gap-3.5 border border-wds-border px-4 py-3.5', row.isNew ? 'bg-wds-warning-bg' : 'bg-wds-surface')}>
          <span aria-hidden className={cn('w-[3px] shrink-0', row.isNew ? 'bg-wds-caramel-500' : 'bg-wds-neutral-200')} />
          <div className="flex min-w-0 grow flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{kindLabel(row.kind).toUpperCase()}</span>
              <span className={cn('font-wds-sans text-[14px] leading-5 text-wds-text-ink', row.isNew && 'font-semibold')}>{row.text}</span>
              <span className={cn('font-wds-mono text-[11px] leading-[14px]', TONE[sinceTone(row.since, now)])}>Since {sinceWords(row.since, now)}</span>
            </div>
            <Link
              href={opensFor(row)}
              aria-label={`Open: ${rowName(row, now)}`}
              className={cn(
                'inline-flex w-fit items-center justify-center border border-wds-border-strong bg-wds-surface px-4 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink',
                TAP_TARGET,
                MOTION,
                FOCUS_RING,
                PRESSED,
                onHover('bg-wds-neutral-50')
              )}
            >
              Open
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
