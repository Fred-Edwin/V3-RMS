'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { PHONE_PRIMARY_BUTTON, PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { itemsLabel, todayLabel } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { StartSection } from '../../_shared/types/counting-contract';
import { useStartOptions } from '../hooks/use-start-options';
import { ReorderSheet } from './reorder-sheet';

const COUNTS = '/app/inventory/stock/counts';
const WASTE_NEW = '/app/inventory/stock/waste/new';

/**
 * Pick a section: the Store Attendant's way into a count (Paper step 1, `1WGA-0`), with the reorder-for-today list (step 40,
 * `245F-0`) one tap away. A phone-width centred column at every width. Tapping a section starts a count of it (C9) or, when this
 * person already has a count open, offers to resume it; "Review and sign" opens that count's review; a section someone else is
 * counting is shown as theirs and cannot be started.
 */
export function PickSectionScreen() {
  const router = useRouter();
  const { can, ready } = usePermissions();
  const options = useStartOptions();
  const idem = useIdempotencyKey();
  const [query, setQuery] = React.useState('');
  const [startingId, setStartingId] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [reordering, setReordering] = React.useState(false);

  const start = React.useCallback(
    async (section: StartSection): Promise<void> => {
      if (startingId) return;
      setStartingId(section.id);
      setFailure(null);
      try {
        const count = await countingApi.start({ sectionIds: [section.id], idempotencyKey: idem.key() });
        idem.renew();
        router.push(`${COUNTS}/${count.id}/count`);
      } catch (err) {
        setFailure(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.startCount.error));
        setStartingId(null);
        void options.reload();
      }
    },
    [startingId, idem, router, options],
  );

  const data = options.data;
  const canCount = ready && can('counts.record');
  const open = data?.openCount ?? null;
  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data?.sections ?? []).filter((s) => !term || s.name.toLowerCase().includes(term) || (s.supplierName ?? '').toLowerCase().includes(term));
  }, [data, query]);

  const header = <ScwPhoneHeader leading="menu" title="Stock & counts" subtitle={`${todayLabel()} · Central Store`} />;

  if (ready && !can('counts.record')) {
    return (
      <PhoneColumn>
        {header}
        <ScwStatePanel kind="permission" phone text={COUNTING_STATES_COPY.pickSection.permission} />
      </PhoneColumn>
    );
  }

  if (reordering && data) {
    return (
      <PhoneColumn>
        {header}
        <ReorderSheet
          sections={data.sections}
          onDone={() => {
            setReordering(false);
            void options.reload();
          }}
        />
      </PhoneColumn>
    );
  }

  return (
    <PhoneColumn>
      {header}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-3 px-4 pt-4">
          <label className="flex h-11 shrink-0 items-center gap-2 border border-wds-border bg-wds-surface px-3 transition-shadow duration-150 focus-within:border-wds-selected-edge focus-within:shadow-wds-ring">
            <span className="size-3 shrink-0 rounded-[6px] border-[1.5px] border-wds-neutral-500" aria-hidden />
            <span className="sr-only">Find an item to count</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an item to count"
              autoComplete="off"
              className="min-w-0 grow bg-transparent font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-wds-text-muted"
            />
          </label>
          <div className="flex items-center justify-between pt-1">
            <h2 className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
              {data?.order.mode === 'TODAY' ? 'Sections · my order for today' : 'Sections · in shelf order'}
            </h2>
            {data && data.sections.length > 1 && canCount && !open ? (
              <button
                type="button"
                onClick={() => setReordering(true)}
                className="-my-3 flex h-11 items-center px-1 font-wds-sans text-[12px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring"
              >
                Reorder
              </button>
            ) : null}
          </div>
        </div>

        {failure ? <FormErrorBanner className="mx-4 mt-2" title="Could not start the count" description={failure} /> : null}

        {options.status === 'loading' || (options.status === 'idle' && !data) ? (
          <>
            <LoadingAnnouncer text={COUNTING_STATES_COPY.pickSection.loading} />
            <div className="flex flex-col gap-2 px-4 pt-2" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex h-[69px] items-center gap-3 border border-wds-border bg-wds-surface p-3.5">
                  <div className="flex grow flex-col gap-2">
                    <Skeleton className="h-4 w-[40%]" />
                    <Skeleton className="h-3 w-[65%]" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-2.5 w-14" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : options.status === 'error' ? (
          <ScwStatePanel kind="error" phone text={COUNTING_STATES_COPY.pickSection.error} onRetry={() => void options.reload()} />
        ) : data && data.sections.length === 0 ? (
          <ScwStatePanel kind="empty" phone text={COUNTING_STATES_COPY.pickSection.empty} />
        ) : (
          <>
            {open ? (
              <div className="px-4 pt-2">
                <button
                  type="button"
                  onClick={() => router.push(`${COUNTS}/${open.id}/count`)}
                  className="flex w-full items-center gap-3 border border-wds-warning-border bg-wds-warning-bg p-3.5 text-left outline-none transition-[background-color,transform] duration-100 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.99]"
                >
                  <span className="flex grow flex-col gap-0.5">
                    <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-warning-fg">Your count is open · {open.reference}</span>
                    <span className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{open.sectionsText}</span>
                    <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{open.progressText}</span>
                  </span>
                  <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-selected-edge">Resume</span>
                </button>
              </div>
            ) : null}
            <ul className="flex flex-col gap-2 px-4 pt-2">
              {filtered.map((section) => (
                <li key={section.id}>
                  <SectionCard section={section} disabled={Boolean(open) || !canCount || Boolean(section.busy)} starting={startingId === section.id} onPick={() => void start(section)} />
                </li>
              ))}
            </ul>
            {filtered.length === 0 ? (
              <p className="px-4 pt-3 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary" role="status">
                No section called “{query.trim()}”. Clear the search to see every section.
              </p>
            ) : null}
          </>
        )}

        <div className="grow" />
        <div className="flex shrink-0 flex-col gap-2 px-4 pb-5 pt-3">
          <button
            type="button"
            disabled={!open}
            onClick={() => open && router.push(`${COUNTS}/${open.id}/sign`)}
            title={open ? undefined : 'Count something first'}
            className={cn(PHONE_PRIMARY_BUTTON, 'h-12 text-[15px] leading-[18px]')}
          >
            Review and sign
          </button>
          {!open ? <p className="sr-only">Review and sign is available once you have started counting.</p> : null}
          <button type="button" onClick={() => router.push(WASTE_NEW)} className={PHONE_SECONDARY_BUTTON}>
            Log waste
          </button>
        </div>
      </div>
    </PhoneColumn>
  );
}

function SectionCard({ section, disabled, starting, onPick }: { section: StartSection; disabled: boolean; starting: boolean; onPick: () => void }) {
  const detail = [section.supplierName, itemsLabel(section.itemCount)].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-busy={starting || undefined}
      className={cn(
        'flex w-full items-center gap-3 border border-wds-border bg-wds-surface p-3.5 text-left outline-none transition-[background-color,transform,box-shadow,opacity] duration-100 focus-visible:shadow-wds-ring',
        'enabled:[@media(hover:hover)]:hover:bg-wds-neutral-50 enabled:motion-safe:active:scale-[0.99] enabled:active:bg-wds-neutral-100',
        starting && 'bg-wds-neutral-50',
        disabled && 'cursor-not-allowed',
      )}
    >
      <span className={cn('flex min-w-0 grow flex-col gap-[3px]', disabled && !starting && 'opacity-60')}>
        <span className="truncate font-wds-sans text-[17px] font-semibold leading-[22px] text-wds-text-ink">{section.name}</span>
        <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{detail}</span>
      </span>
      {section.busy ? (
        <span className="flex max-w-[45%] flex-col items-end gap-[3px] text-right">
          <span className="font-wds-mono text-[12px] leading-4 text-wds-warning-fg">In use</span>
          <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{section.busy.counterName.split(' ')[0]} is counting it</span>
        </span>
      ) : (
        <span className={cn('flex flex-col items-end gap-[3px]', disabled && !starting && 'opacity-60')}>
          <span className={cn('font-wds-mono text-[12px] leading-4', section.longestSinceCount ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{section.lastCountedText}</span>
          <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">last counted</span>
        </span>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className={cn('shrink-0 text-wds-text-muted', starting && 'motion-safe:animate-pulse')}>
        <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
