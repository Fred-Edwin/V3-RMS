'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { ScwCheckbox } from '../../../_shared/components/scw-checkbox';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { BottomSheet } from '../../../_shared/components/bottom-sheet';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { stockApi } from '../../../stock/_shared/services/stock-api';
import type { StockItemRow } from '../../../stock/_shared/types/stock-contract';
import { itemsLabel } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import { useStartOptions } from '../hooks/use-start-options';
import { ReorderSheet } from './reorder-sheet';

const COUNTS = '/app/inventory/stock/counts';

/**
 * Start a count, for the Manager (Paper step 12 `1YJM-0`) and "Start a count, item picked" (step 49 `25M7-0`, `?recount=<lineId>`).
 * Pick whole sections with the shelf order and "longest since a count" tag, see what you are about to count in the side panel, and
 * Start counting (C9). With `?recount=` the page is scoped to the item that is being checked again (a banner links back to the old
 * count) and more items can be added by name. A section someone else is counting cannot be picked. A person without `counts.record`
 * is sent to the Counts list (the Attendant starts a count from Pick a section). The idempotency key is made when the page opens.
 */
export function StartCountScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const recountLineId = params.get('recount') ?? undefined;
  const { can, ready } = usePermissions();
  const options = useStartOptions(recountLineId);
  const idem = useIdempotencyKey();
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [extra, setExtra] = React.useState<{ itemId: string; name: string; unit: string }[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [reorder, setReorder] = React.useState(false);

  React.useEffect(() => {
    if (ready && !can('counts.read')) router.replace(COUNTS);
  }, [ready, can, router]);

  const data = options.data;
  const recount = data?.recount ?? null;
  const sections = data?.sections ?? [];
  const chosen = sections.filter((s) => picked.has(s.id));
  const total = recount ? 1 + extra.length : chosen.reduce((n, s) => n + s.itemCount, 0);
  const selectable = sections.filter((s) => !s.busy);

  const toggle = (id: string): void =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const start = async (): Promise<void> => {
    if (starting) return;
    setStarting(true);
    setFailure(null);
    try {
      const detail = await countingApi.start(
        recount
          ? { recountOfLineId: recount.lineId, ...(extra.length > 0 ? { itemIds: extra.map((e) => e.itemId) } : {}), idempotencyKey: idem.key() }
          : { sectionIds: sections.filter((s) => picked.has(s.id)).map((s) => s.id), idempotencyKey: idem.key() },
      );
      idem.renew();
      router.push(`${COUNTS}/${detail.id}/count`);
    } catch (err) {
      setFailure(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.startCount.error));
      setStarting(false);
      void options.reload();
    }
  };

  const topbar = (
    <ScwTopbar
      search={false}
      breadcrumb={{ root: 'Central Store', section: 'Counts', sectionHref: COUNTS, screen: 'New count' }}
      actions={
        <Button variant="secondary" asChild>
          <Link href={COUNTS}>Cancel</Link>
        </Button>
      }
    />
  );

  if (ready && !can('counts.record')) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topbar}
        <ScwStatePanel kind="permission" text={COUNTING_STATES_COPY.startCount.permission} className="m-8" />
      </div>
    );
  }

  const panelNames = recount ? `${recount.itemName} · recount of ${recount.countReference}` : `${chosen.map((s) => s.name).join(', ')} · ${chosen.length} section${chosen.length === 1 ? '' : 's'}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar}
      <main className="flex min-h-0 flex-1 flex-wrap content-start gap-8 overflow-y-auto px-8 py-7">
        <div className="flex min-w-[420px] grow basis-0 flex-col gap-[18px]">
          <div className="flex flex-col gap-1">
            <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Start a count</h1>
            <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
              {recount ? 'Count just the item you are checking again. Sections stay as they are.' : 'Pick the sections to count. Anything you leave out is simply not counted today.'}
            </p>
          </div>

          {failure ? <FormErrorBanner title="Could not start the count" description={failure} /> : null}

          {options.status === 'loading' || (options.status === 'idle' && !data) ? (
            <>
              <LoadingAnnouncer text={COUNTING_STATES_COPY.startCount.loading} />
              <div className="flex flex-col gap-2.5" aria-hidden>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex h-[74px] items-center gap-4 border border-wds-border bg-wds-surface px-[18px]">
                    <Skeleton className="size-[18px]" />
                    <div className="flex grow flex-col gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </>
          ) : options.status === 'error' ? (
            <ScwStatePanel kind="error" text={COUNTING_STATES_COPY.startCount.error} onRetry={() => void options.reload()} />
          ) : data && sections.length === 0 ? (
            <ScwStatePanel kind="empty" text={COUNTING_STATES_COPY.startCount.empty} actionLabel="Open Count setup" onAction={() => router.push(`${COUNTS}/setup`)} />
          ) : data ? (
            <>
              {data.openCount ? (
                <div className="flex items-center justify-between gap-3 border border-wds-warning-border bg-wds-warning-bg px-4 py-3" role="status">
                  <span className="font-wds-sans text-[13px] leading-[19px] text-wds-warning-fg">
                    You already have a count open ({data.openCount.reference}, {data.openCount.sectionsText}). Finish or sign it before starting another.
                  </span>
                  <Button size="sm" onClick={() => router.push(`${COUNTS}/${data.openCount?.id}/count`)}>
                    Resume
                  </Button>
                </div>
              ) : null}

              {recount ? (
                <>
                  <div className="flex items-center justify-between border border-wds-info-border bg-wds-info-bg px-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-info-fg">Recount</span>
                      <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">
                        Recount of {recount.countReference} · {recount.itemName}
                      </span>
                    </span>
                    <Link href={`${COUNTS}/${recount.countId}`} className="font-wds-sans text-[12px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
                      Open {recount.countReference}
                    </Link>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Items to count</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <ItemChip name={recount.itemName} detail={`${recount.sectionName ?? 'No section'} · ${recount.unit}`} />
                      {extra.map((e) => (
                        <ItemChip key={e.itemId} name={e.name} detail={e.unit} onRemove={() => setExtra((list) => list.filter((x) => x.itemId !== e.itemId))} />
                      ))}
                      {can('stock.read') ? (
                        <button
                          type="button"
                          onClick={() => setAdding(true)}
                          className="border border-dashed border-wds-border-strong px-3.5 py-2 font-wds-sans text-[13px] leading-4 text-wds-selected-edge outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
                        >
                          + Add another item
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}

              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{recount ? 'Or count whole sections' : 'Sections · in shelf order'}</h2>
                  <button type="button" onClick={() => setReorder(true)} className="font-wds-sans text-[12px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
                    Reorder sections
                  </button>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {sections.map((section) => {
                    const on = picked.has(section.id);
                    const unavailable = Boolean(section.busy) || recount !== null;
                    return (
                      <li key={section.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-4 px-[18px] py-4 transition-colors duration-100 [@media(hover:hover)]:hover:bg-wds-neutral-50',
                            on ? 'border-[1.5px] border-wds-selected-edge bg-wds-espresso-50' : 'border border-wds-border bg-wds-surface',
                            unavailable && 'cursor-not-allowed opacity-60 hover:bg-wds-surface',
                            'focus-within:shadow-wds-ring',
                          )}
                        >
                          <ScwCheckbox checked={on} disabled={unavailable} onCheckedChange={() => toggle(section.id)} aria-label={`Count ${section.name}`} />
                          <span className="flex min-w-0 grow flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{section.name}</span>
                              {section.longestSinceCount ? <span className="border border-wds-warning-border bg-wds-warning-bg px-[5px] py-px font-wds-mono text-[9px] uppercase leading-3 tracking-[0.06em] text-wds-warning-fg">Longest since a count</span> : null}
                            </span>
                            <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{[section.supplierName, itemsLabel(section.itemCount)].filter(Boolean).join(' · ')}</span>
                          </span>
                          {section.busy ? (
                            <span className="flex flex-col items-end gap-0.5">
                              <span className="font-wds-mono text-[13px] leading-4 text-wds-warning-fg">In use</span>
                              <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{section.busy.counterName.split(' ')[0]} is counting it</span>
                            </span>
                          ) : (
                            <span className="flex flex-col items-end gap-0.5">
                              <span className={cn('font-wds-mono text-[13px] leading-4', section.longestSinceCount ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{section.lastCountedText}</span>
                              <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">last counted{section.lastCountedBy ? ` · ${section.lastCountedBy}` : ''}</span>
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : null}
        </div>

        <aside className="mt-[84px] flex w-80 shrink-0 flex-col gap-4 self-start border border-wds-border bg-wds-surface p-5" aria-label="Your count">
          <h2 className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Your count</h2>
          <div className="flex flex-col gap-0.5" aria-live="polite">
            <span className="font-wds-mono text-wds-kpi text-wds-text-secondary">{total === 0 ? '0 items' : itemsLabel(total)}</span>
            <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{total === 0 ? 'Nothing picked yet' : panelNames}</span>
          </div>
          <div className="flex flex-col gap-2 border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
            <p className="font-wds-sans text-[12px] leading-[17px] text-wds-neutral-700">You will see what the system expects as you count.</p>
            <p className="font-wds-sans text-[12px] leading-[17px] text-wds-neutral-700">Within the range, your count needs no approval. Outside it, the Director is told.</p>
          </div>
          <button
            type="button"
            disabled={total === 0 || starting || Boolean(data?.openCount) || !can('counts.record')}
            title={total === 0 ? 'Pick at least one section' : data?.openCount ? 'Finish your open count first' : undefined}
            onClick={() => void start()}
            className="flex h-11 items-center justify-center bg-wds-gradient-primary font-wds-sans text-[15px] font-semibold leading-5 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.99]"
          >
            {starting ? 'Starting…' : 'Start counting'}
          </button>
          {!recount && selectable.length > 0 ? (
            <button
              type="button"
              onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((s) => s.id)))}
              className="text-center font-wds-sans text-[12px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring"
            >
              {picked.size === selectable.length ? 'Clear the selection' : `Select all ${selectable.length} sections`}
            </button>
          ) : null}
        </aside>
      </main>

      <BottomSheet open={reorder} onOpenChange={setReorder} label="Reorder sections for today" className="max-h-[80vh]">
        {data ? (
          <ReorderSheet
            sections={data.sections}
            onDone={() => {
              setReorder(false);
              void options.reload();
            }}
          />
        ) : null}
      </BottomSheet>
      <AddItemSheet open={adding} onClose={() => setAdding(false)} taken={new Set([recount?.itemId ?? '', ...extra.map((e) => e.itemId)])} onAdd={(row) => setExtra((l) => [...l, { itemId: row.itemId, name: row.name, unit: row.unit }])} />
    </div>
  );
}

function ItemChip({ name, detail, onRemove }: { name: string; detail: string; onRemove?: () => void }) {
  return (
    <span className="flex items-center gap-2 border-[1.5px] border-wds-selected-edge bg-wds-espresso-50 px-3 py-2">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="text-[var(--wds-primary-btn-end)]">
        <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-wds-sans text-[14px] font-semibold leading-4 text-wds-text-ink">{name}</span>
      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{detail}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="-mr-1 flex size-6 items-center justify-center text-wds-text-secondary outline-none hover:text-wds-text-ink focus-visible:shadow-wds-ring">
          ×
        </button>
      ) : null}
    </span>
  );
}

/** "+ Add another item": type-ahead over the items (S2), pick one to add it to the recount. */
function AddItemSheet({ open, onClose, taken, onAdd }: { open: boolean; onClose: () => void; taken: Set<string>; onAdd: (row: StockItemRow) => void }) {
  const [text, setText] = React.useState('');
  const [rows, setRows] = React.useState<StockItemRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setText('');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = window.setTimeout(() => {
      stockApi.items({ search: text.trim() || undefined, pageSize: 25 }, controller.signal).then(
        (res) => {
          if (!controller.signal.aborted) {
            setRows(res.rows.filter((r) => !taken.has(r.itemId)).slice(0, 8));
            setLoading(false);
          }
        },
        () => {
          if (!controller.signal.aborted) setLoading(false);
        },
      );
    }, 200);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [text, open, taken]);

  return (
    <BottomSheet open={open} onOpenChange={(o) => (o ? undefined : onClose())} label="Add another item" initialFocusRef={inputRef} className="gap-3 border-t border-wds-border-strong px-5 pb-6 pt-5">
      <h2 className="font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">Add another item</h2>
      <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search an item" aria-label="Search an item" className="h-10 border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[14px] outline-none focus:border-wds-selected-edge focus:shadow-wds-ring" />
      <ul className="flex max-h-[40vh] flex-col overflow-y-auto" aria-busy={loading}>
        {rows.map((row) => (
          <li key={row.itemId} className="border-t border-wds-neutral-100 last:border-b">
            <button
              type="button"
              onClick={() => {
                onAdd(row);
                onClose();
              }}
              className="flex h-12 w-full items-center justify-between text-left outline-none hover:bg-wds-neutral-50 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-ring)]"
            >
              <span className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">{row.name}</span>
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{row.sectionName ?? 'No section'} · {row.unit}</span>
            </button>
          </li>
        ))}
        {!loading && rows.length === 0 ? <li className="py-3 font-wds-sans text-[13px] text-wds-text-secondary">No item found.</li> : null}
      </ul>
    </BottomSheet>
  );
}
