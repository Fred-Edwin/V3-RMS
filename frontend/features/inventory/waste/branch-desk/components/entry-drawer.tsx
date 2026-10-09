'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui2/sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { clockLabel, signedKes } from '../../../counting/_shared/lib/count-format';
import { BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import { quantityLabel, shortPerson } from '../../_shared/lib/branch-waste-people';
import { branchWasteApi } from '../../_shared/services/branch-waste-api';
import { dayClock, reversalReasonShort } from '../lib/branch-waste-desk-format';

/** Rows whose value can wrap, as W7's Effect row (13/18); the others are 13/16. */
const WRAPS = new Set(['Note', 'Reversal reason']);

/**
 * One waste entry in a right drawer (Block 3 gap G10, built from the flow text "who logged it, when, reason and its ledger entry"; no
 * photo, owner decision 9 Oct). Opens from a row click or Enter, in the W7 facts-table style. The ledger rows appear only when the
 * server sends them (a caller who may see stock); a reversed entry shows who reversed it and why.
 */
export function EntryDrawer({ entryId, onClose }: { entryId: string | null; onClose: () => void }) {
  const loaded = useLoader(entryId, () => (entryId ? branchWasteApi.detail(entryId) : Promise.reject(new Error('no entry'))), BRANCH_WASTE_STATES_COPY.branchList.error);
  const entry = loaded.data?.entry ?? null;
  const ledger = loaded.data?.ledger;
  const money = entry?.valueKes !== undefined ? signedKes(entry.valueKes) : null;

  const rows: [string, React.ReactNode][] = entry
    ? [
        ['Entry', `${entry.itemName} · ${quantityLabel(entry.quantity, entry.unit)}`],
        ['Department', entry.department.name],
        ['Logged by', `${shortPerson(entry.loggedBy.name)} · ${dayClock(entry.at)}`],
        ['Reason', entry.reasonText],
        ...(money ? ([['Value', <span key="v" className="font-wds-mono">{money}</span>]] as [string, React.ReactNode][]) : []),
        ['Note', entry.note ?? 'None'],
        ...(entry.reversal
          ? ([
              ['Reversed', `${shortPerson(entry.reversal.by.name)} · ${dayClock(entry.reversal.at)}`],
              ['Reversal reason', `${entry.reversal.reasonText}${entry.reversal.note ? `: ${entry.reversal.note}` : ''}`],
            ] as [string, React.ReactNode][])
          : []),
      ]
    : [];

  return (
    <Sheet open={entryId !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" style={{ width: 480 }} className="max-w-[calc(100vw-16px)] gap-[18px] overflow-y-auto border-l border-wds-text-ink p-7">
        <div className="flex flex-col gap-1.5">
          <SheetDescription className="!font-wds-mono !text-[11px] uppercase !leading-[14px] tracking-[0.06em] text-wds-text-secondary">
            {entry ? `Waste entry · ${entry.branch.name}` : 'Waste entry'}
          </SheetDescription>
          <SheetTitle className="!text-[22px] font-semibold !leading-7 tracking-[-0.01em] text-wds-text-ink">{entry ? entry.itemName : 'Waste entry'}</SheetTitle>
          {entry?.status === 'REVERSED' && entry.reversal ? (
            <p role="status" className="m-0 w-fit border border-wds-border-strong bg-wds-neutral-100 px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-neutral-700">
              Reversed {clockLabel(entry.reversal.at)} · {reversalReasonShort(entry.reversal.reason)}
            </p>
          ) : null}
        </div>

        {loaded.status === 'error' ? (
          <ScwStatePanel kind="error" text={BRANCH_WASTE_STATES_COPY.branchList.error} onRetry={() => void loaded.reload()} />
        ) : !entry ? (
          <div aria-hidden className="flex flex-col gap-3">
            <LoadingAnnouncer text={BRANCH_WASTE_STATES_COPY.branchList.loading} />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : (
          <>
            <dl className="m-0 flex flex-col border-t border-wds-text-ink">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-6 border-b border-wds-border py-2.5">
                  <dt className={cn('shrink-0 font-wds-sans text-[13px] text-wds-text-secondary', WRAPS.has(label) ? 'leading-[18px]' : 'leading-4')}>{label}</dt>
                  <dd className={cn('m-0 text-right font-wds-sans text-[13px] text-wds-text-ink', WRAPS.has(label) ? 'leading-[18px]' : 'leading-4')}>{value}</dd>
                </div>
              ))}
            </dl>
            {ledger && ledger.length > 0 ? (
              <section aria-label="Ledger entries" className="flex flex-col gap-2">
                <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Ledger entries</span>
                <ul className="m-0 flex list-none flex-col border-t border-wds-text-ink p-0">
                  {ledger.map((row) => (
                    <li key={`${row.kind}-${row.at}`} className="flex items-center justify-between border-b border-wds-border py-2.5 font-wds-sans text-[13px] leading-4">
                      <span className="text-wds-text-secondary">
                        {row.kind === 'LOGGED' ? 'Logged' : 'Reversal'} · {dayClock(row.at)}
                      </span>
                      <span className="font-wds-mono text-wds-text-ink">{Number(row.quantity) > 0 ? '+' : '−'}{quantityLabel(String(Math.abs(Number(row.quantity))), entry.unit)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}

        <div className="mt-auto flex">
          <Button type="button" variant="flat" size="dialog" shape="square" className="h-11 px-5 text-[14px] leading-[18px]" onClick={onClose}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
