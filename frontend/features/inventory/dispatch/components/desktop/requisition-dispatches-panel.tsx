'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';

import { ErrorState } from '@/components/app/shell/shell-states';
import { Button } from '@/components/ui2/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { DocLink, MonoLabel } from '../../../requisitions/components/req-parts';
import { clock } from '../../../requisitions/_shared/lib/requisitions-words';
import type { DispatchRef, RequisitionFile } from '../../../requisitions/_shared/types/requisitions-contract';
import { stageChip } from '../../lib/dispatch-words';
import { dispatchDesktopApi } from '../../services/dispatch-desktop-api';
import { nameAndTitle } from '../../lib/dispatch-words';
import { CancelDispatchDialog } from './cancel-dispatch-dialog';
import { ConfirmForDepartmentDrawer } from './confirm-for-department-drawer';

const DOT: Record<string, string> = { warning: 'bg-wds-warning-fg', success: 'bg-wds-success-fg', info: 'bg-wds-info-fg', neutral: 'border border-wds-text-secondary', error: 'bg-wds-error-fg' };

const railLine = (d: DispatchRef): string => `${stageChip(d.derivedState).text} · ${d.lineCount} lines`;

/**
 * Paper step 13 and the Block 2 states: an approved requisition follows its dispatches. The left rail has one row per department
 * (its `DSP-` number, state and line count); the right side shows the selected department's dispatch: who packed, signed and carried,
 * the lines, and the actions (Open the dispatch, Cancel this dispatch for the store, Confirm for the department for the Branch
 * Manager). A department still to pack has no dispatch number yet and says so.
 */
export function RequisitionDispatchesPanel({ file, selected, onSelect, base, onChanged }: { file: RequisitionFile; selected: string; onSelect: (departmentId: string) => void; base: string; onChanged: () => void }) {
  const current = file.dispatches.find((d) => d.departmentId === selected) ?? file.dispatches[0];
  const signed = current && current.reference !== null;
  const dispatch = useLoader(current && signed ? `req-dispatch:${current.id}` : null, () => dispatchDesktopApi.file(current?.id ?? ''), 'Could not load this dispatch.');
  const [cancelling, setCancelling] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const moreRef = React.useRef<HTMLButtonElement>(null);
  const [showAll, setShowAll] = React.useState(false);
  const data = dispatch.data;
  const sent = file.dispatches.filter((d) => d.reference !== null && d.status !== 'CANCELLED').length;

  if (!current) return null;
  const items = data ? (showAll ? data.items : data.items.slice(0, 3)) : [];
  const money = data?.items.some((i) => i.unitCostKes !== undefined) ?? false;

  return (
    <div className="grid min-h-[420px] grid-cols-1 border-t border-wds-border lg:grid-cols-[300px_minmax(0,1fr)]">
      <nav aria-label="Dispatches" className="flex flex-col border-b border-wds-neutral-950 bg-wds-neutral-50 lg:border-b-0 lg:border-r">
        <MonoLabel className="px-4 py-3.5">Dispatches · one per department</MonoLabel>
        <ul className="border-t border-wds-neutral-950">
          {file.dispatches.map((d) => {
            const on = d.departmentId === current.departmentId;
            const chip = stageChip(d.derivedState);
            return (
              <li key={d.id}>
                <div className={cn('flex items-start gap-3 border-b border-wds-border px-4 py-3', on ? 'border-l-[3px] border-l-wds-caramel-500 bg-wds-caramel-100 pl-[13px]' : 'hover:bg-wds-neutral-100')}>
                  <button type="button" aria-current={on ? 'true' : undefined} onClick={() => onSelect(d.departmentId)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left outline-none focus-visible:shadow-wds-ring">
                    <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[chip.tone])} />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{d.departmentName}</span>
                      <span className={cn('font-wds-sans text-[13px] leading-4', chip.tone === 'info' ? 'text-wds-info-fg' : chip.tone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{railLine(d)}</span>
                    </span>
                  </button>
                  {d.reference ? <DocLink href={`${base}/dispatch/${d.id}`}>{d.reference}</DocLink> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="bg-wds-neutral-100 px-4 py-3 font-wds-sans text-[14px] text-wds-text-secondary">
          {sent} of {file.dispatches.length} sent
        </div>
      </nav>

      <section aria-label={`${current.departmentName} dispatch`} className="flex min-w-0 flex-col px-5 pb-4 pt-3">
        <div className="flex items-start justify-between gap-4 pb-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-wds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.01em] text-wds-text-ink">{current.departmentName}</h2>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              {current.reference ? `Dispatch ${current.reference} · ${stageChip(current.derivedState).text.toLowerCase()}${current.signedAt ? ` since ${clock(current.signedAt)}` : ''}` : `${current.lineCount} lines · to pack. It gets its dispatch number when the store signs.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data?.can.confirmForDepartment && data.stage === 'WAITING_FOR_BRANCH' ? <Button onClick={() => setConfirming(true)}>Confirm for the department</Button> : null}
            {current.reference ? (
              <Button variant="secondary" size="lg" className="h-9 px-4 text-[14px]" asChild>
                <Link href={`${base}/dispatch/${current.id}`}>Open the dispatch</Link>
              </Button>
            ) : null}
            {data?.can.cancel ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button ref={moreRef} variant="secondary" size="icon" aria-label={`More actions for ${current.departmentName}`} className="size-9">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="text-wds-error-fg" onSelect={() => setCancelling(true)}>
                    Cancel this dispatch
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        {!current.reference ? (
          <p className="border-t border-wds-border py-8 font-wds-sans text-[15px] leading-[22px] text-wds-text-secondary">{current.departmentName} is waiting to be packed. The store packs department by department and signs once.</p>
        ) : dispatch.status === 'error' ? (
          <ErrorState title="Couldn't load this dispatch" description="Check your connection and try again." onRetry={() => void dispatch.reload()} />
        ) : !data ? (
          <div aria-hidden className="flex flex-col gap-2 border-t border-wds-border pt-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-1 border border-wds-border sm:grid-cols-3">
              {[
                ['Packed by', `${nameAndTitle(data.packed.by)} · ${clock(data.packed.at)}`],
                ['Signed by', `${nameAndTitle(data.signed.by)} · ${clock(data.signed.at)}`],
                ['Carried by', data.carrier.name],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 border-b border-wds-border px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <dt><MonoLabel>{label}</MonoLabel></dt>
                  <dd className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div role="table" aria-label={`${current.departmentName} lines`} className="mt-1 flex flex-col">
              <div role="row" className="flex items-center gap-6 border-b border-wds-text-ink px-4 py-2.5">
                <MonoLabel className="flex-1">Item</MonoLabel>
                <MonoLabel className="w-[90px] shrink-0 text-right">Approved</MonoLabel>
                {data.sentVisible ? <MonoLabel className="w-[90px] shrink-0 text-right">Sent</MonoLabel> : null}
                {money ? <MonoLabel className="w-[100px] shrink-0 text-right">Value (KES)</MonoLabel> : null}
              </div>
              {items.map((item) => {
                const short = item.sentQty !== undefined && Number(item.sentQty) < Number(item.requestedQty);
                return (
                  <div key={item.lineId} role="row" className={cn('flex items-center gap-6 border-b border-wds-border px-4 py-[11px]', short && 'bg-wds-warning-bg')}>
                    <div role="cell" className="flex min-w-0 flex-1 flex-col">
                      <span className="font-wds-sans text-[15px] leading-5 text-wds-text-ink">{item.itemName}</span>
                      {short ? <span className="font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">Short: only {item.sentQty} in store. The next requisition will suggest it again.</span> : null}
                    </div>
                    <span role="cell" className="w-[90px] shrink-0 text-right font-wds-mono text-[14px] text-wds-text-ink">{item.requestedQty}</span>
                    {data.sentVisible ? <span role="cell" className={cn('w-[90px] shrink-0 text-right font-wds-mono text-[14px]', short ? 'font-semibold text-wds-warning-fg' : 'text-wds-text-ink')}>{item.sentQty}</span> : null}
                    {money ? <span role="cell" className="w-[100px] shrink-0 text-right font-wds-mono text-[14px] text-wds-text-ink">{item.valueKes !== undefined ? Number(item.valueKes).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''}</span> : null}
                  </div>
                );
              })}
            </div>
            {data.items.length > 3 ? (
              <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="border-b border-wds-border px-4 py-[11px] text-left font-wds-sans text-[14px] font-medium text-wds-primary outline-none focus-visible:shadow-wds-ring">
                {showAll ? 'Show fewer lines' : `Show the other ${data.items.length - 3} lines`}
              </button>
            ) : null}
          </>
        )}
      </section>

      {data ? (
        <CancelDispatchDialog
          dispatchId={data.id}
          reference={data.reference}
          departmentName={data.department.name}
          signedAtLabel={clock(data.signed.at)}
          lineCount={data.lineCount}
          returnFocus={() => moreRef.current}
          open={cancelling && data.can.cancel}
          onOpenChange={setCancelling}
          onCancelled={() => {
            setCancelling(false);
            useWdsToastStore.getState().addToast({ variant: 'success', title: 'Cancelled. The stock is back in the Central Store and the lines are in To pack.', description: 'The note prints marked void.' });
            void dispatch.reload();
            onChanged();
          }}
          onAlreadyCounted={() => {
            setCancelling(false);
            useWdsToastStore.getState().addToast({ variant: 'error', title: 'The branch has already counted this delivery, so it cannot be cancelled.', description: 'Any gap is now a discrepancy.' });
            void dispatch.reload();
            onChanged();
          }}
        />
      ) : null}
      {data ? (
        <ConfirmForDepartmentDrawer
          dispatchId={data.id}
          reference={data.reference}
          departmentName={data.department.name}
          lineCount={data.lineCount}
          leftAtLabel={clock(data.signed.at)}
          open={confirming && data.can.confirmForDepartment}
          onOpenChange={setConfirming}
          onConfirmed={(summary) => {
            setConfirming(false);
            useWdsToastStore.getState().addToast({ variant: 'success', title: `Confirmed on behalf of ${data.department.name}`, description: summary });
            void dispatch.reload();
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
