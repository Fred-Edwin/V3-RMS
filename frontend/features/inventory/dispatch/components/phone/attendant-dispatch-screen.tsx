'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { DateRangePicker, type DateRange } from '@/components/ui2/date-range-picker';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Empty, B2Header, B2TabPanel, Chip, ListSkeleton, OutlineChip, PagerBar, RefLink } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { couldNotLoad, doneRowChip, EMPTY_COPY, onTheWayRowChip } from '../../../_shared/lib/block2-words';
import { dateTimeText, fullDateText, timeText } from '../../../requisitions/lib/time';
import type { DispatchMineRow, Queue, QueueCard } from '../../_shared/types/dispatch-contract';
import { useDispatchMine, useDispatchQueue } from '../../hooks/use-phone-dispatch';
import { dispatchFile, packDepartment, packOverview } from '../../lib/phone-routes';
import { waitChip } from '../../lib/pack-logic';

type TabKey = 'to-pack' | 'on-the-way' | 'done';
const TABS = [
  { key: 'to-pack', label: 'To pack' },
  { key: 'on-the-way', label: 'On the way' },
  { key: 'done', label: 'Done' },
] as const;
const PAGE_SIZE = 25;
const nairobiDay = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d);
const daysBefore = (day: string, n: number): string => new Date(new Date(`${day}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

/** A minute-by-minute clock so "Waiting 29 min" moves without a refetch. */
function useNow(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** The Store Attendant's Dispatch (Paper D1, gap fixes G3, Block 2 gaps N2 and N2b): To pack, On the way, Done. */
export function AttendantDispatchScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get('tab');
  const tab: TabKey = TABS.find((t) => t.key === tabParam)?.key ?? 'to-pack';
  const queue = useDispatchQueue();

  const setQuery = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  const waiting = queue.data?.branchesToPack ?? 0;
  const subtitle = tab === 'to-pack' && queue.data ? (waiting === 0 ? 'Nothing waiting' : `${waiting} ${waiting === 1 ? 'branch' : 'branches'} waiting · oldest first`) : `${fullDateText(new Date().toISOString())} · Central Store`;

  return (
    <PhoneColumn>
      <B2Header
        title={tab === 'to-pack' ? 'To pack' : 'Dispatch'}
        subtitle={subtitle}
        leading="menu"
        place="CENTRAL STORE"
        tabs={{ items: TABS, active: tab, label: 'Dispatch', onChange: (key) => setQuery({ tab: key === 'to-pack' ? null : key, page: null, branch: null }) }}
      />
      <B2TabPanel active={tab} className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        {tab === 'to-pack' ? <ToPackTab queue={queue} /> : <MineTab tab={tab} params={params} setQuery={setQuery} />}
      </B2TabPanel>
    </PhoneColumn>
  );
}

// --- To pack (D1) -----------------------------------------------------------------------------------------------------------------

function ToPackTab({ queue }: { queue: ReturnType<typeof useDispatchQueue> }) {
  const now = useNow();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const data: Queue | null = queue.data;
  if (queue.status === 'error') {
    return (
      <div role="alert" className="p-5">
        <MobileErrorState title="Could not load To pack" description={couldNotLoad('To pack')} onRetry={() => void queue.reload()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-5">
        <LoadingAnnouncer text="Loading To pack" />
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (data.cards.length === 0) {
    return (
      <div className="p-5">
        <B2Empty title={EMPTY_COPY.toPack.title} description={EMPTY_COPY.toPack.line} />
      </div>
    );
  }
  const first = data.cards[0]?.requisitionId ?? null;
  const expanded = openId ?? first;
  return (
    <div className="flex flex-col gap-4 p-5">
      {data.cards.map((card) => (
        <BranchCard key={card.requisitionId} card={card} now={now} expanded={card.requisitionId === expanded} onToggle={() => setOpenId(card.requisitionId === expanded ? '' : card.requisitionId)} />
      ))}
    </div>
  );
}

const Chevron = ({ down = false }: { down?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
    <path d={down ? 'M3 6L8 11L13 6' : 'M6 3L11 8L6 13'} fill="none" stroke="var(--wds-neutral-500)" strokeWidth="1.5" />
  </svg>
);

function BranchCard({ card, now, expanded, onToggle }: { card: QueueCard; now: number; expanded: boolean; onToggle: () => void }) {
  const wait = waitChip(card.approvedAt, now);
  const cycle = card.cycleLabel.split(' · ')[0] ?? card.cycleLabel;
  const startHere = card.departments.find((d) => d.state !== 'PACKED')?.departmentId ?? null;
  const packed = card.departments.filter((d) => d.state === 'PACKED').length;
  // Paper D1: the wait chip on the card header is 3 px tall above and below (the row pills are 2 px).
  const waitChipEl = <OutlineChip tone={wait.amber ? 'warning' : 'plain'} className="py-[3px]">{wait.text}</OutlineChip>;
  const headId = `branch-${card.requisitionId}`;
  if (!expanded) {
    return (
      <section aria-labelledby={headId} className="border border-wds-border bg-wds-surface">
        <button type="button" onClick={onToggle} aria-expanded={false} className="flex w-full flex-col gap-1.5 p-4 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]">
          <span className="flex items-center justify-between gap-2.5">
            <span id={headId} className="font-wds-sans text-[18px] font-semibold leading-6 tracking-[-0.01em] text-wds-text-ink">
              {card.branch.name}
            </span>
            <span className="flex items-center gap-2.5">
              {waitChipEl}
              <Chevron down />
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-wds-mono text-[13px] leading-[18px] text-wds-text-secondary">{card.reference}</span>
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              {cycle} · {card.departments.length} {card.departments.length === 1 ? 'department' : 'departments'} · {card.lineCount} lines
            </span>
          </span>
        </button>
      </section>
    );
  }
  return (
    <section aria-labelledby={headId} className="flex flex-col border border-wds-border bg-wds-surface">
      <div className="flex flex-col gap-1.5 px-4 pb-3.5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id={headId} className="font-wds-sans text-[18px] font-semibold leading-6 tracking-[-0.01em] text-wds-text-ink">
            {card.branch.name}
          </h2>
          <span className="flex items-center gap-2.5">
            {waitChipEl}
            <button type="button" onClick={onToggle} aria-expanded aria-label={`Collapse ${card.branch.name}`} className="-m-3 flex size-11 items-center justify-center outline-none focus-visible:shadow-wds-ring">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 10L8 5L13 10" fill="none" stroke="var(--wds-neutral-500)" strokeWidth="1.5" />
              </svg>
            </button>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-wds-mono text-[13px] leading-[18px] text-wds-text-secondary">{card.reference}</span>
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
            {cycle} · approved {timeText(card.approvedAt)}
          </span>
        </div>
      </div>
      <ul className="border-t border-wds-text-ink">
        {card.departments.map((d) => {
          const here = d.departmentId === startHere;
          return (
            <li key={d.departmentId} className="border-b border-wds-border last:border-b-0">
              <Link
                href={packDepartment(card.requisitionId, d.departmentId)}
                className={cn('flex items-center gap-3 px-4 py-[13px] outline-none transition-colors duration-100 hover:bg-wds-neutral-50 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]', here && 'bg-wds-caramel-100 hover:bg-wds-caramel-100')}
              >
                <span className="flex min-w-0 grow basis-0 flex-col gap-0.5">
                  <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{d.departmentName}</span>
                  <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{d.lineCount} {d.lineCount === 1 ? 'line' : 'lines'}</span>
                </span>
                {d.state === 'PACKED' ? (
                  <Chip spec={{ text: 'Packed', tone: 'success' }} />
                ) : d.state === 'PACKING' ? (
                  <OutlineChip tone="warning">
                    Packing {d.packedCount} of {d.lineCount}
                  </OutlineChip>
                ) : here ? (
                  <span className="bg-wds-sidebar-top px-[9px] py-[3px] font-wds-sans text-[12px] leading-4 text-wds-neutral-0">Start here</span>
                ) : (
                  <OutlineChip>To pack</OutlineChip>
                )}
                <Chevron />
              </Link>
            </li>
          );
        })}
      </ul>
      {packed > 0 ? (
        <div className="flex items-center justify-between gap-3 border-t border-wds-border bg-wds-neutral-50 px-4 py-2.5">
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
            {packed} of {card.departments.length} departments packed
          </p>
          <Link href={packOverview(card.requisitionId)} className="-my-3 flex min-h-11 items-center rounded-wds-sm px-1 font-wds-sans text-[13px] font-medium leading-[18px] text-[var(--wds-primary-btn-start)] outline-none hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring">
            Go to the final review
          </Link>
        </div>
      ) : null}
    </section>
  );
}

// --- On the way (N2, N2b) and Done (G3) -----------------------------------------------------------------------------------------------

function MineTab({ tab, params, setQuery }: { tab: 'on-the-way' | 'done'; params: URLSearchParams; setQuery: (patch: Record<string, string | null>) => void }) {
  const [today] = React.useState(() => nairobiDay(new Date()));
  const range: DateRange = React.useMemo(() => ({ from: params.get('from') ?? daysBefore(today, 6), to: params.get('to') ?? today }), [params, today]);
  const branchId = params.get('branch') ?? undefined;
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const mine = useDispatchMine({ tab, ...(tab === 'done' ? { from: range.from, to: range.to } : {}), branchId, page, pageSize: PAGE_SIZE });
  const data = mine.data;

  // The branch filter lists every branch seen so far, so choosing one does not empty the list of choices.
  const known = React.useRef(new Map<string, string>());
  for (const row of data?.rows ?? []) known.current.set(row.branch.id, row.branch.name);
  if (branchId && !known.current.has(branchId)) known.current.set(branchId, 'This branch');

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      {tab === 'done' ? (
        <DateRangePicker label="Date" today={today} value={range} onChange={(r) => setQuery({ from: r?.from ?? null, to: r?.to ?? null, page: null })} buttonClassName="h-[34px] max-sm:h-[34px] rounded-none px-3 font-wds-sans text-[13px] leading-4" />
      ) : null}
      <label className="relative flex h-[34px] items-center border border-wds-border-strong bg-wds-surface">
        <span className="sr-only">Branch</span>
        <select
          aria-label="Branch"
          value={branchId ?? ''}
          onChange={(e) => setQuery({ branch: e.target.value || null, page: null })}
          className="h-full appearance-none bg-transparent pl-3 pr-8 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none focus-visible:shadow-wds-ring"
        >
          <option value="">Branch: All</option>
          {Array.from(known.current.entries()).map(([id, name]) => (
            <option key={id} value={id}>
              Branch: {name}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-3 text-[9px] text-wds-text-ink">
          ▾
        </span>
      </label>
    </div>
  );

  const requisitionsOut = data ? groupCount(data.rows) : 0;
  const noun = tab === 'on-the-way' ? `${requisitionsOut === 1 ? 'requisition' : 'requisitions'} on the way` : 'dispatches';
  let body: React.ReactNode;
  if (mine.status === 'error') {
    body = (
      <div role="alert">
        <MobileErrorState title={`Could not load ${tab === 'done' ? 'Done' : 'On the way'}`} description={couldNotLoad(tab === 'done' ? 'Done' : 'On the way')} onRetry={() => void mine.reload()} />
      </div>
    );
  } else if (!data) {
    body = (
      <>
        <LoadingAnnouncer text={`Loading ${tab === 'done' ? 'Done' : 'On the way'}`} />
        <ListSkeleton rows={4} />
      </>
    );
  } else if (data.rows.length === 0) {
    const copy = tab === 'done' ? EMPTY_COPY.done : EMPTY_COPY.onTheWay;
    body = <B2Empty title={copy.title} description={copy.line} />;
  } else if (tab === 'done') {
    body = (
      <ul className="border border-wds-border bg-wds-surface">
        {data.rows.map((row) => (
          <DoneRow key={row.id} row={row} />
        ))}
      </ul>
    );
  } else {
    body = <OnTheWayGroups rows={data.rows} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      {filters}
      <div className="mt-3 flex flex-col gap-3">{body}</div>
      <div className="grow" />
      {data && data.page.total > 0 ? (
        tab === 'done' ? (
          <PagerBar page={page} pageSize={PAGE_SIZE} total={data.page.total} shown={data.rows.length} onPage={(p) => setQuery({ page: p === 1 ? null : String(p) })} noun="" />
        ) : (
          <p className="pb-5 pt-3 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary" aria-live="polite">
            Showing {groupCount(data.rows)} of {groupCount(data.rows)} {noun}
          </p>
        )
      ) : null}
    </div>
  );
}

const batchKey = (row: DispatchMineRow): string => `${row.branch.id}|${row.signedAt}`;
const groupCount = (rows: readonly DispatchMineRow[]): number => new Set(rows.map(batchKey)).size;

function DoneRow({ row }: { row: DispatchMineRow }) {
  return (
    <li className="border-b border-wds-neutral-100 last:border-b-0">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
          <RefLink reference={row.reference} href={dispatchFile(row.id)} className="text-[13px] leading-4" />
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
            {row.branch.name} · {row.department.name} · {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}
          </span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Signed and sent {dateTimeText(row.signedAt)}</span>
        </div>
        <Chip spec={doneRowChip(row.result)} />
      </div>
    </li>
  );
}

/** One card per requisition sent together, one row per department (N2). */
function OnTheWayGroups({ rows }: { rows: readonly DispatchMineRow[] }) {
  const groups = React.useMemo(() => {
    const map = new Map<string, DispatchMineRow[]>();
    for (const row of rows) map.set(batchKey(row), [...(map.get(batchKey(row)) ?? []), row]);
    return Array.from(map.entries());
  }, [rows]);
  return (
    <>
      {groups.map(([key, group]) => {
        const head = group[0];
        if (!head) return null;
        return (
          <section key={key} aria-label={`${head.branch.name}, left ${timeText(head.signedAt)}`} className="border border-wds-border bg-wds-surface">
            <div className="flex items-start justify-between gap-3 px-3.5 py-3">
              <div className="flex min-w-0 flex-col gap-[3px]">
                <h2 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{head.branch.name}</h2>
                <span className="flex items-center gap-1.5">
                  <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{head.requisition.reference}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">· {head.requisition.cycleLabel.split(' · ')[0]}</span>
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-[3px] text-right">
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-ink">Left {timeText(head.signedAt)}</span>
                {head.carrier ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{head.carrier.name}</span> : null}
              </div>
            </div>
            <ul className="border-t border-wds-border">
              {group.map((row) => (
                <li key={row.id} className="flex items-center gap-2.5 border-b border-wds-neutral-100 px-3.5 py-[11px] last:border-b-0">
                  <div className="flex min-w-0 grow basis-0 flex-col gap-0.5">
                    <RefLink reference={row.reference} href={dispatchFile(row.id)} className="text-[12px] leading-4" />
                    <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
                      {row.department.name} · {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}
                    </span>
                  </div>
                  <Chip spec={onTheWayRowChip(row.stage)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
