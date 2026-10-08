'use client';

import * as React from 'react';

import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { cn } from '@/lib/cn';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useAuthStore } from '@/store/authStore';
import { dayClockLabel, signedKes } from '../../../counting/_shared/lib/count-format';
import { WASTE_STATES_COPY } from '../../_shared/lib/states-copy';
import { wasteApi } from '../../_shared/services/waste-api';
import { WASTE_REASONS, WASTE_REASON_TEXT, type WasteItemOption } from '../../_shared/types/waste-contract';
import { useWasteCart } from '../hooks/use-waste-cart';

/**
 * Log waste, desktop (Paper step 22, `1ZS7-0`; `/stock/waste?drawer=log`): search an item to add it, a quantity box with its unit and
 * four reason chips per line, the value of each line and the total ("valued at today's cost"), an optional note, and "Log N items".
 * Stock goes down only when logged; negative stock is allowed and flagged, never blocked. Closing with items entered asks first.
 */
export function LogWasteDrawer({ open, onOpenChange, onLogged }: { open: boolean; onOpenChange: (o: boolean) => void; onLogged: () => void }) {
  const cart = useWasteCart();
  const user = useAuthStore((s) => s.user);
  const [text, setText] = React.useState('');
  const [q, setQ] = React.useState('');
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [now] = React.useState(() => new Date().toISOString());
  const items = useLoader(open ? `waste-items:${q}` : null, () => wasteApi.items({ search: q || undefined, limit: 8 }), WASTE_STATES_COPY.pickWasted.error);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQ(text.trim()), 200);
    return () => window.clearTimeout(t);
  }, [text]);

  const total = cart.lines.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.item.unitCost ?? 0), 0);
  const hasCosts = cart.lines.some((l) => l.item.unitCost !== undefined);
  const invalid = cart.lines.some((l) => !(Number(l.quantity) > 0));
  const dirty = cart.lines.length > 0 || cart.note !== '';
  const close = (): void => (dirty && !cart.busy ? setConfirmLeave(true) : onOpenChange(false));

  const add = (item: WasteItemOption): void => {
    if (!cart.lines.some((l) => l.item.itemId === item.itemId)) cart.upsert({ item, quantity: '1', reason: 'SPOILAGE' });
    setText('');
  };

  const log = async (): Promise<void> => {
    const result = await cart.confirm();
    if (!result) return;
    useWdsToastStore.getState().addToast({ variant: 'success', title: `${result.entries.length} item${result.entries.length === 1 ? '' : 's'} logged`, description: result.wentNegative ? 'Stock for one item went below zero. It is flagged.' : undefined });
    cart.reset();
    onLogged();
    onOpenChange(false);
  };

  const options = (items.data?.items ?? []).filter((i) => !cart.lines.some((l) => l.item.itemId === i.itemId));
  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
        <SheetContent side="right" className="w-[480px] gap-0 border-l border-wds-border-strong" onInteractOutside={(e) => { e.preventDefault(); close(); }}>
          <SheetHeader className="border-b-0 px-7 pb-4 pt-6">
            <SheetTitle className="text-[20px] leading-[26px]">Log waste</SheetTitle>
            <SheetDescription className="text-[13px] leading-4 text-wds-text-secondary">{user?.name} · {dayClockLabel(now)}</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-7">
            <div className="relative">
              <label className="flex h-11 items-center border border-wds-border-strong bg-wds-surface px-3 focus-within:border-wds-selected-edge focus-within:shadow-wds-ring">
                <span className="sr-only">Add an item</span>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item" autoComplete="off" role="combobox" aria-expanded={text !== ''} aria-controls="waste-options" className="min-w-0 grow bg-transparent font-wds-sans text-[14px] text-wds-text-ink outline-none placeholder:text-wds-text-faint" />
              </label>
              {text.trim() !== '' ? (
                <ul id="waste-options" role="listbox" className="absolute inset-x-0 top-12 z-10 border border-wds-border-strong bg-wds-surface shadow-wds-md">
                  {options.length === 0 ? <li className="px-3 py-2.5 font-wds-sans text-[13px] text-wds-text-secondary">No item called “{text.trim()}”.</li> : options.map((i) => (
                    <li key={i.itemId} role="option" aria-selected={false}>
                      <button type="button" onClick={() => add(i)} className="flex h-10 w-full items-center justify-between px-3 text-left font-wds-sans text-[14px] outline-none hover:bg-wds-neutral-50 focus-visible:bg-wds-neutral-50">
                        <span>{i.name}</span>
                        <span className="text-[12px] text-wds-text-secondary">{i.unit}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {items.status === 'error' ? <FormErrorBanner title="Could not load items" description={WASTE_STATES_COPY.pickWasted.error} /> : null}

            {cart.lines.length > 0 ? (
              <div className="flex flex-col">
                <div className="flex h-7 items-center justify-between border-t border-wds-text-ink pt-1 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                  <span>Item</span>
                  <span className="flex gap-9"><span>Qty</span>{hasCosts ? <span>Value</span> : null}</span>
                </div>
                {cart.lines.map((l) => (
                  <div key={l.item.itemId} className="flex flex-col gap-2.5 border-b border-wds-neutral-100 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="grow truncate font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{l.item.name}</span>
                      <label className="flex h-9 w-[70px] items-center justify-end gap-1 border border-wds-border-strong bg-wds-surface px-2 focus-within:border-wds-selected-edge focus-within:shadow-wds-ring">
                        <span className="sr-only">Quantity of {l.item.name}</span>
                        <input inputMode="decimal" value={l.quantity} onChange={(e) => /^\d*\.?\d{0,4}$/.test(e.target.value) && cart.upsert({ ...l, quantity: e.target.value })} aria-invalid={!(Number(l.quantity) > 0)} className="w-8 min-w-0 bg-transparent text-right font-wds-mono text-[14px] outline-none" />
                        <span className="font-wds-mono text-[13px] text-wds-text-secondary">{l.item.unit}</span>
                      </label>
                      {hasCosts ? <span className="w-12 text-right font-wds-mono text-[14px] text-wds-text-ink">{Math.round(Number(l.quantity || 0) * Number(l.item.unitCost ?? 0)).toLocaleString('en-KE')}</span> : null}
                      <button type="button" onClick={() => cart.remove(l.item.itemId)} aria-label={`Remove ${l.item.name}`} className="flex size-7 items-center justify-center text-wds-text-secondary outline-none hover:text-wds-text-ink focus-visible:shadow-wds-ring">×</button>
                    </div>
                    <div role="radiogroup" aria-label={`Why ${l.item.name}`} className="flex flex-wrap gap-2">
                      {WASTE_REASONS.map((r) => (
                        <button key={r} type="button" role="radio" aria-checked={l.reason === r} onClick={() => cart.upsert({ ...l, reason: r })} className={cn('h-8 border px-3 font-wds-sans text-[13px] outline-none transition-colors focus-visible:shadow-wds-ring', l.reason === r ? 'border-wds-text-ink bg-wds-text-ink font-medium text-white' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50')}>{WASTE_REASON_TEXT[r]}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {hasCosts ? (
                  <div className="flex h-11 items-center justify-between border-b border-wds-text-ink">
                    <span className="font-wds-sans text-[14px] font-semibold text-wds-text-ink">Total waste value</span>
                    <span className="font-wds-mono text-[15px] font-semibold text-wds-text-ink" aria-live="polite">{signedKes(String(total))}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="waste-note" className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Note · optional</label>
              <input id="waste-note" value={cart.note} onChange={(e) => cart.setNote(e.target.value)} maxLength={200} placeholder="Add a note for the audit log" className="h-10 border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[14px] outline-none placeholder:text-wds-text-faint focus:border-wds-selected-edge focus:shadow-wds-ring" />
            </div>
            <p className="border border-wds-info-border bg-wds-info-bg px-3.5 py-3 font-wds-sans text-[12px] leading-[17px] text-wds-info-fg">Stock goes down by these quantities, valued at today's cost. Each entry stays on record and can be reversed with a reason.</p>
            {cart.error ? <FormErrorBanner title="Could not log it" description={cart.error} /> : null}
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-wds-border px-7 pb-6 pt-4">
            <button type="button" onClick={close} className="font-wds-sans text-[13px] font-medium text-wds-selected-edge outline-none hover:underline focus-visible:shadow-wds-ring">Cancel</button>
            <button type="button" disabled={cart.lines.length === 0 || invalid || cart.busy} title={cart.lines.length === 0 ? 'Add an item first' : invalid ? 'Every quantity must be above 0' : undefined} onClick={() => void log()} className="h-10 bg-wds-gradient-primary px-5 font-wds-sans text-[14px] font-semibold text-wds-primary-fg outline-none transition-[filter,transform] hover:brightness-110 focus-visible:shadow-wds-ring disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.99]">
              {cart.busy ? 'Logging…' : cart.lines.length === 0 ? 'Log waste' : `Log ${cart.lines.length} item${cart.lines.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmLeave} onOpenChange={setConfirmLeave} title="Discard this waste?" description="You added items that are not logged yet." confirmLabel="Discard" cancelLabel="Keep editing" destructive={false} onConfirm={() => { setConfirmLeave(false); cart.reset(); onOpenChange(false); }} />
    </>
  );
}
