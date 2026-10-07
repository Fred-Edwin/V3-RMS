'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { Textarea } from '@/components/ui2/textarea';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { WarningBox } from '../../_shared/components/expected-yield-note';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatQuantity } from '../../_shared/lib/prep-format';
import { prepApi } from '../../_shared/services/prep-api';
import type { CancelPreview, CancelReason, RunDetail } from '../../_shared/types/prep-contract';
import { CANCEL_REASONS, cancelEffectRows, fixFailure, type FixFailure } from '../lib/fix-logic';
import { FixModal } from './fix-modal';
import { ReasonChips } from './reason-chips';

const sectionLabel = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted';

export interface CancelRunViewProps {
  run: RunDetail;
  /** True for a caller who may see stock (the Store Manager's screen): shows the CHANGE table and the below-zero warning. */
  showStock: boolean;
  previewStatus: 'idle' | 'loading' | 'ready' | 'error';
  preview: CancelPreview | null;
  reason: CancelReason | undefined;
  note: string;
  failure: FixFailure | null;
  disabled?: boolean;
  onReason: (reason: CancelReason) => void;
  onNote: (note: string) => void;
}

/** "Only 6 kg of chapati dough is in stock now. After this it will show −8 kg." for each item the cancel would take below zero. */
export const belowZeroText = (item: CancelPreview['items'][number]): string =>
  `Only ${formatQuantity(item.onHandNow)} ${item.unit} of ${item.itemName.toLowerCase()} is in stock now. After this it will show ${formatQuantity(item.onHandAfter).replace('-', '−')} ${item.unit}. That is allowed and will be marked negative on stock screens.`;

/**
 * The body of "Cancel this run?" (Paper step 16 `85D-0` on a phone, step 18 `8FN-0` for the manager): what goes back, what is
 * removed, the below-zero warning, and the reason chips. Pure of state so each state renders in a test.
 */
export function CancelRunView(p: CancelRunViewProps) {
  const effects = cancelEffectRows(p.run);
  const below = p.preview?.items.filter((i) => i.belowZero) ?? [];
  return (
    <>
      <div className="border border-wds-border">
        {p.showStock ? (
          <div className="flex items-center justify-between border-b border-wds-text-ink px-0 py-2 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-ink md:px-0">
            <span>What happens to stock</span>
            <span>Change</span>
          </div>
        ) : null}
        <ul>
          {effects.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-wds-4 border-b border-wds-border bg-wds-neutral-50 px-[14px] py-3 last:border-b-0">
              <span className="min-w-0 break-words font-wds-sans text-wds-body-sm leading-4 text-wds-text-copy-muted">{row.label}</span>
              <span className={cn('shrink-0 text-right font-wds-sans text-wds-body font-medium leading-[18px]', row.tone === 'out' ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
                {p.showStock ? `${row.tone === 'out' ? '−' : '+'}${row.value}` : row.value}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {p.showStock && p.previewStatus === 'loading' ? <Skeleton className="h-[52px] w-full" aria-label="Checking stock" /> : null}
      {p.showStock && p.previewStatus === 'error' ? (
        <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Couldn&apos;t check stock levels. You can still cancel; stock is allowed to go below zero.</p>
      ) : null}
      {below.map((item) => (
        <div key={item.itemId} role="alert" className="border border-wds-error-border bg-wds-error-bg px-[14px] py-[10px] font-wds-sans text-wds-body-sm leading-[18px] text-wds-error-fg">
          {belowZeroText(item)}
        </div>
      ))}

      <ReasonChips label="Why are you cancelling it?" options={CANCEL_REASONS} value={p.reason} onChange={p.onReason} disabled={p.disabled} />
      {p.reason === 'OTHER' ? (
        <label className="flex flex-col gap-2">
          <span className={sectionLabel}>Add a note (optional)</span>
          <Textarea maxLength={300} rows={2} value={p.note} disabled={p.disabled} onChange={(e) => p.onNote(e.target.value)} />
        </label>
      ) : null}
      {p.failure ? <WarningBox>{p.failure.message}</WarningBox> : null}
    </>
  );
}

export interface CancelRunDialogProps {
  run: RunDetail;
  open: boolean;
  /** Keep run, Escape, the backdrop or the close control: nothing was written. */
  onClose: () => void;
  /** Called with the cancelled run once the server has done it. */
  onDone: (cancelled: RunDetail) => void;
  /** The server said this person may no longer fix this run. */
  onLocked?: () => void;
}

function CancelRunDialogOpen({ run, onClose, onDone, onLocked }: Omit<CancelRunDialogProps, 'open'>) {
  const { can, ready } = usePermissions();
  const showStock = ready && can('restock.read');
  const preview = useLoader(showStock ? `prep-cancel-preview:${run.id}` : null, () => prepApi.cancelPreview(run.id), PREP_STATES_COPY.fix.cancelFailed);
  const [reason, setReason] = React.useState<CancelReason | undefined>();
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState<FixFailure | null>(null);
  const inFlight = React.useRef(false);

  const confirm = async (): Promise<void> => {
    if (reason === undefined || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFailure(null);
    try {
      const trimmed = note.trim();
      const cancelled = await prepApi.cancelRun(run.id, { reason, ...(trimmed && reason === 'OTHER' ? { reasonNote: trimmed } : {}) });
      useWdsToastStore.getState().addToast({ variant: 'success', title: `${run.reference} cancelled`, description: 'It stays on record as cancelled.' });
      onDone(cancelled);
    } catch (err) {
      const next = fixFailure(err, PREP_STATES_COPY.fix.cancelFailed);
      setFailure(next);
      if (next.locked) onLocked?.();
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <FixModal
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      locked={saving}
      title={showStock ? `Cancel ${run.reference}?` : 'Cancel this run?'}
      description={
        showStock
          ? `${run.outputName} · recorded by ${run.by.name}`
          : 'This undoes the whole run. Nothing is deleted; the run stays on record as cancelled.'
      }
      footerNote="Stays on record as cancelled."
      footer={
        <>
          <Button variant="secondary" className="h-[52px] w-[120px] text-[15px] md:h-9 md:w-auto" disabled={saving} onClick={onClose}>
            Keep run
          </Button>
          <Button variant="destructive" className="h-[52px] grow text-[16px] font-semibold md:h-9 md:grow-0 md:text-wds-body-sm" disabled={saving || reason === undefined} onClick={() => void confirm()}>
            {saving ? 'Cancelling…' : 'Cancel run'}
          </Button>
        </>
      }
    >
      <CancelRunView
        run={run}
        showStock={showStock}
        previewStatus={preview.status}
        preview={preview.data}
        reason={reason}
        note={note}
        failure={failure}
        disabled={saving}
        onReason={setReason}
        onNote={setNote}
      />
      {reason === undefined ? <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{PREP_STATES_COPY.fix.needCancelReason}</p> : null}
    </FixModal>
  );
}

/** "Cancel this run?": a bottom sheet on a phone, a centred dialog on a tablet or computer. Mounted only while open, so each opening is a fresh form. */
export function CancelRunDialog({ open, ...rest }: CancelRunDialogProps) {
  return open ? <CancelRunDialogOpen {...rest} /> : null;
}
