'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui2/skeleton';
import { ErrorState } from '@/components/app/shell/shell-states';
import { cn } from '@/lib/cn';
import { DrawerShell } from '../../_shared/components/drawer-shell';
import { useAction, useLoader } from '../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../_shared/hooks/use-idempotency-key';
import { MonoLabel, PinField } from '../../requisitions/components/req-parts';
import { errorText, findingDescription } from '../../dispatch/lib/dispatch-words';
import { discrepanciesApi } from '../../dispatch/services/branch-side-api';
import type { DiscrepancyFile, Finding } from '../_shared/types/discrepancies-contract';
import { gapWords } from '../lib/delivery-findings';

/**
 * Paper chapter 14, D: one drawer for a delivery's open lines. Each line has its own cause (none chosen for the Store Manager), one
 * PIN records them all. The findings are recorded one after the other with the same PIN; a line that fails stays open and says so.
 */
export function DeliveryFindingsDrawer({ dispatchReference, departmentName, discrepancyIds, open, onOpenChange, onRecorded }: {
  dispatchReference: string;
  departmentName: string;
  discrepancyIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: (count: number) => void;
}) {
  const key = discrepancyIds.join(',');
  const files = useLoader<DiscrepancyFile[]>(open ? `delivery-findings:${key}` : null, () => Promise.all(discrepancyIds.map((id) => discrepanciesApi.file(id))), 'Could not load these lines.');
  const [causes, setCauses] = React.useState<Record<string, Finding>>({});
  const [pin, setPin] = React.useState('');
  const idem = useIdempotencyKey();
  const [left, setLeft] = React.useState<string[] | null>(null);

  const record = useAction(async (code: string) => {
    const todo = (files.data ?? []).filter((f) => (left ?? discrepancyIds).includes(f.id));
    const stillOpen: string[] = [];
    let done = 0;
    let firstError: unknown = null;
    for (const f of todo) {
      const finding = causes[f.id];
      if (!finding) {
        stillOpen.push(f.id);
        continue;
      }
      try {
        await discrepanciesApi.record(f.id, { finding, pin: code, idempotencyKey: `${idem.key()}:${f.id}` });
        done += 1;
      } catch (err) {
        stillOpen.push(f.id);
        firstError ??= err;
        // A wrong PIN will fail the rest the same way: stop here and let the person retype it.
        if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'INVALID_PIN') break;
      }
    }
    setLeft(stillOpen);
    if (firstError) throw firstError;
    return done;
  }, 'Could not record the findings. Nothing was changed. Try again.');

  React.useEffect(() => {
    if (!open) return;
    setCauses({});
    setPin('');
    setLeft(null);
    record.clear();
    idem.renew();
    // Reset only when the drawer opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pending = (files.data ?? []).filter((f) => (left ?? discrepancyIds).includes(f.id));
  const allChosen = pending.length > 0 && pending.every((f) => causes[f.id]);

  const submit = async (): Promise<void> => {
    if (!allChosen || pin.length !== 4) return;
    const result = await record.run(pin);
    if (result !== null) onRecorded(result);
    else setPin('');
  };

  // The fourth digit signs once every line has a cause.
  React.useEffect(() => {
    if (open && allChosen && pin.length === 4 && !record.saving) void submit();
    // `submit` closes over the current pin and causes; this runs only when the pin reaches four digits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const failure = record.failure && record.failure.code !== 'INVALID_PIN' ? errorText(record.failure.code, record.failure.message) : null;
  const n = pending.length || discrepancyIds.length;

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={`What happened to these ${n} lines?`}
      description={`${dispatchReference} · ${departmentName.toUpperCase()} · ${n} LINES`}
      primaryLabel={record.saving ? 'Recording…' : `Record ${n} findings`}
      primaryDisabled={!allChosen || pin.length !== 4 || record.saving}
      onPrimaryAction={() => void submit()}
      paper
    >
      {files.status === 'error' ? (
        <ErrorState title="Couldn't load these lines" description="Check your connection and try again." onRetry={() => void files.reload()} />
      ) : !files.data ? (
        <div aria-hidden className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {failure ? <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{failure}</p> : null}
          {pending.map((f) => {
            const chosen = causes[f.id] ?? null;
            const ctx = { sent: f.sentQty, counted: f.countedQty, gap: Math.abs(Number(f.gapQty)), item: f.item.name };
            return (
              <section key={f.id} aria-label={f.item.name} className="flex flex-col gap-2.5 border border-wds-border p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{f.item.name}</span>
                  <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{gapWords(f.sentQty, f.countedQty, f.gapQty)}</span>
                </div>
                <div role="radiogroup" aria-label={`What happened to ${f.item.name}`} className="flex flex-wrap gap-2">
                  {f.allowedFindings.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={chosen === option}
                      onClick={() => setCauses((all) => ({ ...all, [f.id]: option }))}
                      className={cn(
                        'border px-3 py-2 font-wds-sans text-[13px] leading-[18px] outline-none focus-visible:shadow-wds-ring',
                        chosen === option ? 'border-wds-sidebar-top bg-wds-sidebar-top text-wds-neutral-0' : 'border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50',
                      )}
                    >
                      {findingDescription(option, f.direction, ctx).title}
                    </button>
                  ))}
                </div>
                <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                  {chosen ? findingDescription(chosen, f.direction, ctx).body : 'Choose what happened. Nothing is chosen for you.'}
                </p>
              </section>
            );
          })}
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">One PIN records every finding on this delivery.</p>
          <PinField wide value={pin} onChange={setPin} onSubmit={() => void submit()} invalid={record.failure?.code === 'INVALID_PIN'} id="delivery-findings-pin" />
          {record.failure?.code === 'INVALID_PIN' ? <p role="alert" className="-mt-2 font-wds-sans text-[13px] text-wds-error-fg">{errorText('INVALID_PIN', null)}</p> : null}
        </>
      )}
      <MonoLabel className="sr-only">{dispatchReference}</MonoLabel>
    </DrawerShell>
  );
}
