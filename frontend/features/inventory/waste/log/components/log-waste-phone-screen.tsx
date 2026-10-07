'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Keypad } from '@/components/ui2/keypad';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { PHONE_PRIMARY_BUTTON, PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { appendDigit } from '../../../counting/_shared/lib/count-format';
import { WASTE_STATES_COPY } from '../../_shared/lib/states-copy';
import { wasteApi } from '../../_shared/services/waste-api';
import { WASTE_REASONS, WASTE_REASON_TEXT, type WasteItemOption, type WasteReason } from '../../_shared/types/waste-contract';
import { useWasteCart } from '../hooks/use-waste-cart';

const WASTE = '/app/inventory/stock/waste';

/**
 * Log waste on the phone column (Paper steps 16 to 18): Pick what was wasted (`1ZC8-0`: "You often log" chips, search, the Added
 * list), How much, and why (`1ZDQ-0`: a sheet with the number pad and four reason chips, "Add"), and Check, then confirm
 * (`1ZFH-0`: the list with Edit, an optional note, "Confirm and log waste"). No value is shown (needs owner decision N3). No PIN.
 * Stock goes down only when confirmed. A failed log keeps every line; Back to edit returns to the list.
 */
export function LogWastePhoneScreen() {
  const router = useRouter();
  const { can, ready } = usePermissions();
  const cart = useWasteCart();
  const [step, setStep] = React.useState<'pick' | 'check'>('pick');
  const [text, setText] = React.useState('');
  const [q, setQ] = React.useState('');
  const [sheet, setSheet] = React.useState<{ item: WasteItemOption; qty: string; reason: WasteReason } | null>(null);
  const items = useLoader(ready && can('waste.log') ? `phone-waste-items:${q}` : null, () => wasteApi.items({ search: q || undefined, limit: 12 }), WASTE_STATES_COPY.pickWasted.error);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQ(text.trim()), 200);
    return () => window.clearTimeout(t);
  }, [text]);

  // Someone who sees stock figures logs from the desktop drawer, not this phone flow.
  React.useEffect(() => {
    if (ready && can('restock.read')) router.replace(`${WASTE}?drawer=log`);
  }, [ready, can, router]);

  if (ready && !can('waste.log')) {
    return (
      <PhoneColumn>
        <ScwPhoneHeader leading="back" onBack={() => router.push(WASTE)} title="Log waste" subtitle="What was thrown away · Central Store" />
        <ScwStatePanel kind="permission" phone text={WASTE_STATES_COPY.pickWasted.permission} />
      </PhoneColumn>
    );
  }

  const confirm = async (): Promise<void> => {
    const r = await cart.confirm();
    if (r) {
      cart.reset();
      router.replace(WASTE);
    }
  };

  if (step === 'check') {
    return (
      <PhoneColumn>
        <ScwPhoneHeader leading="back" onBack={() => setStep('pick')} title="Check and log" subtitle={`${cart.lines.length} item${cart.lines.length === 1 ? '' : 's'} · nothing has moved yet`} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
          <p className="flex gap-2.5 border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-neutral-700">
            <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-wds-warning-fg" aria-hidden />
            Stock goes down only when you confirm. Nothing is deleted later; a wrong entry can be reversed.
          </p>
          <ul className="mt-4 border border-wds-border bg-wds-surface">
            {cart.lines.map((l) => (
              <li key={l.item.itemId} className="flex min-h-[60px] items-center justify-between gap-3 border-b border-wds-neutral-100 px-3.5 py-2.5 last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-wds-sans text-[16px] leading-5 text-wds-text-ink">{l.item.name}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{WASTE_REASON_TEXT[l.reason]}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-wds-mono text-[16px] leading-5 text-wds-text-ink">{l.quantity} {l.item.unit}</span>
                  <button type="button" onClick={() => setSheet({ item: l.item, qty: l.quantity, reason: l.reason })} className="-m-2 p-2 font-wds-sans text-[13px] font-medium text-wds-selected-edge outline-none focus-visible:shadow-wds-ring">Edit<span className="sr-only"> {l.item.name}</span></button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <label htmlFor="phone-note" className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Note · optional</label>
            <input id="phone-note" value={cart.note} onChange={(e) => cart.setNote(e.target.value)} maxLength={200} placeholder="Anything the Store Manager should know?" className="h-12 border border-wds-border-strong bg-wds-surface px-3.5 font-wds-sans text-[15px] outline-none placeholder:text-wds-text-muted focus:border-wds-selected-edge focus:shadow-wds-ring" />
          </div>
          {cart.error ? <FormErrorBanner className="mt-4" title="Could not log it" description={cart.error} /> : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-4 pb-5 pt-3">
          <button type="button" disabled={cart.busy || cart.lines.length === 0} onClick={() => void confirm()} className={cn(PHONE_PRIMARY_BUTTON, 'h-[50px] text-[16px] leading-5')}>
            {cart.busy ? 'Logging…' : 'Confirm and log waste'}
          </button>
          <button type="button" disabled={cart.busy} onClick={() => setStep('pick')} className={PHONE_SECONDARY_BUTTON}>Back to edit</button>
        </div>
        <QuantitySheet sheet={sheet} setSheet={setSheet} onAdd={(l) => { cart.upsert(l); setSheet(null); }} />
      </PhoneColumn>
    );
  }

  const often = items.data?.often ?? [];
  const results = (items.data?.items ?? []).filter((i) => q !== '' || !often.some((o) => o.itemId === i.itemId));
  return (
    <PhoneColumn>
      <ScwPhoneHeader leading="back" onBack={() => router.push(WASTE)} title="Log waste" subtitle="What was thrown away · Central Store" />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        <label className="flex h-11 items-center gap-2 border border-wds-border bg-wds-surface px-3 focus-within:border-wds-selected-edge focus-within:shadow-wds-ring">
          <span className="size-3 shrink-0 rounded-[6px] border-[1.5px] border-wds-neutral-500" aria-hidden />
          <span className="sr-only">Find an item</span>
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Find an item" autoComplete="off" className="min-w-0 grow bg-transparent font-wds-sans text-[14px] outline-none placeholder:text-wds-text-muted" />
        </label>
        {items.status === 'loading' && !items.data ? (
          <>
            <LoadingAnnouncer text={WASTE_STATES_COPY.pickWasted.loading} />
            <div className="mt-4 flex flex-wrap gap-2" aria-hidden>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-28" />)}</div>
          </>
        ) : items.status === 'error' ? (
          <ScwStatePanel kind="error" phone text={WASTE_STATES_COPY.pickWasted.error} onRetry={() => void items.reload()} />
        ) : (
          <>
            {q === '' ? (
              <>
                <h2 className="pb-2.5 pt-4 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">You often log</h2>
                {often.length === 0 ? <p className="font-wds-sans text-[13px] text-wds-text-secondary">{WASTE_STATES_COPY.pickWasted.empty}</p> : (
                  <div className="flex flex-wrap gap-2">
                    {often.map((i) => <ItemChip key={i.itemId} item={i} onPick={() => setSheet({ item: i, qty: cart.lines.find((l) => l.item.itemId === i.itemId)?.quantity ?? '', reason: cart.lines.find((l) => l.item.itemId === i.itemId)?.reason ?? 'SPOILAGE' })} />)}
                  </div>
                )}
              </>
            ) : null}
            {q !== '' || results.length > 0 ? (
              <ul className="mt-3 flex flex-col">
                {results.map((i) => (
                  <li key={i.itemId} className="border-b border-wds-border">
                    <button type="button" onClick={() => setSheet({ item: i, qty: '', reason: 'SPOILAGE' })} className="flex h-12 w-full items-center justify-between text-left font-wds-sans text-[15px] text-wds-text-ink outline-none active:bg-wds-neutral-100 focus-visible:bg-wds-neutral-50">
                      <span>{i.name}</span><span className="text-[12px] text-wds-text-secondary">{i.unit}</span>
                    </button>
                  </li>
                ))}
                {q !== '' && results.length === 0 ? <li className="py-3 font-wds-sans text-[13px] text-wds-text-secondary" role="status">No item called “{q}”.</li> : null}
              </ul>
            ) : null}
          </>
        )}
        {cart.lines.length > 0 ? (
          <>
            <h2 className="pb-2.5 pt-5 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Added · {cart.lines.length}</h2>
            <ul className="border border-wds-border bg-wds-surface">
              {cart.lines.map((l) => (
                <li key={l.item.itemId} className="flex min-h-[54px] items-center justify-between gap-3 border-b border-wds-neutral-100 px-3.5 py-2 last:border-b-0">
                  <span className="flex min-w-0 flex-col"><span className="truncate font-wds-sans text-[16px] leading-5">{l.item.name}</span><span className="font-wds-sans text-[12px] text-wds-text-secondary">{WASTE_REASON_TEXT[l.reason]}</span></span>
                  <span className="flex items-center gap-2"><span className="font-wds-mono text-[16px]">{l.quantity} {l.item.unit}</span><button type="button" onClick={() => cart.remove(l.item.itemId)} aria-label={`Remove ${l.item.name}`} className="flex size-11 items-center justify-center text-wds-text-secondary outline-none focus-visible:shadow-wds-ring">×</button></span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <div className="shrink-0 px-4 pb-5 pt-3">
        <button type="button" disabled={cart.lines.length === 0} title={cart.lines.length === 0 ? 'Add an item first' : undefined} onClick={() => setStep('check')} className={cn(PHONE_PRIMARY_BUTTON, 'h-[52px] text-[16px] leading-5')}>
          Review {cart.lines.length} item{cart.lines.length === 1 ? '' : 's'}
        </button>
      </div>
      <QuantitySheet sheet={sheet} setSheet={setSheet} onAdd={(l) => { cart.upsert(l); setSheet(null); setText(''); }} />
    </PhoneColumn>
  );
}

function ItemChip({ item, onPick }: { item: WasteItemOption; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="h-11 border border-wds-border-strong bg-wds-surface px-3.5 font-wds-sans text-[15px] leading-5 text-wds-text-ink outline-none transition-[background-color,transform] focus-visible:shadow-wds-ring active:bg-wds-neutral-100 motion-safe:active:scale-[0.98]">
      {item.name}
    </button>
  );
}

/** How much, and why (Paper step 17, `1ZDQ-0`): the item, a quantity box fed by the number pad, four reason chips, and Add. */
function QuantitySheet({ sheet, setSheet, onAdd }: { sheet: { item: WasteItemOption; qty: string; reason: WasteReason } | null; setSheet: (s: { item: WasteItemOption; qty: string; reason: WasteReason } | null) => void; onAdd: (l: { item: WasteItemOption; quantity: string; reason: WasteReason }) => void }) {
  const valid = sheet ? Number(sheet.qty) > 0 : false;
  return (
    <BottomSheet open={sheet !== null} onOpenChange={(o) => (o ? undefined : setSheet(null))} label="How much, and why" scrim={45} className="gap-0">
      <SheetGrabber />
      {sheet ? (
        <>
          <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
            <div className="flex min-w-0 flex-col"><span className="truncate font-wds-sans text-[20px] font-semibold leading-6 text-wds-text-ink">{sheet.item.name}</span><span className="font-wds-sans text-[12px] text-wds-text-secondary">{sheet.item.unit}</span></div>
            <div aria-live="polite" role="status" aria-label={`Quantity ${sheet.qty || 'empty'}`} className="flex h-[52px] w-[120px] shrink-0 items-center justify-end gap-0.5 border-[1.5px] border-wds-selected-edge bg-wds-surface px-3">
              <span className="font-wds-mono text-[26px] leading-8">{sheet.qty}</span>
              <span className="h-7 w-0.5 bg-wds-selected-edge motion-safe:animate-[scw-caret_1.1s_steps(1)_infinite]" />
            </div>
          </div>
          <div className="flex flex-col gap-2 px-4 pb-3">
            <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Why?</span>
            <div role="radiogroup" aria-label="Why" className="flex flex-wrap gap-2">
              {WASTE_REASONS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={sheet.reason === r} onClick={() => setSheet({ ...sheet, reason: r })} className={cn('h-11 border px-3.5 font-wds-sans text-[14px] outline-none transition-colors focus-visible:shadow-wds-ring', sheet.reason === r ? 'border-wds-text-ink bg-wds-text-ink font-medium text-white' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink')}>{WASTE_REASON_TEXT[r]}</button>
              ))}
            </div>
          </div>
          <Keypad
            onDigit={(d) => setSheet({ ...sheet, qty: appendDigit(sheet.qty, d) })}
            onBackspace={() => setSheet({ ...sheet, qty: sheet.qty.slice(0, -1) })}
            action={{ label: 'Add', tone: 'primary', disabled: !valid, disabledReason: 'Type how much first', onPress: () => onAdd({ item: sheet.item, quantity: sheet.qty, reason: sheet.reason }) }}
          />
        </>
      ) : null}
    </BottomSheet>
  );
}
