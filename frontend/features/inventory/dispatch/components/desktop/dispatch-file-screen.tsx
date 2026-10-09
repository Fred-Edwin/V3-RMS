'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ErrorState } from '@/components/app/shell/shell-states';
import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { DocLink, ReqTabs } from '../../../requisitions/components/req-parts';
import { dayAndClock, dayLabel, clock } from '../../../requisitions/_shared/lib/requisitions-words';
import type { DispatchDocument, DispatchFile, DispatchItem } from '../../_shared/types/dispatch-contract';
import { dispatchNextWords, dispatchProgress, fileTitle, nameAndTitle, stageChip } from '../../lib/dispatch-words';
import { useRecordNudge } from '../../hooks/use-record-nudge';
import { dispatchDesktopApi } from '../../services/dispatch-desktop-api';
import { CancelDispatchDialog } from './cancel-dispatch-dialog';
import { ConfirmForDepartmentDrawer } from './confirm-for-department-drawer';
import { ColumnHead, FileHeader, NextStepCard } from './file-parts';
import { PhotoStrip } from './photo-strip';
import { ProgressTracker } from './progress-tracker';

type View = 'items' | 'documents' | 'activity';
const SHOWN_AT_FIRST = 4;

function FileSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-4 w-[420px]" />
      <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

const gapText = (item: DispatchItem): string => {
  if (item.gapQty === undefined || item.gapQty === null) return '—';
  const n = Number(item.gapQty);
  return n === 0 ? '0' : n > 0 ? `+${n}` : `${n}`;
};

const documentLabel = (doc: DispatchDocument): string => (doc.kind === 'DELIVERY_NOTE_STORE' ? 'Delivery note · store copy' : 'Delivery note · branch copy');

/** Paper D13, D20, E3: the dispatch file. One file for every state; the chip, tracker and the one main button change. */
export function DispatchFileScreen({ id, base, printBase, packHref, section: crumb }: { id: string; base: string; printBase: string; packHref: string; section: 'Branch' | 'Central Store' }) {
  const router = useRouter();
  const params = useSearchParams();
  const file = useLoader(`dispatch:${id}`, () => dispatchDesktopApi.file(id), 'Could not load this dispatch.');
  const [showAll, setShowAll] = React.useState(false);
  const moreRef = React.useRef<HTMLButtonElement>(null);
  const printRef = React.useRef<HTMLButtonElement>(null);
  const data = file.data;
  const reload = file.reload;
  const view: View = params.get('view') === 'documents' ? 'documents' : params.get('view') === 'activity' ? 'activity' : 'items';
  const cancelling = params.get('dialog') === 'cancel';
  const confirming = params.get('drawer') === 'confirm';

  useRecordNudge(() => void reload());

  const setParam = React.useCallback(
    (changes: Record<string, string | null>): void => {
      const q = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) q.delete(key);
        else q.set(key, value);
      }
      router.replace(`${base}/dispatch/${id}${q.toString() ? `?${q}` : ''}`, { scroll: false });
    },
    [params, router, base, id],
  );
  const toast = (variant: 'success' | 'error', title: string, description?: string): void => {
    useWdsToastStore.getState().addToast({ variant, title, description });
  };
  const openPrint = (copy: 'store' | 'branch'): void => {
    window.open(`${printBase}/${id}?copy=${copy}`, '_blank', 'noopener');
  };

  const words = data ? dispatchNextWords(data) : null;
  const progress = data ? dispatchProgress(data) : [];
  const visibleItems = data ? (showAll ? data.items : data.items.slice(0, SHOWN_AT_FIRST)) : [];
  const hiddenCount = data ? Math.max(0, data.items.length - SHOWN_AT_FIRST) : 0;
  const money = data?.items.some((i) => i.valueKes !== undefined) ?? false;
  const sentVisible = data?.sentVisible ?? false;

  const mainAction = (): React.ReactNode => {
    if (!data || !words?.actionLabel) return null;
    if (data.stage === 'GAP_HELD' && data.can.recordFinding) {
      const target = data.nextStep.facts.discrepancyId;
      return target ? <Button size="lg" className="h-[46px] px-6 text-[16px]" onClick={() => router.push(`${base}/discrepancies/${target}?drawer=finding`)}>{words.actionLabel}</Button> : null;
    }
    if (data.stage === 'WAITING_FOR_BRANCH' && data.can.confirmForDepartment) return <Button size="lg" className="h-[46px] px-6 text-[16px]" onClick={() => setParam({ drawer: 'confirm' })}>{words.actionLabel}</Button>;
    if (data.stage === 'CANCELLED') return <Button size="lg" className="h-[46px] px-6 text-[16px]" onClick={() => router.push(packHref)}>{words.actionLabel}</Button>;
    if ((data.stage === 'TO_PACK' || data.stage === 'PACKING' || data.stage === 'READY_TO_SEND') && data.nextStep.action) return <Button size="lg" className="h-[46px] px-6 text-[16px]" onClick={() => router.push(packHref)}>{words.actionLabel}</Button>;
    return null;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar hideSearch breadcrumb={{ root: crumb, section: 'Requisitions', sectionHref: base, screen: data?.reference ?? 'Dispatch' }} />
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 py-7">
        {file.status === 'error' ? (
          <ErrorState title="Couldn't load this dispatch" description="Check your connection and try again." onRetry={() => void reload()} />
        ) : !data || !words ? (
          <>
            <LoadingAnnouncer text="Getting the dispatch" />
            <FileSkeleton />
          </>
        ) : (
          <>
            {data.cancelled ? (
              <p role="status" className="border border-wds-error-border bg-wds-error-bg px-4 py-3 font-wds-sans text-[14px] text-wds-error-fg">
                Cancelled {dayLabel(data.cancelled.at)} at {clock(data.cancelled.at)} by {nameAndTitle(data.cancelled.by)}: {data.cancelled.reason}
              </p>
            ) : null}
            <FileHeader
              title={fileTitle(data)}
              chip={stageChip(data.stage)}
              subline={
                <>
                  <DocLink>{data.reference}</DocLink>
                  <span>from</span>
                  <DocLink href={`${base}/${data.requisition.id}`}>{data.requisition.reference}</DocLink>
                  <span>
                    · {data.lineCount} lines · {data.carrier.name}
                  </span>
                  {data.valueKes !== undefined ? <span>· KES {Number(data.valueKes).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span> : null}
                </>
              }
              actions={
                <>
                  {data.can.print ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button ref={printRef} variant="secondary" size="lg" className="h-9 px-4 text-[14px]">
                          Print delivery note
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => openPrint('store')}>Store copy</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openPrint('branch')}>Branch copy</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  {data.can.print || data.can.cancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button ref={moreRef} variant="secondary" size="icon" aria-label="More actions" className="size-9">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {data.can.print ? (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Print delivery note</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onSelect={() => openPrint('store')}>Store copy</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openPrint('branch')}>Branch copy</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ) : null}
                        {data.can.cancel ? (
                          <>
                            {data.can.print ? <DropdownMenuSeparator /> : null}
                            <DropdownMenuItem className="text-wds-error-fg" onSelect={() => setParam({ dialog: 'cancel' })}>
                              Cancel this dispatch
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              }
            />

            <ProgressTracker steps={progress} />

            <NextStepCard title={words.title} body={words.body} tone={words.tone} action={mainAction()} />

            <div className="flex flex-col">
              <ReqTabs
                label="Dispatch contents"
                active={view}
                onChange={(next) => setParam({ view: next === 'items' ? null : next })}
                tabs={[
                  { key: 'items', label: 'Items' },
                  { key: 'documents', label: 'Documents' },
                  { key: 'activity', label: 'Activity', count: data.activity.length },
                ]}
              />
              <div role="tabpanel" aria-labelledby={`req-tab-${view}`}>
                {view === 'items' ? (
                  <div className="flex flex-col">
                    <div role="table" aria-label="Items in this dispatch" className="flex flex-col">
                      <div role="row" className="flex items-center gap-6 border-b border-wds-text-ink px-3 pb-2.5 pt-4">
                        <ColumnHead className="flex-1">Item</ColumnHead>
                        {!sentVisible ? <ColumnHead className="w-[110px] shrink-0 text-right">Requested</ColumnHead> : <ColumnHead className="w-[110px] shrink-0 text-right">Sent</ColumnHead>}
                        <ColumnHead className="w-[110px] shrink-0 text-right">Counted</ColumnHead>
                        {sentVisible ? <ColumnHead className="w-[110px] shrink-0 text-right">Gap</ColumnHead> : null}
                        {money ? <ColumnHead className="w-[110px] shrink-0 text-right">Value (KES)</ColumnHead> : null}
                      </div>
                      {visibleItems.map((item) => {
                        const gap = item.gapQty !== undefined && item.gapQty !== null && Number(item.gapQty) !== 0;
                        return (
                          <div key={item.lineId} role="row" className={cn('flex items-center gap-6 border-b border-wds-border px-3 py-[11px]', gap && 'bg-wds-warning-bg')}>
                            <div role="cell" className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{item.itemName}</span>
                              {item.discrepancy ? (
                                <span className="font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
                                  {item.countedTwice ? 'Counted twice' : 'Counted once'}
                                  {item.countReason ? `, reason: ${item.countReason.toLowerCase().replace(/_/g, ' ')}` : ''} · opened as{' '}
                                  <Link href={`${base}/discrepancies/${item.discrepancy.id}`} className="underline underline-offset-2 outline-none focus-visible:shadow-wds-ring">
                                    {item.discrepancy.reference}
                                  </Link>
                                </span>
                              ) : null}
                              {item.photos.length > 0 ? <PhotoStrip photos={item.photos} /> : null}
                            </div>
                            <span role="cell" className="w-[110px] shrink-0 text-right font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{sentVisible ? item.sentQty : item.requestedQty}</span>
                            <span role="cell" className={cn('w-[110px] shrink-0 text-right font-wds-mono text-[14px] leading-[18px]', item.countedQty === null ? 'text-wds-text-faint' : 'text-wds-text-ink')}>{item.countedQty ?? '—'}</span>
                            {sentVisible ? (
                              <span role="cell" className={cn('w-[110px] shrink-0 text-right font-wds-mono text-[14px] leading-[18px]', gap ? 'font-semibold text-wds-warning-fg' : 'text-wds-text-faint')}>{gapText(item)}</span>
                            ) : null}
                            {money ? <span role="cell" className="w-[110px] shrink-0 text-right font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{item.valueKes !== undefined ? Number(item.valueKes).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''}</span> : null}
                          </div>
                        );
                      })}
                    </div>
                    {hiddenCount > 0 ? (
                      <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="border-b border-wds-border px-3 py-[11px] text-left font-wds-sans text-[14px] font-medium text-wds-primary outline-none focus-visible:shadow-wds-ring">
                        {showAll ? 'Show fewer lines' : `Show the other ${hiddenCount} ${hiddenCount === 1 ? 'line' : 'lines'}`}
                      </button>
                    ) : null}
                  </div>
                ) : view === 'documents' ? (
                  data.documents.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 border-t border-wds-border py-14 text-center">
                      <p className="font-wds-sans text-[16px] font-medium text-wds-text-ink">No delivery note yet</p>
                      <p className="font-wds-sans text-[14px] text-wds-text-secondary">The delivery note is made when the dispatch is signed.</p>
                    </div>
                  ) : (
                    <ul aria-label="Documents" className="border-t border-wds-border">
                      {data.documents.map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between gap-4 border-b border-wds-border px-1 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className={cn('font-wds-sans text-[15px] font-medium text-wds-text-ink', doc.voided && 'line-through')}>{documentLabel(doc)}</span>
                            <span className="font-wds-sans text-[14px] text-wds-text-secondary">
                              {doc.voided && data.cancelled ? `Void · cancelled ${dayLabel(data.cancelled.at)} · ` : ''}
                              {dayAndClock(doc.at)} · {nameAndTitle(doc.by)}
                            </span>
                          </div>
                          {data.can.print ? (
                            <Button variant="link" className="h-auto p-0 text-[14px] text-wds-text-ink underline" onClick={() => openPrint(doc.kind === 'DELIVERY_NOTE_STORE' ? 'store' : 'branch')}>
                              Print<span className="sr-only"> {documentLabel(doc)}</span>
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )
                ) : data.activity.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 border-t border-wds-border py-14 text-center">
                    <p className="font-wds-sans text-[16px] font-medium text-wds-text-ink">Nothing has happened yet</p>
                    <p className="font-wds-sans text-[14px] text-wds-text-secondary">Every signature, count, cancel and finding is listed here.</p>
                  </div>
                ) : (
                  <ol aria-label="Activity" className="border-t border-wds-border">
                    {data.activity.map((event) => (
                      <li key={event.id} className="grid grid-cols-[170px_1fr_240px] items-baseline gap-4 border-b border-wds-border px-1 py-3">
                        <time dateTime={event.at} className="font-wds-mono text-[13px] text-wds-text-secondary">{dayAndClock(event.at)}</time>
                        <p className="font-wds-sans text-[15px] leading-[22px] text-wds-text-ink">
                          {event.sentence}
                          {event.reason ? <span className="text-wds-text-secondary"> · {event.reason}</span> : null}
                          {event.link ? (
                            <>
                              {' · '}
                              <DocLink href={event.link.kind === 'DISCREPANCY' ? `${base}/discrepancies/${event.link.id}` : event.link.kind === 'REQUISITION' ? `${base}/${event.link.id}` : event.link.id === id ? undefined : `${base}/dispatch/${event.link.id}`}>{event.link.reference}</DocLink>
                            </>
                          ) : null}
                        </p>
                        <span className="text-right font-wds-sans text-[14px] text-wds-text-secondary">{nameAndTitle(event.actor)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {data ? (
        <CancelDispatchDialog
          dispatchId={id}
          reference={data.reference}
          departmentName={data.department.name}
          signedAtLabel={clock(data.signed.at)}
          lineCount={data.lineCount}
          returnFocus={() => moreRef.current}
          open={cancelling && data.can.cancel}
          onOpenChange={(open) => setParam({ dialog: open ? 'cancel' : null })}
          onCancelled={() => {
            setParam({ dialog: null });
            toast('success', 'Cancelled. The stock is back in the Central Store and the lines are in To pack.', 'The note prints marked void.');
            void reload();
          }}
          onAlreadyCounted={() => {
            setParam({ dialog: null });
            toast('error', 'The branch has already counted this delivery, so it cannot be cancelled.', 'Any gap is now a discrepancy.');
            void reload();
          }}
        />
      ) : null}
      {data ? (
        <ConfirmForDepartmentDrawer
          dispatchId={id}
          reference={data.reference}
          departmentName={data.department.name}
          lineCount={data.lineCount}
          leftAtLabel={clock(data.signed.at)}
          open={confirming && data.can.confirmForDepartment}
          onOpenChange={(open) => setParam({ drawer: open ? 'confirm' : null })}
          onConfirmed={(summary) => {
            setParam({ drawer: null });
            toast('success', `Confirmed on behalf of ${data.department.name}`, summary);
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}

export type { DispatchFile };
