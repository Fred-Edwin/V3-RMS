'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { formatQuantity, formatWhen } from '../lib/prep-format';
import type { RunSummary } from '../types/prep-contract';
import { RunStatusChip, VsUsualChip } from './run-chips';

/**
 * RunTable: one table, a column set per role (plan §6, Paper `7DF-0` manager and `1UAA-0` Attendant).
 *  - `attendant`: When, Output ("· yours" on their own runs), Yield, Vs usual, By. No costs and no flags (the server sends none).
 *  - `manager`: adds Inputs and Unit cost, and tints a run that needs a look. Unit cost shows only when the server sent it
 *    (`prep.see_costs`), so a read-only role without it simply has no column.
 * Rows open the run (`onOpen`). The table scrolls sideways in its own container on a narrow screen instead of squashing columns.
 */
export interface RunTableProps {
  runs: RunSummary[];
  variant: 'attendant' | 'manager';
  onOpen?: (run: RunSummary) => void;
  className?: string;
}

const head = 'whitespace-nowrap px-wds-4';

export function RunTable({ runs, variant, onOpen, className }: RunTableProps) {
  const manager = variant === 'manager';
  const showCost = manager && runs.some((r) => r.outputUnitCost !== undefined);
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow className="h-[34px] hover:bg-transparent">
          <TableHead className={head}>When</TableHead>
          <TableHead className={head}>Output</TableHead>
          {manager ? <TableHead className={head}>Inputs</TableHead> : null}
          <TableHead className={cn(head, 'text-right')}>Yield</TableHead>
          <TableHead className={head}>Vs usual</TableHead>
          {showCost ? <TableHead className={cn(head, 'text-right')}>Unit cost</TableHead> : null}
          <TableHead className={head}>By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow
            key={run.id}
            onClick={onOpen ? () => onOpen(run) : undefined}
            onKeyDown={onOpen ? (e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), onOpen(run)) : undefined) : undefined}
            tabIndex={onOpen ? 0 : undefined}
            // A run that needs a look is tinted for the manager (Paper `7HV-0`). Only the manager variant ever receives `needsLook`
            // (the server sends it to prep.read_flags holders only), so the Attendant's table never tints. Colour is not the only
            // signal: the Output cell also says "needs a look" to a screen reader, and the drawer and the band say it in words.
            className={cn('h-12', manager && run.needsLook && 'bg-wds-warning-bg hover:bg-wds-warning-bg', onOpen && 'cursor-pointer outline-none focus-visible:shadow-wds-ring')}
          >
            <TableCell className="whitespace-nowrap font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatWhen(run.at)}</TableCell>
            <TableCell className="whitespace-nowrap font-medium text-wds-text-ink">
              {run.outputName}
              {manager && run.needsLook ? <span className="sr-only"> (needs a look)</span> : null}
              {run.mine ? <span className="font-normal text-wds-text-copy-muted"> · yours</span> : null}
              {run.status !== 'RECORDED' ? <RunStatusChip status={run.status} className="ml-wds-2" /> : null}
            </TableCell>
            {manager ? (
              <TableCell className="max-w-[220px] truncate text-wds-text-ink" title={run.inputsPreview.firstLabel}>
                {run.inputsPreview.firstLabel}
                {run.inputsPreview.moreCount > 0 ? <span className="text-wds-text-faint"> +{run.inputsPreview.moreCount} more</span> : null}
              </TableCell>
            ) : null}
            <TableCell className="whitespace-nowrap text-right text-wds-text-ink">
              {formatQuantity(run.made)} {run.unit}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <VsUsualChip vsUsual={run.vsUsual} />
            </TableCell>
            {showCost ? (
              <TableCell className="whitespace-nowrap text-right font-wds-mono text-wds-text-ink">{run.outputUnitCost !== undefined ? `KES ${Number(run.outputUnitCost).toLocaleString('en-KE', { maximumFractionDigits: 0 })}/${run.unit}` : ''}</TableCell>
            ) : null}
            <TableCell className="whitespace-nowrap font-wds-mono text-wds-caption text-wds-text-copy-muted" title={run.by.name}>
              {run.by.initials}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
