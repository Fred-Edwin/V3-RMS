'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { PhoneErrorNote } from '../../../_shared/components/phone-parts';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { PHONE_PRIMARY_BUTTON_TOKEN, PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { BRANCH_WASTE_BUTTONS, BRANCH_WASTE_MESSAGES, BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import { WASTE_REASON_TEXT, type BranchWasteItems, type WasteItemOption } from '../../_shared/types/waste-contract';
import { NOTE_MAX, useBranchWasteCart } from '../hooks/use-branch-waste-cart';
import { useDepartmentName } from '../hooks/use-department-name';
import { quantityLabel } from '../../_shared/lib/branch-waste-people';
import { branchWasteApi } from '../../_shared/services/branch-waste-api';
import { AmountSheet, type AmountSheetTarget } from './amount-sheet';
import { BranchHeader, hitArea, SectionLabel } from './parts';

const WASTE = '/app/waste';
const PRIMARY = cn(PHONE_PRIMARY_BUTTON_TOKEN, 'h-[50px] w-full text-[16px] leading-5');

/**
 * Log waste on the phone (Paper W1 to W3): Pick what was wasted (search, "You often log" chips, the Added list), How much, and why
 * (the sheet), then Check and log. Stock goes down only on "Confirm and log waste" (no PIN, one request, one idempotency key). A failed
 * log keeps every line. The department comes from the server, never from this screen.
 */
export function LogWasteFlow() {
  const router = useRouter();
  const department = useDepartmentName();
  const cart = useBranchWasteCart();
  const [step, setStep] = React.useState<'pick' | 'check'>('pick');
  const [text, setText] = React.useState('');
  const [q, setQ] = React.useState('');
  const [sheet, setSheet] = React.useState<AmountSheetTarget | null>(null);
  const [discard, setDiscard] = React.useState(false);
  // The item just added or edited: focus returns to its Added line, because the chip or result that opened the sheet may be gone.
  const [refocus, setRefocus] = React.useState<string | null>(null);
  const regionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQ(text.trim()), 200);
    return () => window.clearTimeout(t);
  }, [text]);

  // A step change replaces the screen's content: put focus on the new region so keyboard and screen-reader users start at its top.
  React.useEffect(() => {
    regionRef.current?.focus();
  }, [step]);

  React.useEffect(() => {
    if (!refocus) return;
    document.querySelector<HTMLElement>(`[data-line-id="${refocus}"]`)?.focus();
    setRefocus(null);
  }, [refocus, cart.lines]);

  // Removing the last line from the check step leaves nothing to check.
  React.useEffect(() => {
    if (step === 'check' && cart.lines.length === 0) setStep('pick');
  }, [step, cart.lines.length]);

  const items = useLoader<BranchWasteItems>(`bw-items:${q}`, () => branchWasteApi.items({ search: q || undefined, limit: 12 }), BRANCH_WASTE_STATES_COPY.pick.error);
  // Keep the last answer on screen while the next search loads, so the list does not jump.
  const [shown, setShown] = React.useState<BranchWasteItems | null>(null);
  React.useEffect(() => {
    if (items.data) setShown(items.data);
  }, [items.data]);

  const open = (item: WasteItemOption): void => {
    const line = cart.lines.find((l) => l.item.itemId === item.itemId);
    setSheet({ item, quantity: line?.quantity ?? '', reason: line?.reason ?? null, editing: line !== undefined });
  };
  const leave = (): void => (cart.lines.length > 0 ? setDiscard(true) : router.push(WASTE));
  const confirm = async (): Promise<void> => {
    const result = await cart.confirm();
    // The screen unmounts on navigation, so the lines are not cleared here (clearing would flash the pick step first).
    if (result) router.replace(`${WASTE}?logged=1`);
  };

  const count = cart.lines.length;
  const sheetEl = (
    <AmountSheet
      target={sheet}
      onChange={setSheet}
      onClose={() => setSheet(null)}
      onAdd={(t) => {
        cart.upsert({ item: t.item, quantity: t.quantity, reason: t.reason });
        setSheet(null);
        setText('');
        setRefocus(t.item.itemId);
      }}
      onRemove={(itemId) => {
        cart.remove(itemId);
        setSheet(null);
      }}
    />
  );

  if (step === 'check') {
    return (
      <PhoneColumn>
        <BranchHeader leading="back" onBack={() => setStep('pick')} title="Check and log" subtitle={`${count} ${count === 1 ? 'item' : 'items'} · nothing has moved yet`} />
        <div ref={regionRef} tabIndex={-1} aria-label="Check and log" role="region" className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-4 pb-4 pt-4 outline-none">
          {cart.error ? <PhoneErrorNote>{cart.error}</PhoneErrorNote> : null}
          <p className="flex gap-2.5 border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3 font-wds-sans text-[12px] leading-[17px] text-wds-neutral-700">
            <span className="mt-[5px] size-1.5 shrink-0 rounded-[3px] bg-wds-warning-fg" aria-hidden />
            {BRANCH_WASTE_MESSAGES.beforeConfirm}
          </p>
          <ul className="border border-wds-border bg-wds-surface">
            {cart.lines.map((l) => (
              <li key={l.item.itemId} className="flex h-[60px] items-center gap-3 border-b border-wds-neutral-100 px-3.5 last:border-b-0">
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate font-wds-sans text-[15px] leading-[18px] text-wds-text-ink">{l.item.name}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{WASTE_REASON_TEXT[l.reason]}</span>
                </span>
                <span className="font-wds-mono text-[16px] leading-5 text-wds-text-ink">{quantityLabel(l.quantity, l.item.unit)}</span>
                <button type="button" disabled={cart.busy} onClick={() => open(l.item)} className="relative font-wds-sans text-[12px] font-medium leading-4 text-wds-selected-edge outline-none before:absolute before:-inset-x-3 before:-inset-y-[14px] before:content-[''] focus-visible:shadow-wds-ring">
                  Edit<span className="sr-only"> {l.item.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <NoteField value={cart.note} onChange={cart.setNote} disabled={cart.busy} />
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-4 pb-5 pt-2">
          <button type="button" disabled={cart.busy || count === 0} onClick={() => void confirm()} className={PRIMARY}>
            {cart.busy ? BRANCH_WASTE_STATES_COPY.check.loading : BRANCH_WASTE_BUTTONS.confirm}
          </button>
          <button type="button" disabled={cart.busy} onClick={() => setStep('pick')} className={cn(PHONE_SECONDARY_BUTTON, 'w-full')}>
            {BRANCH_WASTE_BUTTONS.back}
          </button>
        </div>
        {sheetEl}
      </PhoneColumn>
    );
  }

  const often = shown?.often ?? [];
  const results = shown?.items ?? [];
  const firstLoad = items.status === 'loading' && !shown;
  return (
    <PhoneColumn>
      <BranchHeader leading="back" onBack={leave} title="Log waste" subtitle={`What was thrown away · ${department}`} />
      <div ref={regionRef} tabIndex={-1} aria-label="Pick what was wasted" role="region" className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-4 pb-4 pt-4 outline-none">
        <label className="flex h-11 shrink-0 items-center gap-2 border border-wds-border bg-wds-surface px-3 focus-within:border-wds-selected-edge focus-within:shadow-wds-ring">
          <Search className="size-3 shrink-0 text-wds-neutral-500" strokeWidth={2} aria-hidden />
          <span className="sr-only">Find an item</span>
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Find an item" autoComplete="off" className="min-w-0 grow bg-transparent font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-wds-neutral-500 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none" />
        </label>

        {firstLoad ? (
          <>
            <LoadingAnnouncer text={BRANCH_WASTE_STATES_COPY.pick.loading} />
            <div className="flex flex-col gap-2" aria-hidden>
              <Skeleton className="h-3 w-24" />
              <div className="flex flex-wrap gap-2">{[112, 96, 56, 80, 56, 88].map((w, i) => <Skeleton key={i} className="h-10" style={{ width: w }} />)}</div>
            </div>
          </>
        ) : items.status === 'error' && !shown ? (
          <ScwStatePanel kind="error" phone text={BRANCH_WASTE_STATES_COPY.pick.error} onRetry={() => void items.reload()} />
        ) : q === '' ? (
          <div className="flex flex-col gap-2">
            <SectionLabel>You often log</SectionLabel>
            {often.length === 0 ? (
              <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{BRANCH_WASTE_STATES_COPY.pick.empty}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {often.map((i) => (
                  <button key={i.itemId} type="button" onClick={() => open(i)} className={cn(hitArea(40), 'border border-wds-border-strong bg-wds-surface px-3.5 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none transition-[background-color,transform] focus-visible:shadow-wds-ring active:bg-wds-neutral-100 motion-safe:active:scale-[0.98] [@media(hover:hover)]:hover:bg-wds-neutral-50')}>
                    {i.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : results.length === 0 ? (
          <p role="status" className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">No item matches. Check the spelling.</p>
        ) : (
          <ul className="flex flex-col border border-wds-border bg-wds-surface" aria-label="Matching items">
            {results.map((i) => (
              <li key={i.itemId} className="border-b border-wds-neutral-100 last:border-b-0">
                <button type="button" onClick={() => open(i)} className="flex h-14 w-full items-center justify-between gap-3 px-3.5 text-left outline-none focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100">
                  <span className="font-wds-sans text-[15px] leading-[18px] text-wds-text-ink">
                    <HighlightMatch text={i.name} term={q} />
                  </span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{i.unit}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {count > 0 ? (
          <div className="flex flex-col gap-2 pt-1.5">
            <SectionLabel>Added · {count}</SectionLabel>
            <ul className="flex flex-col gap-2">
              {cart.lines.map((l) => (
                <li key={l.item.itemId}>
                  <button type="button" data-line-id={l.item.itemId} onClick={() => open(l.item)} aria-label={`Edit ${l.item.name}, ${quantityLabel(l.quantity, l.item.unit)}, ${WASTE_REASON_TEXT[l.reason]}`} className="flex h-14 w-full items-center gap-3 border border-wds-border bg-wds-surface px-3.5 text-left outline-none focus-visible:shadow-wds-ring active:bg-wds-neutral-50">
                    <span className="flex min-w-0 grow flex-col">
                      <span className="truncate font-wds-sans text-[15px] leading-[18px] text-wds-text-ink">{l.item.name}</span>
                      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{WASTE_REASON_TEXT[l.reason]}</span>
                    </span>
                    <span className="font-wds-mono text-[16px] leading-5 text-wds-text-ink">{quantityLabel(l.quantity, l.item.unit)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-4 pb-5 pt-2">
        <button type="button" disabled={count === 0} title={count === 0 ? 'Add an item first' : undefined} onClick={() => setStep('check')} className={PRIMARY}>
          {count === 0 ? 'Review items' : BRANCH_WASTE_BUTTONS.review(count)}
        </button>
      </div>
      {sheetEl}
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Discard these items?"
        description="Nothing has been logged yet. Going back removes the items you added."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive={false}
        onConfirm={() => router.push(WASTE)}
      />
    </PhoneColumn>
  );
}

/** "NOTE · OPTIONAL": one line at first (44 high), growing to four lines, 200 characters (G19). */
function NoteField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 98)}px`;
  }, [value]);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="bw-note" className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
        Note · optional
      </label>
      <textarea
        id="bw-note"
        ref={ref}
        rows={1}
        value={value}
        maxLength={NOTE_MAX}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Anything the Branch Manager should know?"
        className="min-h-11 w-full resize-none border border-wds-border-strong bg-wds-surface px-3 py-[12px] font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-wds-neutral-500 focus:border-wds-selected-edge focus:shadow-wds-ring"
      />
    </div>
  );
}
