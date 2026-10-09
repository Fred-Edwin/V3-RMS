'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui2/skeleton';
import { PagerBar } from '../../../_shared/components/block2-phone-parts';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePhoneListParams } from '../../../_shared/hooks/use-phone-list-params';
import { PHONE_FILTER_HIT, PHONE_PRIMARY_BUTTON_TOKEN } from '../../../_shared/lib/phone-styles';
import { clockLabel, todayLabel } from '../../../counting/_shared/lib/count-format';
import { BRANCH_WASTE_BUTTONS, BRANCH_WASTE_MESSAGES, BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import type { BranchWasteEntry, MyBranchWasteList } from '../../_shared/types/waste-contract';
import { useDepartmentName } from '../hooks/use-department-name';
import { entryMeta, groupByDay } from '../lib/branch-waste-format';
import { branchWasteApi } from '../services/branch-waste-api';
import { BranchHeader, SectionLabel } from './parts';
import { ReversedDetailSheet, ReverseSheet } from './reverse-sheet';

const WASTE = '/app/waste';
const PAGE_SIZE = 50;

function EntryRow({ entry, meId, onReverse, onShowReversed }: { entry: BranchWasteEntry; meId: string | undefined; onReverse: (e: BranchWasteEntry) => void; onShowReversed: (e: BranchWasteEntry) => void }) {
  const reversed = entry.status === 'REVERSED';
  return (
    <li data-entry-id={entry.id} className="flex min-h-[62px] items-center gap-3 border-b border-wds-neutral-100 px-3.5 py-2 last:border-b-0">
      <span className="flex min-w-0 grow flex-col">
        <span className={cn('truncate font-wds-sans text-[15px] leading-[18px]', reversed ? 'text-[#8D8982] line-through' : 'text-wds-text-ink')}>{entry.itemName}</span>
        <span className={cn('font-wds-sans text-[12px] leading-4', reversed ? 'text-[#8D8982]' : 'text-wds-text-secondary')}>{entryMeta(entry, meId)}</span>
      </span>
      {reversed && entry.reversal ? (
        <button
          type="button"
          data-reversed-chip
          onClick={() => onShowReversed(entry)}
          aria-label={`Reversed ${clockLabel(entry.reversal.at)}. Show why for ${entry.itemName}`}
          className="relative shrink-0 border border-wds-border-strong bg-wds-neutral-100 px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary outline-none before:absolute before:-inset-x-1 before:-inset-y-[11px] before:content-[''] focus-visible:shadow-wds-ring"
        >
          Reversed {clockLabel(entry.reversal.at)}
        </button>
      ) : entry.can.reverse ? (
        <button
          type="button"
          data-reverse-button
          onClick={() => onReverse(entry)}
          className={cn(PHONE_FILTER_HIT, 'h-[34px] shrink-0 border border-wds-border-strong bg-wds-surface px-3.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none transition-[background-color,transform] focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97] [@media(hover:hover)]:hover:bg-wds-neutral-50')}
        >
          {BRANCH_WASTE_BUTTONS.reverseLink}
          <span className="sr-only"> {entry.itemName}</span>
        </button>
      ) : null}
    </li>
  );
}

/**
 * The department's waste, today and earlier (Paper step 55, which supersedes W4): every entry of the caller's department over a date
 * range (starting at the last 7 days, in the URL), grouped by the Nairobi day logged. "you" marks the caller's own rows; Reverse shows
 * only where the server says `can.reverse` (own entry, same day). Reversed entries are struck through with a "Reversed 09:12" chip (a tap
 * shows the reason). After logging, the success banner shows once and clears on refresh. No money, no stock figures, no PIN.
 */
export function DepartmentWasteScreen() {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const { today, range, page, params, setQuery } = usePhoneListParams('last7');
  const [justLogged] = React.useState(() => params.get('logged') === '1');
  const key = `bw-mine:${range.from}:${range.to}:${page}`;
  const load = useLoader<MyBranchWasteList>(key, () => branchWasteApi.mine({ from: range.from, to: range.to, page, pageSize: PAGE_SIZE }), BRANCH_WASTE_STATES_COPY.department.error);
  const { data, setData } = load;
  const [reversing, setReversing] = React.useState<BranchWasteEntry | null>(null);
  const [showing, setShowing] = React.useState<BranchWasteEntry | null>(null);
  const [notice, setNotice] = React.useState('');
  const [refocusId, setRefocusId] = React.useState<string | null>(null);
  const groups = React.useMemo(() => (data ? groupByDay(data.rows, today) : []), [data, today]);
  // The header keeps the department's name while the list loads or fails: the cached lookup stands in for the list's own.
  const lookedUp = useDepartmentName();
  const department = data?.department.name ?? lookedUp;
  const titleName = data?.department.name ?? (lookedUp === 'your department' ? 'Department' : lookedUp);

  // The banner is for the moment right after logging: drop the marker from the URL so a refresh shows the plain list.
  React.useEffect(() => {
    if (justLogged) setQuery({ logged: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival; setQuery changes with every URL change and must not retrigger it
  }, [justLogged]);

  // After a reversal the Reverse button is gone: land focus on the row's new "Reversed" chip.
  React.useEffect(() => {
    if (!refocusId) return;
    document.querySelector<HTMLElement>(`[data-entry-id="${refocusId}"] [data-reversed-chip]`)?.focus();
    setRefocusId(null);
  }, [refocusId, data]);

  let body: React.ReactNode;
  if (load.status === 'error' && !data) {
    body = <ScwStatePanel kind="error" phone text={BRANCH_WASTE_STATES_COPY.department.error} onRetry={() => void load.reload()} />;
  } else if (!data) {
    body = (
      <>
        <LoadingAnnouncer text={BRANCH_WASTE_STATES_COPY.department.loading} />
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-3 w-44" />
          <ul className="border border-wds-border bg-wds-surface">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex h-[62px] items-center gap-3 border-b border-wds-neutral-100 px-3.5 last:border-b-0">
                <span className="flex grow flex-col gap-1.5">
                  <Skeleton className="h-[15px] w-36" />
                  <Skeleton className="h-3 w-52" />
                </span>
                <Skeleton className="h-[34px] w-[78px]" />
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  } else if (data.rows.length === 0) {
    body = <ScwStatePanel kind="empty" phone text={BRANCH_WASTE_STATES_COPY.department.empty} actionLabel="Log waste" onAction={() => router.push(`${WASTE}/new`)} />;
  } else {
    body = (
      <>
        {groups.map((group) => (
          <section key={group.day} aria-label={group.heading} className="flex flex-col gap-3">
            <SectionLabel>
              {group.heading} · {group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'}
            </SectionLabel>
            <ul className="border border-wds-border bg-wds-surface">
              {group.rows.map((entry) => (
                <EntryRow key={entry.id} entry={entry} meId={me?.id} onReverse={setReversing} onShowReversed={setShowing} />
              ))}
            </ul>
          </section>
        ))}
        <p className="border border-wds-info-border bg-wds-info-bg px-3 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-info-fg">{BRANCH_WASTE_MESSAGES.departmentNote}</p>
      </>
    );
  }

  return (
    <PhoneColumn>
      <BranchHeader
        leading="back"
        onBack={() => (window.history.length > 1 ? router.back() : router.push('/app/deliveries'))}
        title={`${titleName} waste`}
        subtitle={`${todayLabel()} · ${department}`}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            label="Date"
            showLabel
            today={today}
            value={range}
            onChange={(r) => setQuery({ from: r?.from ?? null, to: r?.to ?? null })}
            note="Later dates can’t be picked. Entries are listed by the day they were logged."
            buttonClassName={`h-[34px] max-sm:h-[34px] rounded-none px-3 font-wds-sans text-[13px] leading-4 ${PHONE_FILTER_HIT}`}
          />
        </div>
        {justLogged && data?.bannerText ? (
          <div role="status" className="flex items-center gap-2.5 border border-wds-success-border bg-wds-success-bg px-3.5 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
              <path d="M5 12l5 5 9-10" fill="none" stroke="var(--wds-success-fg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-success-fg">{data.bannerText}</p>
          </div>
        ) : null}
        {body}
        <div className="grow" />
        {data && data.page.total > PAGE_SIZE ? (
          <PagerBar page={page} pageSize={PAGE_SIZE} total={data.page.total} shown={data.rows.length} onPage={(p) => setQuery({ page: p === 1 ? null : String(p) })} noun="entries" />
        ) : null}
        <p role="status" aria-live="polite" className="sr-only">
          {notice}
        </p>
      </div>
      <div className="shrink-0 px-4 pb-5 pt-2">
        <Link href={`${WASTE}/new`} className={cn(PHONE_PRIMARY_BUTTON_TOKEN, 'h-[50px] w-full text-[16px] leading-5')}>
          {BRANCH_WASTE_BUTTONS.more}
        </Link>
      </div>
      <ReverseSheet
        entry={reversing}
        onClose={() => setReversing(null)}
        onDone={(updated) => {
          setData((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === updated.id ? updated : r)) } : d));
          setReversing(null);
          setRefocusId(updated.id);
          setNotice(`${updated.itemName} reversed. The stock went back.`);
        }}
      />
      <ReversedDetailSheet entry={showing} onClose={() => setShowing(null)} />
    </PhoneColumn>
  );
}
