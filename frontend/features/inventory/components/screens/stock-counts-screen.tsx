'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { HintTooltip } from '@/components/app/shell/hint-tooltip';
import { Skeleton } from '@/components/ui2/skeleton';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { useCountList } from '../../hooks/use-counts';
import { useCountVerification } from '../../hooks/use-count-verification';
import { useStockSummary, useWasteList } from '../../hooks/use-stock';
import type { CountListItem, CountReasonValue, VerifierCountLine, VerifierCountView } from '../../types/count';
import type { StockSummary } from '../../types/stock';
import { PinSheet } from '../stock/pin-sheet';
import { StockTopbar } from '../stock/stock-topbar';
import { LogWasteDrawer } from '../stock/log-waste-drawer';
import { RestockLevelsDrawer } from './restock-levels-screen';
import { useCentralStoreLocation } from '../../hooks/use-central-store-location';
import { StockMobileHeader } from '../stock/stock-mobile-header';
import { HubKpiStrip } from '../stock/hub-kpi-strip';
import {
  CountRailRow,
  lineHasVariance,
  VarianceCell,
  Reveal,
  StatCell,
  VerifyLineCard,
  VerifyLineRow,
  type LineHandlers,
} from '../stock/count-verify-parts';
import {
  FormErrorBanner,
  ListRowSkeleton,
  SkeletonRows,
  StockEmptyCard,
  StockErrorCard,
  TableRowSkeleton,
} from '../stock/stock-states';
import {
  formatClock,
  formatCountDateLong,
  formatDayMonthClock,
  formatKes,
  formatSignedKes,
  formatWeekdayDate,
  shortName,
} from '../stock/stock-format';

/**
 * Verify — the Store Manager's counts screen (Milestone Six Session 2).
 *  - Awaiting `181V-0` (desktop) / `1C2H-0` list + `1C47-0` detail (mobile)
 *  - Line queried → "Send back" footer `1EUG-0` / `1F1I-0`
 *  - Verified record `18GE-0` / `1C71-0`
 * The selected count lives in the URL (`?id=`). The Store Manager sees the
 * ledger's expected figure (snapshotted when the attendant signed) — the
 * attendant never does.
 */

const COUNTS_HREF = '/app/inventory/stock/counts';
const printHref = (id: string) => `/app/inventory/count-print/${id}`;

const isFullSummary = (s: unknown): s is StockSummary => typeof s === 'object' && s !== null && 'onHandValue' in s;

/* ------------------------------------------------------------------- rail */

function WasteRailRow({ total, entries }: { total: string | null; entries: { itemName: string }[] }) {
  const names = Array.from(new Set(entries.map((e) => e.itemName))).slice(0, 3).join(', ');
  return (
    <Link
      href="/app/inventory/stock"
      className="flex w-full flex-col gap-1 border-b border-wds-border px-5 py-3.5 text-left outline-none transition-colors duration-150 hover:bg-wds-neutral-100 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)]"
    >
      <span className="flex items-center justify-between">
        <span className="font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">Waste log · last 7 days</span>
        <span className="font-wds-mono text-[11px]/[14px] text-wds-text-copy-muted">{total === null ? '—' : formatKes(total)}</span>
      </span>
      <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        {names ? ` · ${names}` : ''}
      </span>
    </Link>
  );
}

function CountRail({
  counts,
  status,
  selectedId,
  onSelect,
  onRetry,
  waste,
}: {
  counts: CountListItem[];
  status: 'loading' | 'error' | 'ready';
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
  waste: { total: string | null; entries: { itemName: string }[] };
}) {
  return (
    <div className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-wds-neutral-800" aria-label="Counts and waste">
      <div className="flex items-center justify-between border-b border-wds-border px-5 py-3.5">
        <span className="font-wds-mono text-[11px]/[14px] tracking-[0.04em] text-wds-text-copy-muted">COUNTS &amp; WASTE</span>
        <span className="font-wds-sans text-[12px]/4 text-wds-text-faint">Oldest first</span>
      </div>
      {status === 'loading' ? (
        <SkeletonRows count={4} label="Loading counts">
          {(i) => <ListRowSkeleton key={i} className="h-[68px] px-5" />}
        </SkeletonRows>
      ) : status === 'error' ? (
        <div className="py-8">
          <StockErrorCard title="Couldn't load counts" description="Check your connection and try again." onRetry={onRetry} />
        </div>
      ) : counts.length === 0 ? (
        <div className="flex justify-center py-8">
          <StockEmptyCard title="Nothing to verify" description="Counts appear here once the attendant signs them." />
        </div>
      ) : (
        counts.map((c) => <CountRailRow key={c.id} count={c} selected={c.id === selectedId} onSelect={() => onSelect(c.id)} />)
      )}
      <WasteRailRow total={waste.total} entries={waste.entries} />
    </div>
  );
}

/* ----------------------------------------------------------------- detail */

function DetailSkeleton() {
  return (
    <div className="flex min-w-0 grow basis-0 flex-col overflow-y-auto px-8 py-7" role="status" aria-live="polite">
      <span className="sr-only">Loading this count</span>
      <div className="flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-5 w-[280px]" />
        <Skeleton className="h-3 w-[420px]" />
      </div>
      <div className="mt-4 flex border-b border-wds-border" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('flex h-[52px] grow basis-0 flex-col justify-center gap-[5px] px-5', i < 3 && 'border-r border-wds-border')}>
            <span className="font-wds-mono text-[18px]/[22px] text-wds-text-faint">—</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-col" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <TableRowSkeleton key={i} widths={[64, 64, 56, 120]} nameWidth={160} className="px-0" />
        ))}
      </div>
    </div>
  );
}

function verifiedSummary(view: VerifierCountView): string {
  const when = view.verifiedAt ? `Verified ${formatClock(view.verifiedAt)}` : 'Verified';
  const by = view.verifier ? ` by ${view.verifier.name}` : '';
  const n = view.lines.filter((l) => l.adjustmentReference).length;
  return `${when}${by}. ${n} adjustment ${n === 1 ? 'entry' : 'entries'} written at the Central Store, each with its reason.`;
}

function SignatureBlock({ label, name, roleLine, when }: { label: string; name: string; roleLine: string; when: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-wds-mono text-[11px]/[14px] tracking-[0.04em] text-wds-text-copy-muted">{label}</span>
      <span className="font-wds-signature text-[32px]/none text-wds-text-ink">{name}</span>
      <div className="w-[220px] pt-1.5">
        <div className="font-wds-sans text-[12px]/4 font-medium text-wds-text-ink">{roleLine}</div>
        <div className="font-wds-sans text-[11px]/[14px] text-wds-text-faint">{when}</div>
      </div>
    </div>
  );
}

function VerifiedTable({ view }: { view: VerifierCountView }) {
  const rows = view.lines.filter((l) => l.adjustmentReference);
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-wds-neutral-800 pb-2.5">
        <span className="min-w-0 grow-[2] basis-0 font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Item</span>
        <span className="w-[90px] shrink-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Variance</span>
        <span className="w-[110px] shrink-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Adjustment</span>
        <span className="w-[110px] shrink-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Value</span>
        <span className="grow basis-0 font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Reason</span>
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center font-wds-sans text-[13px]/4 text-wds-text-copy-muted">Every counted line matched the ledger — no adjustments were needed.</div>
      ) : (
        rows.map((l) => (
          <div key={l.lineId} className="flex min-h-11 items-center gap-4 border-b border-wds-neutral-200 py-2.5">
            <span className="min-w-0 grow-[2] basis-0 truncate font-wds-sans text-[13px]/4 text-wds-text-ink">{l.name}</span>
            <span className="flex w-[90px] shrink-0 items-center justify-end gap-[5px]">
              <span className={cn('size-[5px] rounded-full', l.reasonRequired ? 'bg-wds-error-fg' : 'bg-wds-warning-fg')} aria-hidden />
              <span className={cn('font-wds-mono text-[13px]/4', l.reasonRequired ? 'font-semibold text-wds-error-fg' : 'text-wds-warning-fg')}>
                {l.variance ? `${Number.parseFloat(l.variance) < 0 ? '−' : '+'}${Math.abs(Number.parseFloat(l.variance))}${l.reasonRequired ? ` ${l.usageUnit}` : ''}` : '—'}
              </span>
            </span>
            <Link
              href={`/app/inventory/stock/ledger/${l.inventoryItemId}?highlight=${l.adjustmentTransactionId ?? ''}`}
              className="w-[110px] shrink-0 rounded-wds-sm text-right font-wds-mono text-[14px]/[18px] text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring"
            >
              {l.adjustmentReference}
            </Link>
            <span className="w-[110px] shrink-0 text-right font-wds-mono text-[14px]/[18px] text-wds-text-ink">{l.varianceValue ? formatSignedKes(l.varianceValue) : '—'}</span>
            <span className="min-w-0 grow basis-0 font-wds-sans text-[13px]/4 text-wds-text-copy-muted">
              {l.reason ? (l.reason === 'OTHER' && l.reasonNote ? `Other: ${l.reasonNote}` : REASON_TEXT[l.reason]) : 'Accepted'}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

const REASON_TEXT: Record<CountReasonValue, string> = {
  SUSPECTED_MISCOUNT: 'Suspected miscount',
  UNLOGGED_SPOILAGE: 'Unlogged spoilage',
  SUSPECTED_LOSS: 'Suspected loss',
  WITHIN_NORMAL_RANGE: 'Within normal range',
  OTHER: 'Other',
};

type LineFilter = 'variances' | 'all';

function ApproveBar({
  state,
  onApprove,
  approving,
  note,
  onNote,
  onSendBack,
  sendingBack,
  counterName,
  mobile = false,
}: {
  state: ReturnType<typeof useCountVerification>['state'];
  onApprove: () => void;
  approving: boolean;
  note: string;
  onNote: (v: string) => void;
  onSendBack: () => void;
  sendingBack: boolean;
  counterName: string;
  mobile?: boolean;
}) {
  const queried = state.queried.length;
  const blockers: string[] = [];
  if (state.undecided.length > 0) blockers.push(`${state.undecided.length} ${state.undecided.length === 1 ? 'line needs' : 'lines need'} a decision`);
  if (state.needsReason.length > 0) blockers.push(`${state.needsReason.length} ${state.needsReason.length === 1 ? 'line needs' : 'lines need'} a reason`);
  const first = counterName.split(/\s+/)[0] ?? counterName;

  if (queried > 0) {
    const sendBtn = (
      <button
        type="button"
        onClick={onSendBack}
        disabled={sendingBack}
        aria-busy={sendingBack}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-wds-sm bg-wds-gradient-primary font-wds-sans font-semibold text-[#FBF3EA] shadow-wds-sheen outline-none transition-[transform,filter] duration-150 ease-out hover:brightness-110 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70',
          mobile ? 'w-full rounded-[4px] p-[13px] text-[15px]/[18px] font-medium' : 'px-5 py-2.5 text-[13px]/4',
        )}
      >
        {sendingBack ? 'Sending…' : 'Send back to attendant'}
      </button>
    );
    const noteField = (
      <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
        <label htmlFor="send-back-note" className="font-wds-sans text-[11px]/[14px] font-semibold text-wds-text-copy-muted">
          NOTE FOR {first.toUpperCase()} — optional{mobile ? '' : ` · ${queried} ${queried === 1 ? 'line' : 'lines'} queried, sent back blind`}
        </label>
        <input
          id="send-back-note"
          type="text"
          value={note}
          maxLength={500}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Add a note for the attendant…"
          className={cn(
            'border border-wds-border-strong bg-wds-surface font-wds-sans text-[13px]/4 text-wds-text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-wds-text-faint focus:border-wds-primary focus:shadow-wds-ring',
            mobile ? 'h-[38px] rounded-[4px] px-3' : 'h-[34px] rounded-wds-sm px-2.5',
          )}
        />
      </div>
    );
    return mobile ? (
      <div className="flex flex-col gap-3">
        {noteField}
        {sendBtn}
      </div>
    ) : (
      <div className="mt-5 flex items-end justify-between gap-5 border border-wds-border bg-wds-neutral-50 px-5 py-4">
        {noteField}
        {sendBtn}
      </div>
    );
  }

  const disabled = !state.canApprove || approving;
  const approve = (describedBy?: string) => (
    <button
      type="button"
      onClick={disabled ? undefined : onApprove}
      aria-disabled={disabled || undefined}
      aria-describedby={describedBy}
      aria-busy={approving}
      className={cn(
        'flex shrink-0 items-center justify-center font-wds-sans outline-none transition-[transform,filter,background-color] duration-150 ease-out focus-visible:shadow-wds-ring',
        mobile ? 'w-full rounded-[4px] p-[13px] text-[15px]/[18px] font-medium' : 'rounded-wds-sm px-5 py-2.5 text-[13px]/4 font-semibold',
        disabled
          ? 'cursor-not-allowed bg-wds-neutral-300 text-wds-neutral-600'
          : 'bg-wds-gradient-primary text-[#FBF3EA] shadow-wds-sheen hover:brightness-110 motion-safe:active:scale-[0.98]',
      )}
    >
      {approving ? 'Signing…' : 'Approve & sign'}
    </button>
  );
  const hinted = !state.canApprove && blockers.length > 0 ? (
    <HintTooltip hint={blockers.join(' · ')} side="top" align="end" className="flex">
      {(describedBy) => approve(describedBy)}
    </HintTooltip>
  ) : (
    approve()
  );
  return mobile ? (
    hinted
  ) : (
    <div className="mt-5 flex items-center justify-between gap-5 border border-wds-border bg-wds-neutral-50 px-5 py-4">
      <p className="max-w-[640px] font-wds-sans text-[13px]/4 text-wds-text-copy-muted">
        Accepted variances write an adjustment per line at the Central Store, each with its reason. Variances above the Director threshold notify the Director automatically.
      </p>
      {hinted}
    </div>
  );
}

function CountDetail({
  view,
  status,
  error,
  onRetry,
  v,
  mobile,
}: {
  view: VerifierCountView | null;
  status: 'loading' | 'error' | 'ready';
  error: string | null;
  onRetry: () => void;
  v: ReturnType<typeof useCountVerification>;
  mobile: boolean;
}) {
  const addToast = useWdsToastStore((s) => s.addToast);
  const [filter, setFilter] = React.useState<LineFilter>('variances');
  const [pinOpen, setPinOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [queryFocusId, setQueryFocusId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFilter('variances');
    setNote('');
  }, [view?.id]);

  React.useEffect(() => {
    if (!queryFocusId) return;
    const id = requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`input[aria-label^="Query note for"]`)?.focus());
    return () => cancelAnimationFrame(id);
  }, [queryFocusId]);

  if (status === 'loading' && !view) return mobile ? <MobileDetailSkeleton /> : <DetailSkeleton />;
  if (status === 'error' && !view) {
    return (
      <div className="flex min-w-0 grow basis-0 items-start justify-center px-8 py-16">
        <StockErrorCard title="Couldn't load this count" description={error ?? 'Check your connection and try again. Nothing has been accepted yet.'} onRetry={onRetry} />
      </div>
    );
  }
  if (!view) return null;

  const verified = view.status === 'VERIFIED';
  const returned = view.status === 'RETURNED';
  const editable = view.status === 'SUBMITTED';
  const spot = view.kind === 'SPOT';
  const title = `${spot ? 'Spot count' : 'Daily count'} · ${formatCountDateLong(view.countDate)}`;
  const lines = view.lines;
  const varianceLines = lines.filter(lineHasVariance);
  const shown = filter === 'variances' && !verified ? varianceLines : lines.filter((l) => l.countedQty !== null || filter === 'all');
  const totals = view.totals;

  const handlers: LineHandlers = {
    onAccept: (l: VerifierCountLine) => v.decide(l, { decision: 'ACCEPTED', reason: l.reason, reasonNote: l.reasonNote }),
    onQuery: (l) => {
      v.decide(l, { decision: 'QUERIED', queryNote: l.queryNote });
      setQueryFocusId(l.lineId);
    },
    onUndo: (l) => v.decide(l, { decision: 'PENDING' }),
    onReason: (l, reason, reasonNote) => v.decide(l, { decision: 'ACCEPTED', reason, reasonNote }),
    onQueryNote: (l, queryNote) => v.decide(l, { decision: 'QUERIED', queryNote }),
  };

  const sendBack = async () => {
    const queriedCount = v.state.queried.length;
    const ok = await v.sendBack(note);
    if (ok) {
      addToast({
        variant: 'success',
        title: `Count sent back to ${view.counter.name}`,
        description: `${queriedCount} ${queriedCount === 1 ? 'line' : 'lines'} reopened for a blind recount.`,
      });
    }
  };

  const approvingAdjustments = v.state.adjusting.length;
  const onSubmitPin = async (pin: string) => {
    const result = await v.approve(pin);
    if (result) {
      setPinOpen(false);
      addToast({
        variant: 'success',
        title: 'Count verified',
        description:
          `${result.adjustmentsWritten} ${result.adjustmentsWritten === 1 ? 'adjustment' : 'adjustments'} written at the Central Store` +
          (result.adjustmentsWritten > 0 ? ` · net ${formatSignedKes(result.netAdjustmentValue)}` : '') +
          (result.directorNotified ? ' · a Director was alerted.' : '.'),
      });
    }
  };

  const banner = v.actionError ? (
    <FormErrorBanner
      title={v.actionError.kind === 'return' ? "Couldn't send back — try again" : "Couldn't save that decision"}
      description="Your decisions on each line are kept."
    />
  ) : null;

  const pin = (
    <PinSheet
      open={pinOpen}
      onOpenChange={(open) => {
        setPinOpen(open);
        if (!open) v.clearApproveError();
      }}
      title="Verify & sign"
      subtitle={`${approvingAdjustments} ${approvingAdjustments === 1 ? 'adjustment' : 'adjustments'} · Central Store · ${formatWeekdayDate(view.countDate)}. Enter your PIN.`}
      note="Each accepted variance posts to the ledger with an ADJ number. A signed count can't be edited."
      confirmLabel="Sign"
      submitting={v.approving}
      error={v.approveError}
      onSubmit={(p) => void onSubmitPin(p)}
    />
  );

  /* -------- header + stats -------- */
  const subtitle = verified
    ? verifiedSummary(view)
    : returned
      ? `Sent back to ${view.counter.name} for a recount${view.returnNote ? ` — “${view.returnNote}”` : ''}. Nothing has been adjusted yet.`
      : spot
        ? 'Spot count'
        : `Counted by ${view.counter.name}, blind, ${view.counterSignedAt ? formatClock(view.counterSignedAt) : '—'}. Expected is shown here — you're adjudicating each variance, not producing an observation.`;

  const stats = verified ? (
    <div className={cn('flex', !mobile && 'py-3')}>
      <StatCell compact={mobile} size={mobile ? 'sm' : 'lg'} label={mobile ? 'Lines adj.' : 'Lines adjusted'} value={lines.filter((l) => l.adjustmentReference).length} />
      <StatCell compact={mobile} size={mobile ? 'sm' : 'md'} label={mobile ? 'Net value' : 'Net variance value'} value={formatSignedKes(totals.netVarianceValue)} />
      <StatCell compact={mobile} size={mobile ? 'sm' : 'lg'} label="Verified at" value={view.verifiedAt ? formatClock(view.verifiedAt) : '—'} />
      <StatCell compact={mobile} size={mobile ? 'sm' : 'text'} label={mobile ? 'Director' : 'Director notified'} value={view.directorNotified ? 'Yes' : 'No'} last />
    </div>
  ) : (
    <div className="flex border-b border-wds-border">
      <StatCell compact={mobile} label="Lines" value={totals.lines} />
      <StatCell compact={mobile} label={mobile ? 'Variance' : 'Variance lines'} value={totals.varianceLines} tone="text-wds-warning-fg" />
      <StatCell compact={mobile} label={mobile ? 'Above thr.' : 'Above threshold'} value={totals.aboveThreshold} tone="text-wds-error-fg" />
      <StatCell compact={mobile} label={mobile ? 'Net value' : 'Net variance value'} value={formatSignedKes(totals.netVarianceValue)} last />
    </div>
  );

  const filterBar =
    !verified && varianceLines.length > 0 ? (
      <div className="flex items-center gap-2 pt-4" role="group" aria-label="Lines shown">
        {(
          [
            ['variances', `Variances (${varianceLines.length})`],
            ['all', `All lines (${lines.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              'rounded-wds-sm border px-2.5 py-1 font-wds-sans text-[12px]/4 outline-none transition-[background-color,border-color,color] duration-150 focus-visible:shadow-wds-ring',
              filter === key ? 'border-wds-espresso-700 bg-wds-espresso-700 text-white' : 'border-wds-border-strong text-wds-text-copy-muted hover:bg-wds-neutral-50',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    ) : null;

  const footer = editable ? (
    <ApproveBar
      state={v.state}
      onApprove={() => setPinOpen(true)}
      approving={v.approving}
      note={note}
      onNote={setNote}
      onSendBack={() => void sendBack()}
      sendingBack={v.sendingBack}
      counterName={view.counter.name}
      mobile={mobile}
    />
  ) : null;

  const signatures = (
    <div className={cn('flex pt-6', mobile ? 'mt-4 flex-col gap-5' : 'mt-7 gap-16')}>
      <SignatureBlock
        label="COUNTED BY"
        name={view.counter.name}
        roleLine={`${view.counter.name}, ${spot ? 'Store Manager' : 'Store Attendant'}`}
        when={view.counterSignedAt ? `${formatDayMonthClock(view.counterSignedAt)} · PIN verified` : ''}
      />
      {view.verifier ? (
        <SignatureBlock
          label="VERIFIED BY"
          name={view.verifier.name}
          roleLine={`${view.verifier.name}, Store Manager`}
          when={view.verifiedAt ? `${formatDayMonthClock(view.verifiedAt)} · PIN verified` : ''}
        />
      ) : null}
    </div>
  );

  if (mobile) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {verified ? (
            <div className="px-4 pt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-wds-success-border bg-wds-success-bg px-2.5 py-1 font-wds-sans text-[12px]/4 text-wds-success-fg">
                <span className="size-1.5 rounded-full bg-wds-success-fg" aria-hidden />
                Verified
              </span>
            </div>
          ) : (
            <p className="px-4 pt-3 font-wds-sans text-[13px]/[18px] text-wds-text-copy-muted">
              {editable ? "Expected is shown here — you're adjudicating each variance, not producing an observation." : subtitle}
            </p>
          )}
          <div className="mt-3 border-y border-wds-border">{stats}</div>
          <div className="flex flex-col px-4 pt-1">
            {banner ? <div className="pt-3">{banner}</div> : null}
            {filterBar}
            {verified ? (
              view.lines.filter((l) => l.adjustmentReference).map((l) => (
                <div key={l.lineId} className="flex flex-col gap-1.5 border-b border-wds-neutral-200 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">{l.name}</span>
                    <VarianceCell line={l} />
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/app/inventory/stock/ledger/${l.inventoryItemId}?highlight=${l.adjustmentTransactionId ?? ''}`}
                      className="rounded-wds-sm font-wds-mono text-[12px]/4 text-wds-primary underline outline-none focus-visible:shadow-wds-ring"
                    >
                      {l.adjustmentReference}
                    </Link>
                    <span className="font-wds-mono text-[12px]/4 text-wds-text-copy-muted">{l.varianceValue ? formatSignedKes(l.varianceValue) : '—'}</span>
                  </div>
                  <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
                    {l.reason ? (l.reason === 'OTHER' && l.reasonNote ? `Other: ${l.reasonNote}` : REASON_TEXT[l.reason]) : 'Accepted'}
                  </span>
                </div>
              ))
            ) : shown.length === 0 ? (
              <StockEmptyCard className="my-8" title="No variances" description="Every counted line matched the ledger." />
            ) : (
              shown.map((l) => <VerifyLineCard key={l.lineId} line={l} editable={editable} handlers={handlers} />)
            )}
            {verified ? signatures : null}
          </div>
          {editable ? (
            <div className="mx-4 mt-3.5 rounded-[4px] bg-wds-neutral-50 p-3 font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
              {v.state.queried.length > 0
                ? `${v.state.queried.length} ${v.state.queried.length === 1 ? 'line' : 'lines'} queried. It goes back to ${view.counter.name.split(/\s+/)[0]} for a recount — still blind, only ${v.state.queried.length === 1 ? 'that line' : 'those lines'}. Accepted lines wait until the recount comes back.`
                : 'Accepted variances write an adjustment per line at the Central Store, each with its reason. Variances above the Director threshold notify the Director automatically.'}
            </div>
          ) : null}
          <div className="grow" />
        </div>
        {editable ? <div className="shrink-0 border-t border-wds-border bg-wds-surface px-4 pb-6 pt-3.5">{footer}</div> : null}
        {pin}
      </>
    );
  }

  return (
    <div className="flex min-w-0 grow basis-0 flex-col overflow-y-auto overscroll-contain px-8 py-7">
      <div className="flex shrink-0 items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-wds-sans text-[20px]/6 font-semibold text-wds-text-ink">{verified || returned || spot ? title : `Verify daily count · ${formatCountDateLong(view.countDate)}`}</h2>
          <p className="font-wds-sans text-[13px]/4 text-wds-text-copy-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 pt-0.5">
          {verified ? (
            <span className="flex items-center gap-1.5 rounded-wds-sm border border-wds-success-border bg-wds-success-bg px-2.5 py-1.5 font-wds-sans text-[12px]/4 font-medium text-wds-success-fg">
              <span className="size-1.5 rounded-full bg-wds-success-fg" aria-hidden />
              Verified
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => window.open(printHref(view.id), '_blank')}
            className="rounded-wds-sm font-wds-sans text-[13px]/4 text-wds-espresso-700 outline-none hover:underline focus-visible:shadow-wds-ring"
          >
            Print
          </button>
        </div>
      </div>
      <div className={cn('mt-4', !verified && 'border-b-0')}>{stats}</div>
      {banner ? <div className="pt-4">{banner}</div> : null}
      {returned ? (
        <div className="mt-4 rounded-wds-md border border-wds-info-border bg-wds-info-bg px-3.5 py-3 font-wds-sans text-[12px]/[17px] text-wds-info-fg">
          {v.state.queried.length} {v.state.queried.length === 1 ? 'line is' : 'lines are'} with {view.counter.name} for a blind recount. You&apos;ll be notified when it comes back.
        </div>
      ) : null}
      {verified ? (
        <>
          <VerifiedTable view={view} />
          {signatures}
        </>
      ) : (
        <>
          {filterBar}
          <div className="mt-3 flex flex-col">
            <div className="flex items-center gap-4 border-b border-wds-neutral-800 pb-2.5">
              <span className="grow-[2] basis-0 font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Item</span>
              <span className="grow basis-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Counted</span>
              <span className="grow basis-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Expected</span>
              <span className="grow basis-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Variance</span>
              <span className="w-[220px] shrink-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Action</span>
            </div>
            {shown.length === 0 ? (
              <StockEmptyCard className="my-8" title="No variances" description="Every counted line matched the ledger." />
            ) : (
              shown.map((l, i) => <VerifyLineRow key={l.lineId} line={l} editable={editable} handlers={handlers} last={i === shown.length - 1} />)
            )}
          </div>
          {footer}
        </>
      )}
      {pin}
    </div>
  );
}

function MobileDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pt-3" role="status" aria-live="polite">
      <span className="sr-only">Loading this count</span>
      <Skeleton className="h-3 w-[80%]" />
      <div className="flex border-y border-wds-border py-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="grow basis-0 font-wds-mono text-[16px] text-wds-text-faint">—</span>
        ))}
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 border-b border-wds-neutral-200 py-3" aria-hidden>
          <Skeleton className="h-3 w-[45%]" />
          <Skeleton className="h-2.5 w-[60%]" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- screen */

export function StockCountsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const { summary: rawSummary, status: summaryStatus, reload: reloadSummary } = useStockSummary();
  const summary = isFullSummary(rawSummary) ? rawSummary : null;
  const { list, status: listStatus, reload: reloadList } = useCountList(undefined, 30);
  const { waste } = useWasteList(7);
  const counts = list?.counts ?? [];
  const { locationId: centralStoreId } = useCentralStoreLocation(true);
  const [wasteOpen, setWasteOpen] = React.useState(false);
  const [restockOpen, setRestockOpen] = React.useState(false);

  const idParam = params.get('id');
  const firstPending = counts.find((c) => c.status === 'SUBMITTED') ?? counts[0];
  const selectedId = idParam ?? (isDesktop ? (firstPending?.id ?? null) : null);
  const v = useCountVerification(selectedId);

  const select = React.useCallback(
    (id: string) => router.replace(`${pathname}?id=${id}`, { scroll: false }),
    [router, pathname],
  );

  // After a signature the hub numbers and the rail change — refresh both.
  const verifiedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (v.view?.status === 'VERIFIED' && verifiedRef.current !== v.view.id && v.view.verifiedAt && Date.now() - new Date(v.view.verifiedAt).getTime() < 15_000) {
      verifiedRef.current = v.view.id;
      void reloadSummary();
      void reloadList();
    }
  }, [v.view, reloadSummary, reloadList]);
  const returnedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (v.view?.status === 'RETURNED' && returnedRef.current !== v.view.id) {
      returnedRef.current = v.view.id;
      void reloadSummary();
      void reloadList();
    }
  }, [v.view, reloadSummary, reloadList]);

  if (!hydrated) return null;
  const wasteInfo = { total: waste?.totalValue ?? null, entries: waste?.entries ?? [] };

  if (!isDesktop) {
    const initials = user?.name ? user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') : '—';
    if (selectedId) {
      const detailTitle = v.view
        ? v.view.status === 'SUBMITTED' && v.view.kind === 'DAILY'
          ? `Verify daily count · ${formatCountDateLong(v.view.countDate)}`
          : `${v.view.kind === 'SPOT' ? 'Spot count' : 'Daily count'} · ${formatCountDateLong(v.view.countDate)}`
        : 'Count';
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
          <MobileStatusBar className="bg-wds-sidebar-top" />
          <StockMobileHeader
            title={detailTitle}
            subtitle={
              v.view
                ? v.view.status === 'VERIFIED'
                  ? `Verified ${v.view.verifiedAt ? formatClock(v.view.verifiedAt) : ''} by ${v.view.verifier?.name ?? ''}`
                  : `Counted by ${v.view.counter.name}, blind, ${v.view.counterSignedAt ? formatClock(v.view.counterSignedAt) : ''}`
                : 'Loading…'
            }
            onBack={() => router.push(pathname)}
            trailingLabel="Print"
            onTrailing={() => selectedId && window.open(printHref(selectedId), '_blank')}
          />
          <CountDetail view={v.view} status={v.status} error={v.error} onRetry={v.reload} v={v} mobile />
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader title="Counts & waste" subtitle="Verify counts, review spot counts and the waste log" userInitials={initials} onMenuClick={openMobileNav} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="flex border-b border-wds-border">
            {summary ? (
              <>
                <Link href="/app/inventory/stock/items?belowRestock=true" className="flex grow basis-0 flex-col gap-1 border-r border-wds-border px-3.5 py-3 outline-none focus-visible:shadow-wds-ring">
                  <span className="font-wds-mono text-[10px]/3 uppercase tracking-[0.04em] text-wds-text-copy-muted">Low stock</span>
                  <span className="font-wds-mono text-[18px]/[22px] font-medium text-wds-warning-fg">{summary.lowCount}</span>
                </Link>
                <Link href="/app/inventory/stock/items?negative=true" className="flex grow basis-0 flex-col gap-1 border-r border-wds-border px-3.5 py-3 outline-none focus-visible:shadow-wds-ring">
                  <span className="font-wds-mono text-[10px]/3 uppercase tracking-[0.04em] text-wds-text-copy-muted">Negative</span>
                  <span className="font-wds-mono text-[18px]/[22px] font-medium text-wds-error-fg">{summary.negativeCount}</span>
                </Link>
                <div className="flex grow basis-0 flex-col gap-1 px-3.5 py-3">
                  <span className="font-wds-mono text-[10px]/3 uppercase tracking-[0.04em] text-wds-text-copy-muted">Today&apos;s count</span>
                  <span className={cn('font-wds-sans text-[14px]/[18px] font-semibold', summary.todaysCount.status === 'SUBMITTED' || summary.todaysCount.status === 'RETURNED' ? 'text-wds-warning-fg' : 'text-wds-text-copy-muted')}>
                    {summary.todaysCount.status === 'SUBMITTED' ? 'Awaiting SM' : summary.todaysCount.status === 'RETURNED' ? 'Sent back' : summary.todaysCount.status === 'VERIFIED' ? 'Verified' : summary.todaysCount.status === 'DRAFT' ? 'In progress' : 'No count'}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-[70px] grow" aria-hidden />
            )}
          </div>
          <div className="flex items-center justify-between border-b border-wds-border px-4 py-3">
            <span className="font-wds-mono text-[11px]/[14px] tracking-[0.04em] text-wds-text-copy-muted">COUNTS &amp; WASTE</span>
            <span className="font-wds-sans text-[12px]/4 text-wds-text-faint">Oldest first</span>
          </div>
          {listStatus === 'loading' ? (
            <SkeletonRows count={4} label="Loading counts">
              {(i) => <ListRowSkeleton key={i} className="h-[68px] px-4" />}
            </SkeletonRows>
          ) : listStatus === 'error' ? (
            <div className="py-8">
              <StockErrorCard title="Couldn't load counts" description="Check your connection and try again." onRetry={reloadList} />
            </div>
          ) : counts.length === 0 ? (
            <div className="flex justify-center py-8">
              <StockEmptyCard title="Nothing to verify" description="Counts appear here once the attendant signs them." />
            </div>
          ) : (
            counts.map((c) => <CountRailRow key={c.id} count={c} mobile selected={false} onSelect={() => select(c.id)} />)
          )}
          <Link href="/app/inventory/stock" className="flex flex-col gap-1 border-b border-wds-border px-4 py-3.5 outline-none focus-visible:shadow-wds-ring">
            <span className="flex items-center justify-between">
              <span className="font-wds-sans text-[15px]/[18px] font-medium text-wds-text-ink">Waste log · last 7 days</span>
              <span className="font-wds-mono text-[12px]/4 text-wds-text-copy-muted">{wasteInfo.total === null ? '—' : formatKes(wasteInfo.total)}</span>
            </span>
            <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
              {wasteInfo.entries.length} {wasteInfo.entries.length === 1 ? 'entry' : 'entries'}
              {wasteInfo.entries.length ? ` · ${Array.from(new Set(wasteInfo.entries.map((e) => e.itemName))).slice(0, 3).join(', ')}` : ''}
            </span>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <StockTopbar screen="Stock & counts" onRestockLevels={() => setRestockOpen(true)} onLogWaste={() => setWasteOpen(true)} />
      <div className="flex shrink-0 flex-col gap-1 px-6 pb-5 pt-6">
        <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Stock &amp; counts</h1>
        <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
          The live position at the Central Store, derived from the ledger — plus today&apos;s count and verification.
        </p>
      </div>
      <div className="mx-6 mb-5 shrink-0">
        {summaryStatus === 'error' ? (
          <StockErrorCard className="py-6" title="Couldn't load the stock position" description="Check your connection and try again. Nothing has changed at the Central Store." onRetry={() => void reloadSummary()} />
        ) : (
          <HubKpiStrip summary={summary} loading={summaryStatus === 'loading'} />
        )}
      </div>
      <div className="flex min-h-0 flex-1 border-t border-wds-neutral-800 bg-wds-surface">
        <CountRail counts={counts} status={listStatus} selectedId={selectedId} onSelect={select} onRetry={reloadList} waste={wasteInfo} />
        {listStatus === 'ready' && counts.length === 0 ? (
          <div className="flex min-w-0 grow basis-0 items-center justify-center px-8">
            <StockEmptyCard title="Nothing to verify" description="Counts appear here once the attendant signs them." />
          </div>
        ) : selectedId ? (
          <CountDetail view={v.view} status={v.status} error={v.error} onRetry={v.reload} v={v} mobile={false} />
        ) : listStatus === 'loading' ? (
          <DetailSkeleton />
        ) : (
          <div className="flex min-w-0 grow basis-0 items-center justify-center px-8 font-wds-sans text-[13px]/4 text-wds-text-copy-muted">
            Pick a count on the left to review it.
          </div>
        )}
      </div>
      <LogWasteDrawer open={wasteOpen} onOpenChange={setWasteOpen} locationLabel="the Central Store" onLogged={() => void reloadSummary()} />
      <RestockLevelsDrawer open={restockOpen} onOpenChange={setRestockOpen} variant="desktop" locationId={centralStoreId ?? undefined} actor={{ role: 'STORE_MANAGER' }} />
    </div>
  );
}

