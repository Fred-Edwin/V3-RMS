'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { FOCUS_RING } from '../../../_shared';
import { rowSpeech, whenShort, whoText } from '../lib/audit-words';
import type { AuditRow } from '../types/audit-log-types';

/** Wraps the matching letters of a search in bold (table convention, UI_BUILD_RULES 4a). Plain text when there is no search. */
export function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (!t) return <>{text}</>;
  const at = text.toLowerCase().indexOf(t.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-semibold text-wds-text-ink">{text.slice(at, at + t.length)}</strong>
      {text.slice(at + t.length)}
    </>
  );
}

/**
 * The log (6a A1): WHEN, WHO, WHAT, DETAIL. A flagged row has the warm tint and the word FLAGGED in front of its title, so colour is never
 * the only signal. The title is the row's one tab stop (it opens the drawer); the whole row also takes a click. `aria-rowindex` lets
 * a screen reader place the row on a page of many.
 */
export function AuditTable({
  rows,
  term,
  openId,
  page,
  total,
  onOpen,
}: {
  rows: readonly AuditRow[];
  term: string;
  openId: string | null;
  page: number;
  total: string;
  onOpen: (row: AuditRow, opener: HTMLElement) => void;
}) {
  return (
    <div className="overflow-x-auto border border-wds-border bg-wds-surface">
      <Table look="workforce" aria-label={`Audit log, ${total}, page ${page}`}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[132px]">When</TableHead>
            <TableHead className="w-[200px]">Who</TableHead>
            <TableHead className="w-[260px]">What</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              size="compact"
              data-state={row.id === openId ? 'selected' : undefined}
              onClick={(e) => onOpen(row, e.currentTarget)}
              className={cn('cursor-pointer', row.flagged && 'bg-wds-warning-bg')}
            >
              <TableCell className="whitespace-nowrap font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{whenShort(row.occurredAt)}</TableCell>
              <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                <Highlight text={whoText(row)} term={term} />
              </TableCell>
              <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                <button
                  type="button"
                  aria-label={rowSpeech(row)}
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(row, e.currentTarget);
                  }}
                  className={cn('text-left font-semibold', row.flagged && 'text-wds-error-fg', FOCUS_RING)}
                >
                  {row.flagged ? <span className="mr-1.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em]">FLAGGED</span> : null}
                  <Highlight text={row.title} term={term} />
                </button>
              </TableCell>
              <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
                <Highlight text={row.detail} term={term} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
