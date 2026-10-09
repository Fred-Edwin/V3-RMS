'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui2/skeleton';
import { Textarea } from '@/components/ui2/textarea';
import { cn } from '@/lib/cn';
import { DrawerShell } from '../../_shared/components/drawer-shell';
import { useAction, useLoader } from '../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../_shared/hooks/use-idempotency-key';
import { MonoLabel, PinField } from '../../requisitions/components/req-parts';
import { kes } from '../../requisitions/_shared/lib/requisitions-words';
import { drawerTitle, errorText, findingDescription } from '../../dispatch/lib/dispatch-words';
import { discrepanciesApi } from '../../dispatch/services/branch-side-api';
import { FINDING_NOTE_MAX, type DiscrepancyFile, type Finding, type FindingPreview, type RecordFindingResult } from '../_shared/types/discrepancies-contract';

/** Which finding is recorded against whom, in words ("Packer: Store Attendant"). */
const againstLine = (preview: FindingPreview): string => {
  switch (preview.against) {
    case 'STORE':
      return preview.againstParty ?? 'The store';
    case 'CARRIER':
      return `Carrier: ${preview.againstParty ?? ''}`.trim();
    case 'RECEIVER':
      return `Receiver: ${preview.againstParty ?? ''}`.trim();
    case 'UNEXPLAINED':
      return 'Unexplained, its own bucket';
  }
};

const effectSign = (quantity: string): string => {
  const n = Number(quantity);
  return n > 0 ? `+${n}` : `${n}`;
};

/** Paper D15: the four findings (three for an extra), what each does, then an optional note and the Store Manager's own PIN. */
export function FindingDrawer({ file, open, onOpenChange, onRecorded }: { file: DiscrepancyFile; open: boolean; onOpenChange: (open: boolean) => void; onRecorded: (result: RecordFindingResult) => void }) {
  const [finding, setFinding] = React.useState<Finding | null>(null);
  const [note, setNote] = React.useState('');
  const [pin, setPin] = React.useState('');
  const idem = useIdempotencyKey();
  const n = Math.abs(Number(file.gapQty));
  const preview = useLoader<FindingPreview>(open && finding ? `finding-preview:${file.id}:${finding}` : null, () => discrepanciesApi.preview(file.id, finding ?? 'CANT_TELL'), 'Could not load what this finding does.');
  const record = useAction((input: { finding: Finding; note?: string; pin: string }) => discrepanciesApi.record(file.id, { ...input, idempotencyKey: idem.key() }), 'Could not record the finding. Nothing was changed. Try again.');

  React.useEffect(() => {
    if (open) {
      setFinding(file.allowedFindings[0] ?? null);
      setNote('');
      setPin('');
      record.clear();
      idem.renew();
    }
    // Reset only when the drawer opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + file.allowedFindings.length) % file.allowedFindings.length;
    refs.current[next]?.focus();
    const target = file.allowedFindings[next];
    if (target) setFinding(target);
  };

  const submit = async (): Promise<void> => {
    if (!finding || pin.length !== 4) return;
    const result = await record.run({ finding, note: note.trim() || undefined, pin });
    if (result) onRecorded(result);
    else setPin('');
  };

  const ctx = { sent: file.sentQty, counted: file.countedQty, gap: n, item: file.item.name };
  const failure = record.failure && record.failure.code !== 'INVALID_PIN' ? errorText(record.failure.code, record.failure.message) : null;
  const p = preview.data;

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={drawerTitle(file.item.name, n, file.direction)}
      description={`${file.reference} · ${file.item.name.toUpperCase()} ${file.direction === 'EXTRA' ? 'OVER' : 'SHORT'} BY ${n}`}
      primaryLabel={record.saving ? 'Recording…' : 'Record the finding'}
      primaryDisabled={!finding || pin.length !== 4 || record.saving}
      onPrimaryAction={() => void submit()}
      paper
    >
      {failure ? <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{failure}</p> : null}
      <div role="radiogroup" aria-label="What happened" className="border border-wds-neutral-950">
        {file.allowedFindings.map((f, index) => {
          const on = f === finding;
          const d = findingDescription(f, file.direction, ctx);
          return (
            <button
              key={f}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (!finding && index === 0) ? 0 : -1}
              onClick={() => setFinding(f)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn('flex w-full items-start gap-3 border-b border-wds-border px-4 py-3.5 text-left outline-none last:border-b-0 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]', on ? 'bg-wds-caramel-100 shadow-[inset_3px_0_0_0_var(--wds-primary-btn-start)]' : 'hover:bg-wds-neutral-50')}
            >
              <span aria-hidden className={cn('mt-px flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-[var(--wds-primary-btn-start)]' : 'border-wds-border-strong')}>
                {on ? <span className="size-2.5 rounded-full bg-[var(--wds-primary-btn-start)]" /> : null}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{d.title}</span>
                <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{d.body}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section aria-label="What this does" aria-live="polite" className="border border-wds-neutral-950">
        {preview.status === 'error' ? (
          <p className="px-4 py-3 font-wds-sans text-[14px] text-wds-error-fg">Could not load what this finding does. Choose it again to retry.</p>
        ) : !p ? (
          <div aria-hidden className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-64" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-wds-neutral-950 px-3.5 py-3">
              <div className="flex flex-col gap-0.5">
                <MonoLabel className="text-[11px] leading-[14px]">What this does</MonoLabel>
                <p className="font-wds-sans text-[16px] font-semibold leading-[22px] text-wds-text-ink">
                  {p.itemName} · {p.effects[0] ? `${Math.abs(Number(p.effects[0].quantity)) || n} ${p.effects[0].place === 'CENTRAL_STORE' && Number(p.effects[0].quantity) > 0 ? 'back in store' : p.effects[0].place === 'WRITTEN_OFF' ? 'written off' : 'corrected'}` : `${n}`}
                </p>
              </div>
              <span className={cn('mt-0.5 border px-2 py-[3px] font-wds-sans text-[12px] leading-4', p.lossKind === 'LOSS' ? 'border-wds-error-border bg-wds-error-bg text-wds-error-fg' : 'border-wds-border-strong bg-wds-neutral-100 text-wds-text-secondary')}>
                {p.lossKind === 'LOSS' ? 'A loss' : p.lossKind === 'PACKING_ERROR' ? 'Not a loss' : 'Not a loss'}
              </span>
            </div>
            <dl>
              {p.effects.map((e) => (
                <div key={`${e.place}-${e.placeName}`} className="flex items-center justify-between border-b border-wds-border px-3.5 py-2.5 last:border-b-0">
                  <dt className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{e.placeName}</dt>
                  <dd className="font-wds-mono text-[13px] leading-[18px] text-wds-text-ink">{e.place === 'WRITTEN_OFF' ? Math.abs(Number(e.quantity)) : effectSign(e.quantity)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-wds-border px-3.5 py-2.5">
                <dt className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Recorded against</dt>
                <dd className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{againstLine(p)}</dd>
              </div>
              {p.lossValueKes !== undefined ? (
                <div className="flex items-center justify-between border-t border-wds-border px-3.5 py-2.5">
                  <dt className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Written off at cost</dt>
                  <dd className="font-wds-mono text-[13px] leading-[18px] text-wds-text-ink">KES {kes(p.lossValueKes)}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </section>

      <div className="flex flex-col gap-1.5">
        <MonoLabel htmlFor="finding-note" className="text-[11px] leading-[14px]">Note (optional)</MonoLabel>
        <Textarea id="finding-note" rows={2} maxLength={FINDING_NOTE_MAX} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Checked the pack list with the attendant." />
      </div>
      <PinField wide value={pin} onChange={setPin} onSubmit={() => void submit()} invalid={record.failure?.code === 'INVALID_PIN'} id="finding-pin" />
      {record.failure?.code === 'INVALID_PIN' ? <p role="alert" className="-mt-2 font-wds-sans text-[13px] text-wds-error-fg">{errorText('INVALID_PIN', null)}</p> : null}
    </DrawerShell>
  );
}
