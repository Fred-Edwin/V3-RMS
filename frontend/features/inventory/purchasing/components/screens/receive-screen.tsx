'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Check, ImageIcon, Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui2/sheet';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { PhoneErrorNote, PhoneFieldLabel, PhoneHeader, PhonePrimaryButton, PhoneSuccessNote } from '../../../_shared/components/phone-parts';
import { StockErrorCard } from '../../../_shared/components/stock-states';
import { useOrder } from '../../hooks/use-order';
import { kes, qty as fmtQty } from '../../lib/format';
import type { FileRef, Order, OrderLine } from '../../types';
import { PurchasingError } from '../../types';
import { CompactTracker } from '../compact-tracker';
import { DemoBanner } from '../demo-banner';
import { PinDialog } from '../pin-dialog';
import { UploadingRow, UploadProblemRow, type UploadProblem } from '../photo-slot';

/**
 * Receive a delivery (Paper `12` to `14`, `30`, `31`, `33`): step 1 check the goods against the order, step 2 the supplier's
 * delivery note, a photo of it, and your PIN. Phone-first: on a desktop it is the same two steps in a phone-width column.
 * Short and not-supplied quantities are dropped from the order; a changed price must be confirmed before you can sign.
 * Money is shown only to callers who may see it (the Store Attendant sees quantities and "price changed", never figures).
 */
export function ReceiveScreen({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data: order, status, error, reload, service, can } = useOrder(orderId);
  const addToast = useWdsToastStore((s) => s.addToast);
  const showMoney = can('payables.read');
  const [step, setStep] = React.useState<1 | 2>(1);
  const [got, setGot] = React.useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = React.useState<Record<string, boolean>>({});
  const [noteNo, setNoteNo] = React.useState('');
  const [photo, setPhoto] = React.useState<FileRef | null>(null);
  const [photoState, setPhotoState] = React.useState<{ busy: boolean; name: string; percent: number; problem: UploadProblem | null }>({ busy: false, name: '', percent: 0, problem: null });
  const progress = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [done, setDone] = React.useState<Order | null>(null);
  const camera = React.useRef<HTMLInputElement>(null);
  const gallery = React.useRef<HTMLInputElement>(null);
  const lastFile = React.useRef<File | null>(null);

  const back = (): void => (step === 2 ? setStep(1) : router.push('/app/inventory/purchasing?tab=receive'));

  if (status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PhoneHeader title="Receive delivery" subtitle="We couldn't open this order" leading="back" onLeading={() => router.push('/app/inventory/purchasing?tab=receive')} />
        <div className="p-6">
          <StockErrorCard title="We couldn't open this order" description={error ?? 'Go back and try again.'} onRetry={() => void reload()} />
        </div>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PhoneHeader title="Receive delivery" subtitle="Loading the order…" leading="back" onLeading={() => router.push('/app/inventory/purchasing?tab=receive')} />
        <div className="flex flex-col gap-3 p-4" aria-busy aria-label="Loading the order">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse bg-wds-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  const received = (l: OrderLine): number => Number.parseFloat(got[l.id] ?? l.orderedQty);
  const ordered = (l: OrderLine): number => Number.parseFloat(l.orderedQty);
  const needsConfirm = order.lines.filter((l) => l.priceChanged && received(l) > 0);
  const allConfirmed = needsConfirm.every((l) => confirmed[l.id]);
  const short = order.lines.filter((l) => received(l) < ordered(l));
  const deliveredValue = order.lines.reduce((t, l) => t + received(l) * Number.parseFloat((l.priceChanged ? (l.deliveryPrice ?? l.unitPrice) : l.unitPrice) || '0'), 0);
  const orderedValue = Number.parseFloat(order.orderedTotal || '0');

  if (done) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PhoneHeader title="Delivery received" subtitle={`${done.reference} · ${done.supplier.name}`} leading="back" onLeading={() => router.push('/app/inventory/purchasing?tab=receive')} />
        <div className="flex flex-col gap-4 p-4">
          <PhoneSuccessNote title="Signed and received">
            The stock is added to the Central Store (in the demo, nothing is changed). {done.lines.filter((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED').length ? 'What was not supplied is dropped from the order. ' : ''}
            Receipt {done.delivery?.reference}.
          </PhoneSuccessNote>
          <PhonePrimaryButton asChild>
            <Link href="/app/inventory/purchasing?tab=receive">Back to orders</Link>
          </PhonePrimaryButton>
        </div>
      </div>
    );
  }

  if (!order.can.receive) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PhoneHeader title="Receive delivery" subtitle={`${order.reference} · ${order.supplier.name}`} leading="back" onLeading={() => router.push(`/app/inventory/purchasing/${order.id}`)} />
        <div className="flex flex-col gap-4 p-4">
          <PhoneErrorNote>
            {order.status === 'DELIVERED' || order.status === 'INVOICED' || order.status === 'CLOSED'
              ? 'This delivery has already been recorded.'
              : order.status === 'APPROVED' || order.status === 'SENT'
                ? 'Your role cannot record deliveries.'
                : `This order is ${order.status.toLowerCase().replace('_', ' ')}, so it cannot be received yet.`}
          </PhoneErrorNote>
          <PhonePrimaryButton asChild variant="secondary">
            <Link href={`/app/inventory/purchasing/${order.id}`}>Open the order</Link>
          </PhonePrimaryButton>
        </div>
      </div>
    );
  }

  const upload = async (file: File): Promise<void> => {
    lastFile.current = file;
    setPhotoState({ busy: true, name: file.name, percent: 8, problem: null });
    if (progress.current) clearInterval(progress.current);
    progress.current = setInterval(() => setPhotoState((s) => (s.busy ? { ...s, percent: Math.min(92, s.percent + 14) } : s)), 70);
    try {
      setPhoto(await service.upload(file));
      setPhotoState({ busy: false, name: '', percent: 0, problem: null });
    } catch (e) {
      const problem: UploadProblem = e instanceof PurchasingError && e.code === 'UPLOAD_TOO_LARGE' ? { kind: 'tooLarge', size: file.size } : e instanceof PurchasingError && e.code === 'UPLOAD_BAD_TYPE' ? { kind: 'badType' } : { kind: 'failed' };
      setPhotoState({ busy: false, name: '', percent: 0, problem });
    } finally {
      if (progress.current) clearInterval(progress.current);
    }
  };
  // A file named "fail…" is the demo's dropped connection: the retry goes through once the name no longer says so.
  const retryUpload = (): void => {
    const f = lastFile.current;
    if (f) void upload(new File([f], f.name.replace(/fail/gi, 'ok'), { type: f.type }));
  };
  const pick = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setSheetOpen(false);
    if (f) void upload(f);
  };

  const step1 = (
    <div className="flex flex-col gap-3 p-4">
      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Step 1 of 2 · Check what arrived against the order.</p>
      {order.lines.map((l) => {
        const r = received(l);
        const o = ordered(l);
        const diff = o - r;
        const priceRow = l.priceChanged && r > 0;
        return (
          <div key={l.id} className="flex flex-col gap-2.5 border border-wds-border bg-wds-surface p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-neutral-950">{l.itemName}</span>
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                  Ordered {fmtQty(l.orderedQty)} {l.buyUnit}
                  {l.supplierItemName && l.supplierItemName.toLowerCase() !== l.itemName.toLowerCase() ? ` · supplier: ${l.supplierItemName}` : ''}
                </span>
              </div>
              <span className={cn('flex shrink-0 items-center gap-1.5 font-wds-sans text-[12px]', diff > 0 ? 'text-wds-error-fg' : 'text-wds-success-fg')}>
                <span className={cn('size-1.5 rounded-full', diff > 0 ? 'bg-wds-error-fg' : 'bg-wds-success-fg')} aria-hidden />
                {diff > 0 ? (r === 0 ? 'Not supplied' : `${fmtQty(diff)} short`) : 'OK'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`One less ${l.itemName}`}
                disabled={r <= 0}
                onClick={() => setGot((p) => ({ ...p, [l.id]: String(Math.max(0, r - 1)) }))}
                className="flex size-10 shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <label className="flex h-10 grow items-center justify-center gap-1.5 border border-wds-border-strong bg-wds-surface px-2 focus-within:border-wds-primary focus-within:shadow-wds-ring">
                <input
                  inputMode="decimal"
                  value={got[l.id] ?? l.orderedQty}
                  onChange={(e) => setGot((p) => ({ ...p, [l.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                  aria-label={`Quantity of ${l.itemName} received`}
                  className="w-16 bg-transparent text-center font-wds-mono text-[18px] text-wds-neutral-950 outline-none"
                />
                <span className="font-wds-sans text-[12px] text-wds-text-secondary">{l.buyUnit} received</span>
              </label>
              <button
                type="button"
                aria-label={`One more ${l.itemName}`}
                disabled={r >= o}
                onClick={() => setGot((p) => ({ ...p, [l.id]: String(Math.min(o, r + 1)) }))}
                className="flex size-10 shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>
            {r > o ? <p className="font-wds-sans text-[12px] text-wds-error-fg">You cannot receive more than was ordered.</p> : null}
            {diff > 0 ? <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The missing {l.buyUnit === 'kg' || l.buyUnit === 'pcs' ? 'quantity' : l.buyUnit} is dropped from this order.</p> : null}
            {priceRow ? (
              <div className="flex items-center justify-between gap-3 border border-wds-warning-border bg-wds-warning-bg px-3 py-2">
                <span className="font-wds-sans text-[12px] text-wds-warning-fg">{showMoney ? `Price is ${kes(l.deliveryPrice)}, was ${kes(l.unitPrice)}` : 'The price has changed. Confirm it to continue.'}</span>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={Boolean(confirmed[l.id])}
                  onClick={() => setConfirmed((p) => ({ ...p, [l.id]: !p[l.id] }))}
                  className="flex shrink-0 items-center gap-1.5 font-wds-sans text-[12px] font-medium text-wds-neutral-950 outline-none focus-visible:shadow-wds-ring"
                >
                  <span className={cn('flex size-4 items-center justify-center border-[1.5px]', confirmed[l.id] ? 'border-wds-select-blue text-wds-select-blue' : 'border-wds-border-strong bg-white')}>
                    {confirmed[l.id] ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  Confirm
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      <PhonePrimaryButton disabled={!allConfirmed || order.lines.some((l) => received(l) > ordered(l) || Number.isNaN(received(l)))} onClick={() => setStep(2)}>
        Next: delivery note
      </PhonePrimaryButton>
      {!allConfirmed ? <p className="text-center font-wds-sans text-[12px] text-wds-text-secondary">Confirm each price change to continue.</p> : null}
    </div>
  );

  const step2 = (
    <div className="flex flex-col gap-4 p-4">
      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Step 2 of 2 · Record the supplier&apos;s delivery note.</p>
      <div className="flex flex-col gap-1.5">
        <PhoneFieldLabel htmlFor="dn-no">Delivery note number</PhoneFieldLabel>
        <input
          id="dn-no"
          value={noteNo}
          onChange={(e) => setNoteNo(e.target.value)}
          placeholder="e.g. DN-77120"
          className="h-11 border border-wds-border-strong bg-white px-3 font-wds-mono text-[16px] text-wds-neutral-950 outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <PhoneFieldLabel>Photo of the note</PhoneFieldLabel>
        {photo ? (
          <div className="flex items-center gap-3 border border-wds-border bg-wds-surface p-3">
            <span className="flex size-[72px] shrink-0 items-center justify-center bg-wds-neutral-100 text-wds-text-faint" aria-hidden>
              <ImageIcon className="size-6" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-wds-sans text-[14px] text-wds-neutral-950">{photo.fileName}</span>
              <span className="font-wds-mono text-[12px] text-wds-text-secondary">{(photo.size / 1_000_000).toFixed(1)} MB</span>
              <button type="button" onClick={() => setSheetOpen(true)} className="w-fit font-wds-sans text-[13px] font-medium text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
                Retake photo
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            disabled={photoState.busy}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 border border-dashed border-wds-border-strong bg-wds-surface-sunken px-4 py-5 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:opacity-60"
          >
            <span className="flex size-11 items-center justify-center bg-wds-neutral-100">
              <Camera className="size-5 text-wds-text-secondary" aria-hidden />
            </span>
            <span className="font-wds-sans text-[14px] font-medium text-wds-neutral-950">{photoState.busy ? 'Adding the photo…' : 'Add a photo of the note'}</span>
            <span className="font-wds-sans text-[12px] text-wds-text-secondary">Lay it flat and keep the whole page in view</span>
          </button>
        )}
        {photoState.busy ? <UploadingRow fileName={photoState.name} percent={photoState.percent} /> : null}
        {photoState.problem ? <UploadProblemRow problem={photoState.problem} onRetry={retryUpload} onChooseAnother={() => setSheetOpen(true)} /> : null}
      </div>
      <div className="flex flex-col gap-2 border border-wds-border bg-wds-surface p-3.5">
        <PhoneFieldLabel>Summary</PhoneFieldLabel>
        {showMoney ? (
          <>
            <SummaryRow label="Ordered" value={kes(orderedValue)} />
            <SummaryRow label="Delivered" value={kes(deliveredValue)} />
            {short.length ? <SummaryRow label={`${short.length} line${short.length === 1 ? '' : 's'} not fully supplied`} value={`−${kes(orderedValue - deliveredValue)}`} tone="error" /> : null}
          </>
        ) : (
          <>
            <SummaryRow label="Lines received" value={String(order.lines.filter((l) => received(l) > 0).length)} />
            {short.length ? <SummaryRow label="Short or not supplied" value={String(short.length)} tone="error" /> : null}
          </>
        )}
      </div>
      <p className="font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">When you sign, the stock is added to the Central Store and the Accountant is told the goods have arrived.</p>
      <PhonePrimaryButton disabled={!noteNo.trim() || !photo || photoState.busy} onClick={() => setPinOpen(true)}>
        Sign with PIN and receive
      </PhonePrimaryButton>
      {!noteNo.trim() || !photo ? <p className="text-center font-wds-sans text-[12px] text-wds-text-secondary">Add the delivery note number and a photo to sign.</p> : null}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-neutral-100">
      <DemoBanner />
      <div className="mx-auto flex w-full max-w-[430px] grow flex-col bg-wds-canvas shadow-wds-md">
        <PhoneHeader title="Receive delivery" subtitle={`${order.reference} · ${order.supplier.name}`} leading="back" onLeading={back} />
        <div className="border-b border-wds-border bg-wds-surface px-4 py-3">
          <CompactTracker tracker={order.tracker} />
        </div>
        {step === 1 ? step1 : step2}
      </div>

      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} aria-label="Take a photo" tabIndex={-1} />
      <input ref={gallery} type="file" accept="image/*,application/pdf" className="sr-only" onChange={pick} aria-label="Choose from gallery" tabIndex={-1} />
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-[430px] gap-0 rounded-t-wds-lg p-0">
          <div className="mx-auto mt-2 h-1 w-9 bg-wds-neutral-300" aria-hidden />
          <SheetTitle className="px-5 pb-3 pt-4 font-wds-sans text-[16px] font-semibold text-wds-neutral-950">Add a photo of the delivery note</SheetTitle>
          {[
            [Camera, 'Take photo', camera],
            [ImageIcon, 'Choose from gallery', gallery],
          ].map(([Icon, label, ref]) => {
            const I = Icon as typeof Camera;
            return (
              <button key={label as string} type="button" onClick={() => (ref as React.RefObject<HTMLInputElement>).current?.click()} className="flex h-14 items-center gap-3 border-t border-wds-border px-5 font-wds-sans text-[15px] text-wds-neutral-950 outline-none hover:bg-wds-neutral-50 focus-visible:bg-wds-neutral-50">
                <I className="size-5 text-wds-text-secondary" aria-hidden />
                {label as string}
              </button>
            );
          })}
          <button type="button" onClick={() => setSheetOpen(false)} className="h-[46px] border-t border-wds-border font-wds-sans text-[15px] font-medium text-wds-text-secondary outline-none hover:bg-wds-neutral-50 focus-visible:bg-wds-neutral-50">
            Cancel
          </button>
        </SheetContent>
      </Sheet>

      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Sign and receive"
        subtitle="Your signature goes on the receipt."
        summary={{ title: `${order.reference} · ${order.supplier.name}`, detail: `${order.lines.length} line${order.lines.length === 1 ? '' : 's'}${short.length ? ` · ${short.length} short` : ''}` }}
        confirmLabel="Sign and receive"
        onSubmit={async (pin) => {
          const result = await service.receiveOrder(order.id, {
            lines: order.lines.map((l) => ({ lineId: l.id, receivedQty: String(received(l)), priceConfirmed: Boolean(confirmed[l.id]) })),
            deliveryNoteNo: noteNo.trim(),
            deliveryNotePhotoId: photo?.id ?? null,
            pin,
          });
          setPinOpen(false);
          setDone(result);
          addToast({ variant: 'success', title: 'Delivery received', description: `${result.reference} is now waiting for its invoice.` });
        }}
      />
    </div>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'error' }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={cn('font-wds-sans text-[13px]', tone === 'error' ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>{label}</span>
      <span className={cn('font-wds-mono text-[14px]', tone === 'error' ? 'text-wds-error-fg' : 'text-wds-neutral-950')}>{value}</span>
    </div>
  );
}
