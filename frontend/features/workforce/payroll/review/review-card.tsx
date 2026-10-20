'use client';

import * as React from 'react';

import { Picker } from '@/components/ui2/picker';
import { ApiError } from '@/types/api';

import { Callout, ChoiceChips, DialogButton, EmptyState, ErrorBlock, FIELD_CLASS, ListSkeleton, Panel } from '../../_shared';
import { NumberedPager } from '../_shared/components/numbered-pager';
import { useReview } from '../_shared/hooks/use-payroll-data';
import { refusalWords } from '../_shared/lib/month-view';
import { payrollWrites } from '../_shared/services/payroll-writes';
import type { ReviewLine } from '../_shared/types/action-types';
import type { MonthView } from '../_shared/types/month-types';
import { AdjustmentDialog, LeaveOutDialog, RecalculateDialog } from './line-dialogs';
import { bulkKind, checkboxName, checkedWords, filterQuery, kindWords, type ReviewFilter } from './review-words';

type Open = { kind: 'leaveOut' | 'adjust'; line: ReviewLine } | { kind: 'recalc' } | null;

/**
 * "HR checks these lines" (spec S5). HR ticks a line to say it has been looked at; a blocking line cannot be ticked, it is fixed, the
 * person is left out, a line is added, or the month is calculated again. Everyone else reads the same list without the controls.
 * Ticking does not move the month's version, so two people ticking different lines never collide.
 */
export function ReviewCard({ view, refresh, onChanged, onOpenDialog }: { view: MonthView; refresh: number; onChanged: (message?: string) => void; onOpenDialog: (name: 'send' | 'sendBack') => void }) {
  const [filter, setFilter] = React.useState<ReviewFilter>('all');
  const [q, setQ] = React.useState('');
  const [kind, setKind] = React.useState<string>('');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState(50);
  const [open, setOpen] = React.useState<Open>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [local, setLocal] = React.useState(0);
  const review = useReview(view.monthKey, { ...filterQuery(filter), kind: kind || undefined, q: q.trim() || undefined, page, rows }, refresh + local);
  const data = review.data;
  const canTick = data?.canTick === true && view.capabilities.canReview;
  const bump = (): void => {
    setLocal((n) => n + 1);
    onChanged();
  };

  const tick = async (line: ReviewLine, checked: boolean): Promise<void> => {
    setBusyId(line.id);
    setError(null);
    try {
      await payrollWrites.check(view.monthKey, line.id, { checked, stateVersion: view.stateVersion });
      bump();
    } catch (err) {
      setError(err instanceof ApiError ? refusalWords(err.code, err.message) : 'The connection dropped. Nothing was changed.');
      if (err instanceof ApiError && err.code === 'CHANGED_UNDERNEATH') bump();
    } finally {
      setBusyId(null);
    }
  };
  const tickKind = async (k: string): Promise<void> => {
    setBusyId(`kind:${k}`);
    setError(null);
    try {
      await payrollWrites.checkKind(view.monthKey, { kind: k, stateVersion: view.stateVersion });
      bump();
    } catch (err) {
      setError(err instanceof ApiError ? refusalWords(err.code, err.message) : 'The connection dropped. Nothing was changed.');
    } finally {
      setBusyId(null);
    }
  };

  const counts = data?.counts ?? { total: 0, checked: 0, blocking: 0 };
  const bulk = bulkKind(data?.lines ?? [], kind || undefined);
  const kindsHere = Array.from(new Set((data?.lines ?? []).map((l) => l.kind)));

  return (
    <Panel title={`HR checks ${counts.total === 1 ? 'this line' : `these ${counts.total} lines`}`} caption={checkedWords(counts.checked, counts.total).toUpperCase()} padded={false}>
      <div className="flex flex-col gap-3 p-3.5">
        {data?.stale ? (
          <Callout tone="warning" size="sm" role="alert" action={canTick ? <DialogButton kind="cancel" onClick={() => setOpen({ kind: 'recalc' })}>Calculate again</DialogButton> : undefined}>
            Something changed after this was calculated. Calculate again.
          </Callout>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <ChoiceChips
            legend="Show"
            legendStyle="caps"
            size="sm"
            value={filter}
            onChange={(v) => {
              setFilter(v as ReviewFilter);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'blocks', label: `Blocks${counts.blocking ? ` · ${counts.blocking}` : ''}` },
              { value: 'tick', label: 'To tick' },
              { value: 'ticked', label: 'Ticked' },
            ]}
          />
          <input autoComplete="off" aria-label="Search a name" placeholder="Search a name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className={`${FIELD_CLASS} max-w-[220px]`} />
          <Picker
            aria-label="Kind"
            value={kind}
            onValueChange={(v) => {
              setKind(v);
              setPage(1);
            }}
            chips={false}
            className="max-w-[240px]"
            options={[{ value: '', label: 'Every kind' }, ...Array.from(new Set([...kindsHere, ...(kind ? [kind] : [])])).map((k) => ({ value: k, label: kindWords(k) }))]}
          />
          {canTick && bulk ? (
            <DialogButton kind="cancel" disabled={busyId !== null} onClick={() => void tickKind(bulk)}>
              Tick all of this kind
            </DialogButton>
          ) : null}
          {canTick ? (
            <DialogButton kind="cancel" disabled={busyId !== null} onClick={() => setOpen({ kind: 'recalc' })}>
              Calculate again
            </DialogButton>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
            {error}
          </p>
        ) : null}
        {review.status === 'loading' && !data ? <ListSkeleton rows={4} columns={[20, 'fill', 200]} label="Loading the lines" /> : null}
        {review.status === 'error' && !data ? <ErrorBlock title="The lines did not load" line={review.error.message} onRetry={review.reload} reference={review.error.code} /> : null}
        {data && data.lines.length === 0 ? (
          counts.total === 0 && filter === 'all' && !q ? (
            <p className="m-0 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-success-fg">Nothing unusual this month.</p>
          ) : (
            <EmptyState kind="nothingFound" title="No lines match" line="Change the filter or the name." />
          )
        ) : null}
        <ul role="group" aria-label={`HR checks ${counts.total} lines`} className="m-0 flex list-none flex-col p-0">
          {(data?.lines ?? []).map((line) => {
            const blocks = line.severity === 'BLOCK';
            return (
              <li key={line.id} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-wds-neutral-100 py-2.5 min-[900px]:grid-cols-[14px_minmax(0,230px)_130px_minmax(0,1fr)]">
                {blocks ? (
                  <span aria-hidden className="mt-0.5 flex size-[14px] shrink-0 items-center justify-center border border-wds-error-fg text-[10px] font-bold leading-none text-wds-error-fg">!</span>
                ) : (
                  <input
                    type="checkbox"
                    aria-label={checkboxName(line)}
                    checked={line.state === 'CHECKED'}
                    disabled={!canTick || busyId === line.id}
                    onChange={(e) => void tick(line, e.target.checked)}
                    className="mt-0.5 size-[14px] shrink-0 accent-[var(--wds-success-fg)]"
                  />
                )}
                <span title={line.checkedBy ? `Checked by ${line.checkedBy}` : undefined} className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
                  {line.name} · {line.siteName}
                  {line.checkedBy ? <span className="sr-only"> Checked by {line.checkedBy}</span> : null}
                </span>
                <span className={`col-start-2 font-wds-sans text-[13px] leading-[18px] min-[900px]:col-start-auto ${blocks ? 'font-medium text-wds-error-fg' : 'text-wds-text-secondary'}`}>{blocks ? `Blocks the month · ${kindWords(line.kind)}` : kindWords(line.kind)}</span>
                <span className="col-start-2 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink min-[900px]:col-start-auto">{line.text}</span>
                {blocks && canTick ? (
                  <span className="col-start-2 mt-1 flex flex-wrap gap-2 min-[900px]:col-start-2 min-[900px]:col-span-3">
                    <DialogButton kind="cancel" onClick={() => setOpen({ kind: 'leaveOut', line })}>
                      Leave out of this run
                    </DialogButton>
                    <DialogButton kind="cancel" onClick={() => setOpen({ kind: 'adjust', line })}>
                      Add a line
                    </DialogButton>
                    <DialogButton kind="cancel" onClick={() => setOpen({ kind: 'recalc' })}>
                      Calculate again
                    </DialogButton>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {data ? <NumberedPager page={page} rows={rows} total={data.total} onPage={setPage} onRows={(n) => { setRows(n); setPage(1); }} /> : null}
      {open?.kind === 'leaveOut' ? <LeaveOutDialog view={view} line={open.line} onClose={() => setOpen(null)} onStale={bump} onDone={(m) => { setOpen(null); onChanged(m); }} /> : null}
      {open?.kind === 'adjust' ? <AdjustmentDialog view={view} line={open.line} onClose={() => setOpen(null)} onStale={bump} onDone={(m) => { setOpen(null); onChanged(m); }} /> : null}
      {open?.kind === 'recalc' ? <RecalculateDialog view={view} onClose={() => setOpen(null)} onStale={bump} onDone={(m) => { setOpen(null); onChanged(m); }} /> : null}
      {view.state === 'TO_APPROVE' && view.capabilities.canApprove ? (
        <div className="flex justify-end border-t border-wds-border px-3.5 py-2.5">
          <DialogButton kind="cancel" onClick={() => onOpenDialog('sendBack')}>
            Send back to HR
          </DialogButton>
        </div>
      ) : null}
    </Panel>
  );
}
