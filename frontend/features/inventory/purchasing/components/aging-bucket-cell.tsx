import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The shared bucket-cell renderer consumed by both the "How overdue" bucket
 * table (Suppliers screen, item 6) and the "What we owe" bucket panel
 * (Supplier detail, item 7) — same underlying five-bucket data
 * (CURRENT / 1-30 / 31-60 / 61-90 / 90+, owner-resolved plan §7 Q4), never a
 * separate four-bucket calculation. Reference: `VGE-0`, row node `VIJ-0` —
 * `get_jsx` confirmed CURRENT/1-30/31-60 render `–` in a tone-neutral color
 * when zero, while 61-90/90+ render `–` in `error-fg` even when zero (a
 * genuine Paper-drawn distinction: the last two buckets are visually
 * "hotter" even empty) — modeled as a `tone` prop per bucket, not a single
 * shared zero-state color.
 */
export type AgingBucketTone = 'neutral' | 'warning' | 'error';

export interface AgingBucketCellProps {
  /** Formatted amount, or "–" for zero/empty. */
  value: string;
  tone: AgingBucketTone;
  className?: string;
}

const toneClass: Record<AgingBucketTone, string> = {
  neutral: 'text-wds-text-ink',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
};

export function AgingBucketCell({ value, tone, className }: AgingBucketCellProps) {
  return <span className={cn('font-wds-mono text-wds-caption', toneClass[tone], className)}>{value}</span>;
}

/** The five-bucket header label + tone, shared by the header row of both consumers. */
export const AGING_BUCKET_COLUMNS: { key: string; label: string; tone: AgingBucketTone }[] = [
  { key: 'current', label: 'CURRENT', tone: 'neutral' },
  { key: '1-30', label: '1–30', tone: 'warning' },
  { key: '31-60', label: '31–60', tone: 'warning' },
  { key: '61-90', label: '61–90', tone: 'error' },
  { key: '90+', label: '90+', tone: 'error' },
];
