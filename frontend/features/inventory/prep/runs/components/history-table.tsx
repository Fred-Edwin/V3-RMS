'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { StatusDot } from '@/components/ui2/status-dot';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { VsUsualChip } from '../../_shared/components/run-chips';
import { formatQuantity, formatWhen } from '../../_shared/lib/prep-format';
import type { RunSummary } from '../../_shared/types/prep-contract';

const head = 'whitespace-nowrap px-wds-4';

/** The last cell of a History row: what became of the run. Cancelled and Corrected come first; then the manager's review state. */
export function HistoryStatus({ run }: { run: RunSummary }) {
  if (run.status === 'CANCELLED') return <StatusDot tone="error">Cancelled</StatusDot>;
  if (run.status === 'CORRECTED') return <StatusDot tone="info">Corrected</StatusDot>;
  if (run.needsLook) return <StatusDot tone="warning">Needs a look</StatusDot>;
  if (run.reviewedBy && run.reviewedAt) {
    const clock = new Date(run.reviewedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' });
    return <StatusDot tone="success">Reviewed by {run.reviewedBy.name.split(' ')[0]}, {clock}</StatusDot>;
  }
  if (run.isCorrection) return <StatusDot tone="info">Corrected run</StatusDot>;
  return (
    <span className="text-wds-text-faint">
      <span aria-hidden>—</span>
      <span className="sr-only">Nothing to review</span>
    </span>
  );
}

export interface HistoryTableProps {
  runs: RunSummary[] | null;
  onOpen: (run: RunSummary) => void;
}

/**
 * Prep history (Paper step 12 `7VF-0`): When, Run, Output, Yield, Vs usual, By, Status. The header stays while rows load. Rows open
 * the run drawer by click, Enter or Space. It scrolls sideways inside its own box on a narrow screen, never the page.
 */
export function HistoryTable({ runs, onOpen }: HistoryTableProps) {
  return (
    // Paper draws History as rules only, without the outer box the shared table adds.
    <div className="[&>div]:border-0 [&>div]:bg-transparent">
    <Table>
      <TableHeader>
        <TableRow className="h-[34px] hover:bg-transparent">
          <TableHead className={cn(head, 'w-[120px]')}>When</TableHead>
          <TableHead className={cn(head, 'w-[100px]')}>Run</TableHead>
          <TableHead className={cn(head, 'w-[190px]')}>Output</TableHead>
          <TableHead className={cn(head, 'w-[120px] text-right')}>Yield</TableHead>
          <TableHead className={cn(head, 'w-[210px] pl-7')}>Vs usual</TableHead>
          <TableHead className={cn(head, 'w-[150px]')}>By</TableHead>
          <TableHead className={head}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs === null
          ? [0, 1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i} className="h-12 hover:bg-transparent" aria-hidden>
                <TableCell colSpan={7}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ))
          : runs.map((run) => (
              <TableRow
                key={run.id}
                tabIndex={0}
                onClick={() => onOpen(run)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), onOpen(run)) : undefined)}
                aria-label={`${run.reference}, ${run.outputName}`}
                className="h-12 cursor-pointer outline-none focus-visible:shadow-wds-ring"
              >
                <TableCell className="whitespace-nowrap font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatWhen(run.at)}</TableCell>
                <TableCell className="whitespace-nowrap font-wds-mono text-wds-caption text-wds-text-ink">{run.reference}</TableCell>
                <TableCell className="max-w-[220px] truncate whitespace-nowrap font-medium text-wds-text-ink" title={run.outputName}>
                  {run.outputName}
                  {run.mine ? <span className="font-normal text-wds-text-copy-muted"> · yours</span> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-wds-text-ink">
                  {formatQuantity(run.made)} {run.unit}
                </TableCell>
                <TableCell className="whitespace-nowrap pl-7">
                  <VsUsualChip vsUsual={run.vsUsual} />
                </TableCell>
                <TableCell className="max-w-[170px] truncate whitespace-nowrap text-wds-text-copy-muted" title={run.by.name}>
                  {run.by.name}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <HistoryStatus run={run} />
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
    </div>
  );
}
