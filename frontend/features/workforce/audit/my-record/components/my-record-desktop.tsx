'use client';

import * as React from 'react';

import { TablePager } from '@/components/ui2/data-table/table-pager';
import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { cn } from '@/lib/cn';

import { EmptyState, ErrorBlock, FilterChip, FOCUS_RING, ListSkeleton, PageHeader, WorkforceFrame, useNow } from '../../../_shared';
import { nairobiDayOf } from '../../log/lib/audit-query';
import type { useMyRecord } from '../hooks/use-my-record';
import { CHIPS, RECORD_COPY, cardSpeech, entriesWord, showing, timeWords } from '../lib/my-record-words';
import { RecordDetail } from './record-detail';

/**
 * Activity on my record on a desktop (frame 13.12): group chips, a table (what happened, by, when) with the numbered pager and rows per
 * page, and the chosen entry beside it with "That was me" and "This wasn't me". The first entry is chosen to begin with. Reading writes
 * nothing. A phone has the card list and the full entry instead (`MyRecordScreen`).
 */
export function MyRecordDesktop({ record, onSignedOut }: { record: ReturnType<typeof useMyRecord>; onSignedOut: () => void }) {
  const now = useNow();
  const today = React.useMemo(() => nairobiDayOf(), []);
  const [chosen, setChosen] = React.useState<string | null>(null);
  const data = record.list.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  // The chosen entry stays chosen while it is on the page; otherwise the first one is.
  const openId = items.some((i) => i.id === chosen) ? chosen : (items[0]?.id ?? null);

  let table: React.ReactNode;
  if (record.list.status === 'loading' && !data) table = <ListSkeleton rows={5} columns={['fill', 120, 90]} label="Loading your record" />;
  else if (record.list.status === 'error' && !data) {
    table = <ErrorBlock title={RECORD_COPY.error} line={RECORD_COPY.errorLine} reference={record.list.error.code === 'NETWORK' ? undefined : record.list.error.code} onRetry={record.list.reload} />;
  } else if (items.length === 0) {
    table = record.event !== 'all' ? <EmptyState kind="nothingFound" title={RECORD_COPY.nothingFound} /> : <EmptyState kind="nothingYet" title={record.isMonth ? RECORD_COPY.empty : RECORD_COPY.emptyRange} />;
  } else {
    table = (
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto border border-wds-border bg-wds-surface">
          <Table look="workforce" aria-label={`Activity on my record, ${showing(items.length, total)}, page ${record.page}`}>
            <TableHeader>
              <TableRow>
                <TableHead>{RECORD_COPY.whatHappened}</TableHead>
                <TableHead className="w-[185px]">{RECORD_COPY.by}</TableHead>
                <TableHead className="w-[118px]">{RECORD_COPY.when}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-state={item.id === openId ? 'selected' : undefined} onClick={() => setChosen(item.id)} className={cn('cursor-pointer', item.flagged && 'bg-wds-warning-bg')}>
                  <TableCell className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
                    <button type="button" aria-label={cardSpeech(item, now)} aria-current={item.id === openId ? 'true' : undefined} onClick={() => setChosen(item.id)} className={cn('text-left font-semibold', item.flagged && 'text-wds-warning-fg', FOCUS_RING)}>
                      {item.title}
                    </button>
                  </TableCell>
                  <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{item.line}</TableCell>
                  <TableCell className="whitespace-nowrap font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{timeWords(item.occurredAt, now)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePager page={record.page} perPage={record.pageSize} shown={items.length} total={total} onPageChange={record.setPage} onPerPageChange={record.changePageSize} />
      </div>
    );
  }

  return (
    <WorkforceFrame breadcrumb={{ section: 'My account', screen: RECORD_COPY.screen }} phoneTitle={RECORD_COPY.screen} label={RECORD_COPY.screen}>
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5 px-6 py-7">
        <PageHeader size="lg" title={RECORD_COPY.screen} subtitle={`${data ? entriesWord(total) : '…'} ${record.isMonth ? RECORD_COPY.subtitle : RECORD_COPY.subtitleRange}`} />
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Group" className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <FilterChip key={c.value} label={c.label} count={c.value === 'all' && record.event === 'all' && data ? total : undefined} selected={record.event === c.value} onClick={() => record.chooseEvent(c.value)} />
            ))}
          </div>
          <DateRangePicker label="Dates" today={today} value={record.range} onChange={(r) => r && record.chooseRange(r)} buttonClassName="h-9 justify-between px-3 text-[13px]" className="ml-auto w-[240px]" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_440px] items-start gap-5">
          {table}
          {openId ? <RecordDetail key={openId} id={openId} onAnswered={record.list.reload} onSignedOut={onSignedOut} /> : null}
        </div>
      </div>
    </WorkforceFrame>
  );
}
