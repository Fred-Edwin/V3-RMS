'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { formatApiErrorMessage } from '@/types/api';
import type { SupplierTimelineEntry } from '../types/supplier';
import { getSupplierDocumentDownload } from '../../services';
import {
  DEFAULT_DOC_FILTERS,
  DOC_GROUP_CHIP,
  DOC_GROUP_ORDER,
  DOC_RANGE_LABEL,
  DOC_SORT_LABEL,
  applyDocFilters,
  docAddedBy,
  docDate,
  docGroupCounts,
  docTypeLabel,
  formatDayMonth,
  isAutomatic,
  uploaders,
  type DocFilters,
  type DocRange,
  type DocSort,
} from '../lib/supplier-logic';
import { StockEmptyCard } from '../../_shared/components/stock-states';
import { FilterMenu, InlineNotice, RowAction, TabHeading, tableHead } from './supplier-ui';

export interface DocumentsTabProps {
  supplierId: string;
  entries: SupplierTimelineEntry[];
  canUpload: boolean;
  onUpload: () => void;
}

const filterBox =
  'h-[34px] rounded-wds-sm border border-wds-border-strong bg-white px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink transition-colors placeholder:text-wds-text-faint focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)] focus-visible:outline-none';

function SourceSwitch({ value, onChange }: { value: DocFilters['source']; onChange: (v: DocFilters['source']) => void }) {
  const options: Array<[DocFilters['source'], string]> = [['ALL', 'All'], ['UPLOADED', 'Uploaded'], ['AUTOMATIC', 'Automatic']];
  return (
    <div role="group" aria-label="Where the document came from" className="flex h-[34px] overflow-hidden rounded-wds-sm border border-wds-border-strong bg-white">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            'px-3 font-wds-sans text-[13px] leading-4 transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]',
            value === key ? 'bg-wds-text-ink font-medium text-white' : 'text-wds-text-ink hover:bg-wds-neutral-50'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Documents tab (Paper step 23): receipts and invoices appear by themselves (the timeline), uploads sit among them.
 * Search, date range, who added it, All / Uploaded / Automatic, sort and type chips with counts combine; the chip counts
 * follow every other filter. The list holds the 200 newest entries, so "Showing n of m" is over those.
 */
export function DocumentsTab({ supplierId, entries, canUpload, onUpload }: DocumentsTabProps) {
  const [filters, setFilters] = React.useState<DocFilters>(DEFAULT_DOC_FILTERS);
  const [opening, setOpening] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const set = <K extends keyof DocFilters>(key: K, value: DocFilters[K]) => setFilters((prev) => ({ ...prev, [key]: value }));
  const now = React.useMemo(() => Date.now(), []);

  const shown = React.useMemo(() => applyDocFilters(entries, filters, now), [entries, filters, now]);
  const counts = React.useMemo(() => docGroupCounts(entries, filters, now), [entries, filters, now]);
  const people = React.useMemo(() => uploaders(entries), [entries]);
  const addedByName = people.find((p) => p.id === filters.addedBy)?.name;

  const open = async (entry: SupplierTimelineEntry) => {
    if (entry.kind !== 'UPLOAD') return;
    setOpening(entry.id);
    setProblem(null);
    try {
      const download = await getSupplierDocumentDownload(supplierId, entry.document.id);
      window.open(download.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setProblem(formatApiErrorMessage(err, 'Could not open this file.'));
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <TabHeading title="Documents" actions={canUpload ? <Button className="h-[34px] px-4" onClick={onUpload}>Upload file</Button> : null}>
        Receipts and invoices appear by themselves. Upload photos and PDFs for anything else. Files are never deleted; replace them with a newer one.
      </TabHeading>
      {problem ? <InlineNotice>{problem}</InlineNotice> : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="documentSearch"
            aria-label="Search documents"
            autoComplete="off"
            placeholder="Search by name or reference, for example GRN-1042"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className={cn(filterBox, 'w-[340px] shrink-0')}
          />
          <FilterMenu<DocRange>
            name="Date"
            valueLabel={DOC_RANGE_LABEL[filters.range]}
            options={(Object.keys(DOC_RANGE_LABEL) as DocRange[]).map((r) => ({ value: r, label: DOC_RANGE_LABEL[r] }))}
            onSelect={(v) => set('range', v ?? 'ALL')}
          />
          <FilterMenu<string>
            name="Added by"
            valueLabel={addedByName ?? 'anyone'}
            options={[{ value: null, label: 'Anyone' }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
            onSelect={(v) => set('addedBy', v)}
          />
          <SourceSwitch value={filters.source} onChange={(v) => set('source', v)} />
          <span className="grow" />
          <FilterMenu<DocSort>
            name="Sort"
            valueLabel={DOC_SORT_LABEL[filters.sort]}
            options={(Object.keys(DOC_SORT_LABEL) as DocSort[]).map((s) => ({ value: s, label: DOC_SORT_LABEL[s] }))}
            onSelect={(v) => set('sort', v ?? 'NEWEST')}
            align="end"
          />
        </div>
        <div role="group" aria-label="Type" className="flex flex-wrap items-center gap-2">
          {([null, ...DOC_GROUP_ORDER] as const).map((group) => {
            const active = filters.group === group;
            const count = group === null ? counts.ALL : counts[group];
            return (
              <button
                key={group ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => set('group', group)}
                className={cn(
                  'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-wds-sm px-3 font-wds-sans text-[13px] leading-4 transition-[background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]',
                  active ? 'bg-wds-text-ink font-medium text-white' : 'border border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50'
                )}
              >
                {group === null ? 'All types' : DOC_GROUP_CHIP[group]}
                <span className={cn('font-wds-mono text-[11px] leading-[14px]', active ? 'text-[#B5AEA5]' : 'text-wds-text-secondary')}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex justify-center border border-wds-border bg-white px-4 py-8">
          {entries.length === 0 ? (
            <StockEmptyCard
              title="No documents yet"
              description="Signed receipts and invoices appear here by themselves. Upload a price list, contract or photo."
              actionLabel={canUpload ? 'Upload file' : undefined}
              onAction={canUpload ? onUpload : undefined}
            />
          ) : (
            <StockEmptyCard
              title="No documents match"
              description="Nothing fits these filters. Widen the dates or clear the search."
              actionLabel="Clear filters"
              onAction={() => setFilters(DEFAULT_DOC_FILTERS)}
            />
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div role="table" aria-label="Documents" className="min-w-[860px] border border-wds-border bg-white">
            <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-4">
              <span role="columnheader" className={cn(tableHead, 'min-w-0 grow basis-0')}>DOCUMENT</span>
              <span role="columnheader" className={cn(tableHead, 'w-[130px] shrink-0')}>TYPE</span>
              <span role="columnheader" className={cn(tableHead, 'w-[100px] shrink-0')}>DATE</span>
              <span role="columnheader" className={cn(tableHead, 'w-[260px] shrink-0')}>ADDED BY</span>
              <span role="columnheader" className={cn(tableHead, 'w-[150px] shrink-0')}>LINKED TO</span>
              <span role="columnheader" className="w-20 shrink-0" />
            </div>
            {shown.map((entry) => (
              <div key={`${entry.kind}-${entry.id}`} role="row" className="flex h-[54px] items-center border-b border-wds-neutral-100 px-4 last:border-b-0">
                <span role="cell" className="min-w-0 grow basis-0 truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{entry.title}</span>
                <span role="cell" className="w-[130px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{docTypeLabel(entry)}</span>
                <span role="cell" className="w-[100px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{formatDayMonth(docDate(entry))}</span>
                <span role="cell" className={cn('w-[260px] shrink-0 truncate font-wds-sans text-[13px] leading-4', isAutomatic(entry) ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>{docAddedBy(entry)}</span>
                <span role="cell" className="w-[150px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-ink">{entry.reference ?? <span className="font-wds-sans text-[13px] text-wds-text-faint">—</span>}</span>
                <span role="cell" className="flex w-20 shrink-0 justify-end">
                  {entry.kind === 'UPLOAD' ? (
                    <RowAction disabled={opening === entry.id} onClick={() => void open(entry)}>Open</RowAction>
                  ) : entry.kind === 'RECEIPT' ? (
                    <Link
                      href={`/app/inventory/receiving/${entry.id}`}
                      className="rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:shadow-wds-ring"
                    >
                      Open
                    </Link>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        Showing {shown.length} of {entries.length}
        {filters.sort === 'NEWEST' ? ' · newest first' : filters.sort === 'OLDEST' ? ' · oldest first' : ' · by name'}. Filters combine, and the count updates as you type.
      </p>
    </div>
  );
}
