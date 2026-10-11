'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { useAction } from '../../../_shared/hooks/use-async';
import { useAttendantData } from '../../hooks/use-attendant';
import type { PurchaseFile } from '../../types';
import type { CollectedByInput, CollectorOptions } from '../../types/attendant';
import { OrderFrame, OrderedItems, orderSubtitle, useFailureToast } from './order-parts';
import { Banner, Label, PhoneBar, PhoneError, PrimaryButton, SecondaryButton, WriteError, roleText, timeHmm, withRole } from './phone-kit';

const KIND_WORD: Record<'PERSON' | 'VEHICLE' | 'COMPANY', string> = { PERSON: 'Person', VEHICLE: 'Vehicle', COMPANY: 'Company' };

type Choice = { key: string; input: CollectedByInput; staffLabel?: string };

/** What the order already says about who is getting it, as a choice. */
function initialChoice(order: PurchaseFile): Choice | null {
  const by = order.collectedBy;
  if (!by) return null;
  if (by.kind === 'SUPPLIER_DELIVERS') return { key: 'supplier', input: { kind: 'SUPPLIER_DELIVERS' } };
  if (by.kind === 'CARRIER' && by.carrierId) return { key: `carrier:${by.carrierId}`, input: { kind: 'CARRIER', carrierId: by.carrierId } };
  if (by.kind === 'STAFF' && by.userId) return { key: 'staff', input: { kind: 'STAFF', userId: by.userId }, staffLabel: by.label };
  return { key: 'other', input: { kind: 'OTHER', name: by.label } };
}

const RADIO_ROW = 'flex cursor-pointer items-center gap-3 px-3.5 py-[11px] outline-none peer-focus-visible:shadow-none';

function RadioRow({ checked, onSelect, title, line, trailing }: { checked: boolean; onSelect: () => void; title: string; line?: string; trailing?: React.ReactNode }) {
  return (
    <label className={cn(RADIO_ROW, 'relative border-b border-wds-border last:border-b-0 focus-within:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)]', checked && 'bg-wds-espresso-50')}>
      <input type="radio" name="collector" checked={checked} onChange={onSelect} className="peer sr-only" />
      <span aria-hidden="true" className={cn('box-border flex size-[18px] shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-[var(--wds-primary-btn-start)]' : 'border-wds-border-strong')}>
        {checked ? <span className="size-2 rounded-full bg-[var(--wds-primary-btn-start)]" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('font-wds-sans text-[14px] leading-[18px] text-wds-text-ink', checked ? 'font-medium' : 'font-normal')}>{title}</span>
        {line ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{line}</span> : null}
      </span>
      {trailing}
    </label>
  );
}

function StaffSheet({ open, onOpenChange, staff, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; staff: CollectorOptions['staff']; onPick: (s: CollectorOptions['staff'][number]) => void }) {
  const [text, setText] = React.useState('');
  const shown = staff.filter((s) => !text.trim() || s.name.toLowerCase().includes(text.trim().toLowerCase()));
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} label="Choose a staff member" className="flex max-h-[80dvh] flex-col gap-3 border-t border-wds-border-strong bg-wds-surface px-5 pb-7 pt-3">
      <SheetGrabber />
      <Label small>CHOOSE A STAFF MEMBER</Label>
      <input type="search" aria-label="Search staff" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by name" className="h-11 w-full border border-wds-border-strong bg-white px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-wds-text-faint focus-visible:border-[var(--wds-primary-btn-start)] focus-visible:shadow-wds-ring" />
      <ul className="min-h-0 overflow-y-auto border border-wds-border">
        {shown.length === 0 ? <li className="px-3.5 py-4 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No one by that name.</li> : null}
        {shown.map((s) => (
          <li key={s.id} className="border-b border-wds-border last:border-b-0">
            <button type="button" onClick={() => onPick(s)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)]">
              <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{s.name}</span>
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{roleText(s.role)}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

const PrinterIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z" />
  </svg>
);
const ShareIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V3M7 8l5-5 5 5M5 14v6h14v-6" />
  </svg>
);

/** 28D: approved. Print or share the LPO, say who is getting it, then mark it as sent. */
export function ApprovedOrder({ order }: { order: PurchaseFile }) {
  const addToast = useWdsToastStore((s) => s.addToast);
  const { data: collectors, status, error, reload, service } = useAttendantData('attendant:collectors', (s) => s.getCollectors(), 'We could not load the list of who can collect.');
  const [choice, setChoice] = React.useState<Choice | null>(() => initialChoice(order));
  const [touched, setTouched] = React.useState(false);
  const [otherName, setOtherName] = React.useState(order.collectedBy?.kind === 'OTHER' ? order.collectedBy.label : '');
  const [picker, setPicker] = React.useState(false);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const failToast = useFailureToast();
  const send = useAction((collected: CollectedByInput | undefined) => failToast('We could not mark this order as sent', () => service.sendOrder(order.id, 'MANUAL', collected))(), 'We could not mark this order as sent. Nothing was changed.');

  const pick = (next: Choice): void => {
    setTouched(true);
    setChoice(next);
  };
  const otherReady = choice?.key !== 'other' || otherName.trim().length > 0;
  const ready = choice !== null && otherReady;
  const printUrl = `/app/inventory/purchasing-print/${order.id}`;

  const onSend = async (): Promise<void> => {
    if (!choice || !ready) return;
    const collected: CollectedByInput | undefined = !touched ? undefined : choice.key === 'other' ? { kind: 'OTHER', name: otherName.trim() } : choice.input;
    const done = await send.run(collected);
    if (done) addToast({ variant: 'success', title: 'Marked as sent', description: `${order.reference ?? 'The order'} is with ${order.supplier.name}.` });
  };

  const onShare = async (): Promise<void> => {
    setShareError(null);
    try {
      const w = await service.getWhatsapp(order.id);
      const url = `${window.location.origin}${printUrl}`;
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${order.reference ?? 'LPO'} to ${order.supplier.name}`, text: w.message, url });
      } else if (w.phone) {
        window.open(`https://wa.me/${w.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`${w.message}\n${url}`)}`, '_blank', 'noopener,noreferrer');
      } else {
        setShareError(`There is no WhatsApp number for ${order.supplier.name}. Print the LPO instead.`);
      }
    } catch (e) {
      // Closing the share sheet is not a failure.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setShareError(e instanceof Error ? e.message : 'We could not share the LPO.');
    }
  };

  const setBy = order.collectedBy?.setBy;
  return (
    <OrderFrame
      order={order}
      subtitle={orderSubtitle(order)}
      bar={
        <PhoneBar>
          {send.failure ? <WriteError>{send.failure.message}</WriteError> : null}
          <PrimaryButton onClick={() => void onSend()} disabled={!ready || send.saving || !order.can.send} aria-busy={send.saving}>
            {send.saving ? 'Marking as sent…' : 'Mark as sent'}
          </PrimaryButton>
        </PhoneBar>
      }
    >
      <Banner tone="success" title={`${withRole(order.approvedBy)} approved this at ${timeHmm(order.approvedBy?.signedAt)}`}>
        Print the LPO or share it, hand it to whoever is going, then mark it as sent.
      </Banner>
      <div className="flex gap-2.5">
        <SecondaryButton size="bar" href={printUrl} className="h-11 flex-1 gap-2 text-[13px] leading-4">
          {PrinterIcon}
          Print LPO
        </SecondaryButton>
        <SecondaryButton size="bar" onClick={() => void onShare()} className="h-11 flex-1 gap-2 text-[13px] leading-4">
          {ShareIcon}
          Share PDF
        </SecondaryButton>
      </div>
      {shareError ? <WriteError>{shareError}</WriteError> : null}

      <section aria-labelledby="who-getting" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label id="who-getting">WHO IS GETTING IT?</Label>
          {setBy && !touched ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Set by {withRole(setBy)}</span> : null}
        </div>
        {status === 'error' ? <PhoneError onRetry={() => void reload()} message={error} /> : null}
        <div role="radiogroup" aria-labelledby="who-getting" className="rounded-[4px] border border-wds-border bg-white">
          <RadioRow checked={choice?.key === 'supplier'} onSelect={() => pick({ key: 'supplier', input: { kind: 'SUPPLIER_DELIVERS' } })} title="Supplier delivers" line="no one from us" />
          {collectors && collectors.carriers.length > 0 ? (
            <>
              <p className="px-3.5 pb-1 pt-2 font-mono font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">OUR CARRIERS</p>
              {collectors.carriers.map((c) => (
                <RadioRow key={c.id} checked={choice?.key === `carrier:${c.id}`} onSelect={() => pick({ key: `carrier:${c.id}`, input: { kind: 'CARRIER', carrierId: c.id } })} title={c.name} line={KIND_WORD[c.kind]} />
              ))}
            </>
          ) : null}
          <RadioRow
            checked={choice?.key === 'staff'}
            onSelect={() => setPicker(true)}
            title="A staff member"
            line={choice?.key === 'staff' ? choice.staffLabel : undefined}
            trailing={
              <button type="button" onClick={() => setPicker(true)} className="-my-3 flex min-h-11 shrink-0 items-center font-wds-sans text-[13px] leading-4 text-[var(--wds-primary-btn-start)] outline-none focus-visible:shadow-wds-ring">
                {choice?.key === 'staff' ? 'Change ›' : 'Search ›'}
              </button>
            }
          />
          <div className={cn('border-b-0 pb-3', choice?.key === 'other' && 'bg-wds-espresso-50')}>
            <RadioRow checked={choice?.key === 'other'} onSelect={() => pick({ key: 'other', input: { kind: 'OTHER', name: otherName } })} title="Someone else" />
            <input
              type="text"
              aria-label="Name of the person collecting"
              value={otherName}
              maxLength={80}
              onFocus={() => pick({ key: 'other', input: { kind: 'OTHER', name: otherName } })}
              onChange={(e) => {
                setOtherName(e.target.value);
                pick({ key: 'other', input: { kind: 'OTHER', name: e.target.value } });
              }}
              placeholder="Write a name"
              className="ml-[30px] mr-3.5 box-border h-9 w-[calc(100%-44px)] border border-wds-border-strong bg-white px-2.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none placeholder:text-wds-text-faint focus-visible:border-[var(--wds-primary-btn-start)] focus-visible:shadow-wds-ring"
            />
          </div>
        </div>
      </section>

      <OrderedItems order={order} />
      <StaffSheet
        open={picker}
        onOpenChange={setPicker}
        staff={collectors?.staff ?? []}
        onPick={(s) => {
          pick({ key: 'staff', input: { kind: 'STAFF', userId: s.id }, staffLabel: `${s.name} (${roleText(s.role)})` });
          setPicker(false);
        }}
      />
    </OrderFrame>
  );
}
