'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Checkbox } from '@/components/ui2/checkbox';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwKpiStrip, ScwKpiStripSkeleton } from '../../../_shared/components/scw-kpi-strip';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { CauseChips } from '../../_shared/components/count-chips';
import { dayClockLabel, clockLabel, plainQty, signedKes, signedMoney, signedPercent, signedQty } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import { CAUSE_TEXT, type CountCause, type CountDetail, type CountLine, type DecisionInput } from '../../_shared/types/counting-contract';
import { ApproveDialog } from './approve-dialog';
import { DecisionPanel } from './decision-panel';

const COUNTS = '/app/inventory/stock/counts';
type Tab = 'decide' | 'within' | 'notCounted' | 'all';

const within = (l: CountLine): boolean => l.result === 'MATCHES' || l.result === 'WITHIN_RANGE';
const chipClass = (active: boolean): string =>
  cn(
    'border px-[11px] py-1.5 font-wds-sans text-[12px] leading-4 outline-none transition-colors duration-100 focus-visible:shadow-wds-ring',
    active ? 'border-wds-text-ink bg-wds-text-ink font-semibold text-white' : 'border-wds-border-strong bg-transparent text-wds-text-ink [@media(hover:hover)]:hover:bg-wds-neutral-50',
  );

/**
 * Review a count (Paper step 9 `1XCK-0`, step 10 `1XM6-0`, step 47 `257F-0`; `/stock/counts/[id]`). The Manager sees every line
 * with expected, counted, difference, value and what the records show; decides each outside-range line (one tap, or several lines
 * at once with one cause), accepts the within-range group together, and approves with her PIN once every outside-range line is
 * decided. A signed count is read only: no checkboxes, "Count again" on outside-range lines, and the footer says so. Every control
 * that writes appears only when the server's `can` flags allow it; a reader (Director, Accountant, Branch Manager) sees the same
 * screen without them.
 */
export function ReviewCountScreen({ countId }: { countId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const detail = useLoader(`count:${countId}`, () => countingApi.detail(countId), COUNTING_STATES_COPY.reviewCount.error);
  const [count, setCount] = React.useState<CountDetail | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [groupOpen, setGroupOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [approving, setApproving] = React.useState(false);
  const [bulkCause, setBulkCause] = React.useState<CountCause | null>(null);
  const [bulkNote, setBulkNote] = React.useState('');

  React.useEffect(() => {
    if (detail.data) setCount(detail.data);
  }, [detail.data]);

  // A person who may not read counts (the Attendant) sees their own count on their phone screens, not this one.
  React.useEffect(() => {
    if (!ready || !count || count.figures || can('counts.read')) return;
    router.replace(`${COUNTS}/${count.id}/${count.status === 'OPEN' ? 'count' : 'submitted'}`);
  }, [ready, count, can, router]);

  const approved = count?.status === 'APPROVED';
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam ?? (approved ? 'decide' : 'decide');

  const setTab = (next: Tab): void => {
    const q = new URLSearchParams(params.toString());
    q.set('tab', next);
    router.replace(`${COUNTS}/${countId}?${q}`, { scroll: false });
    setSelected(new Set());
  };

  const decide = React.useCallback(
    async (input: DecisionInput, after?: () => void): Promise<void> => {
      if (busy) return;
      setBusy(true);
      setFailure(null);
      try {
        const next = await countingApi.decide(countId, input);
        setCount(next);
        setOpenId(null);
        setSelected(new Set());
        setBulkCause(null);
        setBulkNote('');
        after?.();
      } catch (err) {
        setFailure(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.decideLine.error));
      } finally {
        setBusy(false);
      }
    },
    [busy, countId],
  );

  const topbar = (title: string) => (
    <ScwTopbar breadcrumb={{ root: 'Central Store', section: 'Counts', sectionHref: COUNTS, screen: title }} actions={<TopActions can={can} />} />
  );

  if (detail.status === 'error' && !count) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topbar('Count')}
        <ScwStatePanel kind="error" text={COUNTING_STATES_COPY.reviewCount.error} onRetry={() => void detail.reload()} className="m-8" />
      </div>
    );
  }
  if (!count) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topbar('Count')}
        <LoadingAnnouncer text={COUNTING_STATES_COPY.reviewCount.loading.replace('{reference}', 'the count')} />
        <div className="flex flex-col gap-[18px] px-8 pt-7" aria-hidden>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-3.5 w-[420px]" />
          </div>
          <ScwKpiStripSkeleton count={5} />
          <Skeleton className="h-8 w-[420px]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!count.figures) {
    // An open count that is not the caller's: nobody else sees its numbers. A count of the caller's own that is open goes on counting.
    const mine = count.can.count;
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topbar(count.reference)}
        <main className="flex flex-col gap-4 px-8 py-7">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">{count.reference}</h1>
          <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
            {count.sections.map((s) => s.name).join(', ')} · counted by {count.counter.name} · {count.progress.text}
          </p>
          {mine ? (
            <Button className="w-fit" onClick={() => router.push(`${COUNTS}/${count.id}/count`)}>
              Carry on counting
            </Button>
          ) : (
            <ScwStatePanel kind="permission" text="This count is still open. Its numbers appear here once it is signed." className="mx-0" />
          )}
        </main>
      </div>
    );
  }

  const fig = count.figures;
  const lines = [...count.lines].sort((a, b) => a.position - b.position);
  const outside = lines.filter((l) => l.result === 'EXCEEDS');
  const withinLines = lines.filter(within);
  const notCounted = lines.filter((l) => l.result === 'NOT_COUNTED');
  const shown = tab === 'decide' ? outside : tab === 'within' ? withinLines : tab === 'notCounted' ? notCounted : lines;
  const decidedN = outside.filter((l) => l.decision?.kind !== 'PENDING').length;
  const canDecide = count.can.decide;
  const selectable = canDecide && !approved;
  const pendingOutside = outside.filter((l) => l.can.decide);
  const allSelected = pendingOutside.length > 0 && pendingOutside.every((l) => selected.has(l.id));
  const rangeText = count.range ? `Within range means under KES ${count.range.kes} and ${count.range.percent}%.` : '';
  const acceptedAll = withinLines.length > 0 && withinLines.every((l) => l.decision?.kind === 'ACCEPTED');
  const sectionsText = count.sections.map((s) => s.name).join(', ');

  const cells = [
    { key: 'counted', label: 'COUNTED', value: String(fig.counted), caption: '', tone: 'NEUTRAL' as const },
    { key: 'within', label: 'WITHIN RANGE', value: String(fig.withinRange), caption: '', tone: 'NEUTRAL' as const },
    { key: 'exceeds', label: approved ? `EXCEEDED · ${fig.exceeds === 1 ? '' : fig.exceeds === 2 ? 'BOTH ' : 'ALL '}DECIDED` : 'EXCEEDS · NEEDS A DECISION', value: String(fig.exceeds), caption: '', tone: 'ALERT' as const },
    { key: 'notCounted', label: 'NOT COUNTED', value: String(fig.notCounted), caption: '', tone: 'WARN' as const },
    { key: 'net', label: 'NET DIFFERENCE', value: signedKes(fig.netDifferenceKes), caption: '', tone: 'NEUTRAL' as const },
  ];
  const tabs: { key: Tab; label: string; n: number }[] = approved
    ? [
        { key: 'decide', label: 'Exceeded', n: outside.length },
        { key: 'within', label: 'Within range', n: withinLines.length },
        { key: 'notCounted', label: 'Not counted', n: notCounted.length },
        { key: 'all', label: 'All', n: lines.length },
      ]
    : [
        { key: 'decide', label: 'Needs a decision', n: fig.toDecide },
        { key: 'within', label: 'Within range', n: withinLines.length },
        { key: 'notCounted', label: 'Not counted', n: notCounted.length },
        { key: 'all', label: 'All', n: lines.length },
      ];

  const toggle = (id: string): void =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const decisionCell = (line: CountLine): React.ReactNode => {
    const d = line.decision;
    if (approved) {
      return line.can.countAgain ? (
        <Button variant="secondary" className="h-[30px] border-wds-text-ink px-3.5 font-semibold text-wds-text-ink" onClick={() => router.push(`${COUNTS}/new?recount=${line.id}`)}>
          Count again
        </Button>
      ) : d?.kind && d.kind !== 'PENDING' ? (
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{d.text}</span>
      ) : null;
    }
    if (openId === line.id) return <span className="font-wds-sans text-[12px] leading-4 text-wds-warning-fg">Deciding</span>;
    if (d && d.kind !== 'PENDING') {
      return (
        <span className="flex items-center justify-end gap-3">
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 border border-wds-success-border bg-wds-success-bg px-2.5 font-wds-sans text-[13px] font-medium leading-4 text-wds-success-fg">
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {d.text}
          </span>
          {line.can.decide ? (
            <button type="button" onClick={() => setOpenId(line.id)} className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
              Change<span className="sr-only"> the decision for {line.itemName}</span>
            </button>
          ) : null}
        </span>
      );
    }
    if (line.can.decide && line.result === 'EXCEEDS') {
      return (
        <button
          type="button"
          onClick={() => setOpenId(line.id)}
          className="h-[30px] border border-wds-text-ink bg-wds-surface px-3.5 font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink outline-none transition-[background-color,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:bg-wds-neutral-50 motion-safe:active:scale-[0.98]"
        >
          Decide<span className="sr-only"> {line.itemName}</span>
        </button>
      );
    }
    if (line.result === 'EXCEEDS') return <span className="font-wds-sans text-[12px] leading-4 text-wds-text-faint">Not decided</span>;
    return null;
  };

  const records = (line: CountLine): string => {
    const base = line.story ?? (line.result === 'NOT_COUNTED' ? 'Skipped.' : '');
    const d = line.decision;
    if (approved && d && d.kind === 'WRITE_OFF' && d.cause) return `${base} Written off as ${CAUSE_TEXT[d.cause]}, approved ${count.approvedAt ? clockLabel(count.approvedAt) : ''}.`.trim();
    return base;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar(count.reference)}
      <main className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-8 pt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">{approved ? count.reference : `Review ${count.reference}`}</h1>
            <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
              {sectionsText} · counted by {count.counter.name}
              {approved && count.approver && count.approvedAt ? ` · ${count.selfSigned ? 'signed' : 'approved by ' + count.approver.name} ${dayClockLabel(count.approvedAt)}` : count.signedAt ? ` · signed ${dayClockLabel(count.signedAt)}` : ''} · {fig.counted} items counted
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{rangeText}</span>
            {can('counts.setup') ? (
              <Link href={`${COUNTS}/setup?drawer=settings`} className="font-wds-sans text-[12px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
                Change range
              </Link>
            ) : null}
          </div>
        </div>

        <ScwKpiStrip variant="compact" cells={cells} />

        {failure ? <FormErrorBanner title="Could not save" description={failure} /> : null}

        <div className="flex flex-col">
          <div className="flex flex-wrap gap-2 pb-2.5" role="tablist" aria-label="Lines">
            {tabs.map((t) => (
              <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={chipClass(tab === t.key)}>
                {t.label} {t.n}
              </button>
            ))}
          </div>

          {selected.size > 0 ? (
            <div className="mb-2 flex flex-wrap items-center gap-3 border border-wds-border-strong bg-wds-espresso-50 px-4 py-2.5" role="region" aria-label="Selected lines">
              <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">{selected.size} selected. One cause for all:</span>
              <CauseChips
                value={bulkCause}
                label="Cause for the selected lines"
                disabled={busy}
                onChange={(cause) => {
                  setBulkCause(cause);
                  if (cause !== 'OTHER') void decide({ lineIds: Array.from(selected), decision: { kind: 'WRITE_OFF', cause } });
                }}
              />
              {bulkCause === 'OTHER' ? (
                <span className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="bulk-note">
                    Note for the selected lines
                  </label>
                  <input id="bulk-note" value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Say what happened" className="h-8 w-60 border border-wds-border-strong bg-wds-surface px-2 font-wds-sans text-[13px] outline-none focus:border-wds-selected-edge focus:shadow-wds-ring" />
                  <Button size="sm" disabled={busy || bulkNote.trim() === ''} onClick={() => void decide({ lineIds: Array.from(selected), decision: { kind: 'WRITE_OFF', cause: 'OTHER', note: bulkNote.trim() } })}>
                    Save
                  </Button>
                </span>
              ) : null}
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto font-wds-sans text-[12px] text-wds-text-secondary underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
                Clear selection
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto" aria-busy={busy}>
            <div className="min-w-[1000px]">
              <div className="flex h-[34px] shrink-0 items-center border-b border-t border-b-wds-border border-t-wds-text-ink bg-wds-surface px-4 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                {selectable ? (
                  <span className="w-8 shrink-0">
                    <Checkbox
                      aria-label="Select every line that needs a decision"
                      checked={allSelected}
                      disabled={pendingOutside.length === 0 || busy}
                      onCheckedChange={(on) => setSelected(on ? new Set(pendingOutside.map((l) => l.id)) : new Set())}
                    />
                  </span>
                ) : null}
                <span className="w-[190px] shrink-0">Item</span>
                <span className="w-[90px] shrink-0 text-right">Expected</span>
                <span className="w-[90px] shrink-0 text-right">Counted</span>
                <span className="w-[120px] shrink-0 text-right">Difference</span>
                <span className="w-[110px] shrink-0 text-right">Value</span>
                <span className="w-[340px] shrink-0 pl-7">What the records show</span>
                <span className="grow text-right">Decision</span>
              </div>

              {shown.length === 0 ? (
                <p className="border-b border-wds-neutral-100 bg-wds-surface px-4 py-6 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
                  {tab === 'decide' ? (approved ? 'Nothing exceeded the range.' : 'Nothing needs a decision. Every line is inside the range.') : tab === 'notCounted' ? 'Everything was counted.' : 'No lines here.'}
                </p>
              ) : (
                shown.map((line) => {
                  const isOpen = openId === line.id;
                  return (
                    <div key={line.id} className={cn('border-b border-wds-neutral-100 bg-wds-surface', isOpen && 'border-l-[3px] border-l-wds-selected-edge')}>
                      <div className={cn('flex min-h-16 items-center px-4 py-1', isOpen ? 'bg-wds-espresso-50 pl-[13px]' : '', busy && 'opacity-70 transition-opacity')}>
                        {selectable ? (
                          <span className="w-8 shrink-0">
                            <Checkbox aria-label={`Select ${line.itemName}`} checked={selected.has(line.id)} disabled={!line.can.decide || line.result !== 'EXCEEDS' || busy} onCheckedChange={() => toggle(line.id)} />
                          </span>
                        ) : null}
                        <span className="flex w-[190px] shrink-0 flex-col pr-2">
                          <span className={cn('truncate font-wds-sans text-[14px] leading-5 text-wds-text-ink', isOpen ? 'font-semibold' : 'font-medium')}>{line.itemName}</span>
                          <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                            {line.sectionName ?? 'No section'} · {line.unit}
                          </span>
                        </span>
                        <span className="w-[90px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{plainQty(line.expectedQty ?? null)}</span>
                        <span className="w-[90px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">{line.countedQty === null ? '' : plainQty(line.countedQty)}</span>
                        <span className="flex w-[120px] shrink-0 flex-col items-end">
                          {line.difference !== undefined && line.countedQty !== null ? (
                            <>
                              <span className={cn('font-wds-mono text-[13px] leading-4', Number(line.difference) === 0 ? 'text-wds-text-ink' : 'text-wds-error-fg')}>{Number(line.difference) === 0 ? '0' : signedQty(line.difference, line.unit)}</span>
                              <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{signedPercent(line.differencePercent ?? '0')}</span>
                            </>
                          ) : null}
                        </span>
                        <span className={cn('w-[110px] shrink-0 text-right font-wds-mono text-[13px] leading-4', Number(line.differenceValueKes ?? 0) < 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
                          {line.differenceValueKes !== undefined && line.countedQty !== null ? signedMoney(line.differenceValueKes) : ''}
                        </span>
                        <span className="w-[340px] shrink-0 pl-7 font-wds-sans text-[13px] leading-5 text-wds-neutral-700">{records(line)}</span>
                        <span className="flex grow justify-end">{decisionCell(line)}</span>
                      </div>
                      {isOpen ? (
                        <DecisionPanel
                          line={line}
                          busy={busy}
                          onClose={() => setOpenId(null)}
                          onDecide={(decision) => {
                            if (decision.kind === 'RECOUNT_ASKED') void decide({ lineIds: [line.id], decision }, () => router.push(`${COUNTS}/new?recount=${line.id}`));
                            else void decide({ lineIds: [line.id], decision });
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}

              {withinLines.length > 0 && tab !== 'within' ? (
                <div className="mt-4 border border-wds-border bg-wds-surface">
                  <div className="flex h-14 items-center justify-between px-4">
                    <button type="button" aria-expanded={groupOpen} onClick={() => setGroupOpen((o) => !o)} className="flex items-center gap-3 text-left outline-none focus-visible:shadow-wds-ring">
                      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className={cn('shrink-0 text-wds-neutral-500 transition-transform duration-150 motion-reduce:transition-none', groupOpen && 'rotate-90')}>
                        <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="flex flex-col">
                        <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">
                          {withinLines.length} within range · net {signedKes(fig.withinRangeNetKes)}
                        </span>
                        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                          {withinLines.slice(0, 2).map((l) => `${l.itemName} ${signedQty(l.difference ?? '0', l.unit)}`).join(' · ')}
                          {withinLines.length > 2 ? ` · and ${withinLines.length - 2} more` : ''}. {approved ? 'Each was written as a small adjustment when this count was approved.' : 'Each writes a small adjustment when you approve.'}
                        </span>
                      </span>
                    </button>
                    {approved ? (
                      <span className="flex h-8 items-center border border-wds-border-strong bg-wds-surface px-3.5 font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">Accepted</span>
                    ) : canDecide ? (
                      <button
                        type="button"
                        disabled={busy || acceptedAll}
                        onClick={() => void decide({ group: 'WITHIN_RANGE', decision: { kind: 'ACCEPTED' } })}
                        className="h-8 border border-wds-border-strong bg-wds-surface px-3.5 font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink outline-none transition-[background-color,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring enabled:[@media(hover:hover)]:hover:bg-wds-neutral-50 disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.98]"
                      >
                        {acceptedAll ? `Accepted ${withinLines.length}` : `Accept all ${withinLines.length}`}
                      </button>
                    ) : null}
                  </div>
                  {groupOpen ? (
                    <ul className="border-t border-wds-neutral-100 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
                      {withinLines.map((l) => (
                        <li key={l.id} className="flex h-10 items-center justify-between px-4 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                          <span>
                            {l.itemName} <span className="text-wds-text-secondary">· {l.sectionName}</span>
                          </span>
                          <span className="font-wds-mono text-[12px] text-wds-text-secondary">
                            {l.countedQty === null ? '' : `${plainQty(l.countedQty)} ${l.unit}`} {l.differenceValueKes ? `· ${signedMoney(l.differenceValueKes)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className={cn('flex min-h-11 items-center border border-t-0 border-wds-warning-border bg-wds-warning-bg px-4 py-2.5', withinLines.length === 0 || tab === 'within' ? 'mt-4 border-t' : '')}>
                <p className="font-wds-sans text-[13px] leading-4 text-wds-warning-fg">
                  {notCounted.length === 0
                    ? `Everything on ${count.sections.length > 1 ? 'both sections' : 'this section'} was counted.`
                    : notCounted.length === 1
                      ? `Not counted: ${notCounted[0]?.itemName}. Skipped by ${count.counter.name.split(' ')[0]}, last counted ${notCounted[0]?.lastCountedText.toLowerCase()}. Nothing is written for it.`
                      : `Not counted: ${notCounted.map((l) => l.itemName).join(', ')}. Skipped by ${count.counter.name.split(' ')[0]}. Nothing is written for them.`}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="grow" />
        <div className="sticky bottom-0 -mx-8 flex h-17 shrink-0 items-center justify-between border-t border-wds-border-strong bg-wds-canvas px-8">
          <div className="flex flex-col gap-0.5" role="status" aria-live="polite">
            <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">
              {decidedN} of {outside.length} decided{approved ? ' · approved and signed' : ''}
            </span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              {approved ? 'A signed count is never edited. Count again starts a new count that links back to this one.' : canDecide ? 'Nothing is written until you approve and sign.' : 'Only the Store Manager decides lines and approves.'}
            </span>
          </div>
          {approved ? (
            <span className="flex h-10 items-center bg-wds-neutral-100 px-5 font-wds-sans text-[14px] font-semibold leading-5 text-wds-text-muted">Approved {count.approvedAt ? dayClockLabel(count.approvedAt) : ''}</span>
          ) : canDecide ? (
            <button
              type="button"
              disabled={!count.can.approve || busy}
              title={count.can.approve ? undefined : 'Decide every line outside the range first'}
              onClick={() => setApproving(true)}
              className="flex h-10 items-center bg-wds-gradient-primary px-5 font-wds-sans text-[14px] font-semibold leading-5 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.99]"
            >
              Approve and sign
            </button>
          ) : null}
        </div>
      </main>
      <ApproveDialog
        count={count}
        open={approving}
        onOpenChange={setApproving}
        onApproved={setCount}
        onLinesUndecided={() => void detail.reload()}
      />
    </div>
  );
}

function TopActions({ can }: { can: ReturnType<typeof usePermissions>['can'] }) {
  return (
    <>
      {can('waste.log') ? (
        <Button variant="secondary" asChild>
          <Link href="/app/inventory/stock/waste?drawer=log">Log waste</Link>
        </Button>
      ) : null}
      {can('counts.record') ? (
        <Button asChild>
          <Link href={`${COUNTS}/new`}>Start count</Link>
        </Button>
      ) : null}
    </>
  );
}
