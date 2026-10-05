'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, ChevronDown, MessageCircle } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { StockErrorCard } from '../../../_shared/components/stock-states';
import { useAction } from '../../../_shared/hooks/use-async';
import { useOrder } from '../../hooks/use-order';
import { dayMonth, fullDate, kes, kes2, METHOD_LABEL, qty as fmtQty, STATUS_LABEL, whenLabel } from '../../lib/format';
import type { OrderStatus, PurchaseFile, TrackerItem } from '../../types';
import { ApproveOrderSheet } from '../approve-order-sheet';
import { CancelOrderSheet } from '../cancel-order-sheet';
import { DemoBanner } from '../demo-banner';
import { thClass } from '../parts';
import { RecordAdvanceSheet } from '../record-advance-sheet';
import { SendWhatsappDialog } from '../send-whatsapp-dialog';

const CRUMB_STAGE: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  AWAITING_APPROVAL: 'Awaiting approval',
  RETURNED: 'Returned',
  APPROVED: 'Approved',
  SENT: 'To receive',
  DELIVERED: 'Awaiting invoice',
  INVOICED: 'To pay',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const STEP_LABEL: Record<TrackerItem['step'], string> = { RAISED: 'Raised', APPROVED: 'Approved', SENT: 'Sent', DELIVERED: 'Delivered', INVOICED: 'Invoiced', PAID: 'Paid' };

const chipTone = (s: OrderStatus): string =>
  s === 'CANCELLED' ? 'border-wds-error-border bg-wds-error-bg text-wds-error-fg' : s === 'AWAITING_APPROVAL' || s === 'RETURNED' || s === 'DRAFT' ? 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg' : s === 'CLOSED' ? 'border-wds-success-border bg-wds-success-bg text-wds-success-fg' : 'border-wds-info-border bg-wds-info-bg text-wds-info-fg';

function trackerNote(t: TrackerItem, o: PurchaseFile): string {
  if (t.step === 'RAISED') return dayMonth(t.at);
  if (t.step === 'APPROVED') return t.state === 'DONE' ? `${dayMonth(t.at)} · PIN` : '—';
  if (t.step === 'SENT') return t.state === 'DONE' ? `${dayMonth(t.at)}${t.note ? ` · ${t.note}` : ''}` : o.status === 'APPROVED' ? 'Ready to send' : '—';
  if (t.step === 'DELIVERED') return t.state === 'DONE' ? `${dayMonth(t.at)}${t.note ? ` · 1 ${t.note}` : ''}`.replace('· 1 short', '· short') : o.expectedDate ? `Expected ${dayMonth(o.expectedDate)}` : '—';
  if (t.step === 'INVOICED') return o.status === 'DELIVERED' ? 'Waiting for invoice' : '—';
  if (t.step === 'PAID') return o.money && Number.parseFloat(o.money.paid) > 0 ? `${kes(o.money.paid)} advance` : '—';
  return '—';
}

/**
 * The purchase file (Paper `07`, `15`, `22`): one page that holds the whole purchase and changes with its state. The header, stage
 * tracker, money strip, next-step card, items and the right rail are the same in every state; the buttons come from `order.can`
 * (the permissions table), so a reader sees the same page with the write buttons hidden.
 */
export function PurchaseFileScreen({ orderId }: { orderId: string }) {
  const { data: order, status, error, reload, service, can } = useOrder(orderId);
  const addToast = useWdsToastStore((s) => s.addToast);
  const [tab, setTab] = React.useState<'items' | 'documents' | 'activity'>('items');
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [waOpen, setWaOpen] = React.useState(false);
  const [advanceOpen, setAdvanceOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [photoOpen, setPhotoOpen] = React.useState(false);

  const mark = useAction(async (via: 'PRINT' | 'LINK' | 'MANUAL') => {
    const o = await service.sendOrder(orderId, via);
    return o;
  }, 'We could not mark the order as sent. Try again.');

  const crumb = { section: 'Purchasing', screen: order ? `${CRUMB_STAGE[order.status]} / ${order.reference ?? 'Draft'}` : 'Order', sectionHref: '/app/inventory/purchasing' };

  if (status === 'error') {
    return (
      <>
        <Topbar breadcrumb={crumb} hideSearch className="shrink-0" />
        <div className="p-8">
          <StockErrorCard title="We couldn't open this order" description={error ?? 'It may have been removed. Go back to Purchasing and try again.'} onRetry={() => void reload()} />
        </div>
      </>
    );
  }
  if (!order) {
    return (
      <>
        <Topbar breadcrumb={crumb} hideSearch className="shrink-0" />
        <DemoBanner />
        <div className="flex flex-col gap-4 p-8" aria-busy aria-label="Loading the order">
          <div className="h-8 w-1/3 animate-pulse rounded bg-wds-neutral-100" />
          <div className="h-16 animate-pulse rounded bg-wds-neutral-100" />
          <div className="h-40 animate-pulse rounded bg-wds-neutral-100" />
        </div>
      </>
    );
  }

  const showMoney = order.money !== null;
  const delivered = order.delivery !== null;
  const advances = order.payments.filter((p) => p.kind === 'ADVANCE' && p.status === 'RECORDED');
  const sendNow = async (via: 'PRINT' | 'LINK'): Promise<void> => {
    if (via === 'PRINT') window.open(`/app/inventory/purchasing-print/${order.id}`, '_blank', 'noopener');
    if (via === 'LINK') {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/app/inventory/purchasing-print/${order.id}`);
      } catch {
        // Clipboard blocked: the order is still marked sent and the link is on the print page.
      }
    }
    const done = await mark.run(via);
    if (done) addToast({ variant: 'success', title: via === 'LINK' ? 'Link copied' : 'Opened for printing', description: `${order.reference} is marked as sent.` });
  };

  const moneyCells: Array<[string, string]> = [
    ['Ordered', order.money?.ordered ?? ''],
    ['Delivered', order.money?.delivered ?? ''],
    ['Invoiced', order.money?.invoiced ?? ''],
    ['Paid', order.money && Number.parseFloat(order.money.paid) > 0 ? order.money.paid : ''],
    [delivered ? 'Still to pay (est.)' : 'Still to pay (est.)', order.money?.stillToPay ?? ''],
  ];

  return (
    <>
      <Topbar
        breadcrumb={crumb}
        hideSearch
        className="shrink-0"
        actions={
          <>
            {order.reference && order.approvedBy ? (
              <Button variant="secondary" asChild>
                <Link href={`/app/inventory/purchasing-print/${order.id}`} target="_blank">
                  Print LPO
                </Link>
              </Button>
            ) : null}
            {order.can.send || order.can.cancel ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    More <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  {order.can.send ? (
                    <>
                      <DropdownMenuItem onSelect={() => void sendNow('LINK')}>Copy link</DropdownMenuItem>
                      {order.status === 'APPROVED' ? <DropdownMenuItem onSelect={() => void mark.run('MANUAL')}>Mark as sent (phoned in)</DropdownMenuItem> : null}
                    </>
                  ) : null}
                  {order.can.cancel ? (
                    <>
                      {order.can.send ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem onSelect={() => setCancelOpen(true)} className="text-wds-error-fg">
                        Cancel order
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />
      <DemoBanner />
      <div className="flex min-h-0 flex-1 gap-8 overflow-y-auto px-8 py-7">
        <div className="flex min-w-0 grow basis-0 flex-col gap-6" style={{ maxWidth: 816 }}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <h1 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-neutral-950">{order.supplier.name}</h1>
              <span className={cn('rounded-[2px] border px-2 py-0.5 font-wds-sans text-[11px] font-medium', chipTone(order.status))}>{STATUS_LABEL[order.status]}</span>
            </div>
            <p className="font-wds-sans text-wds-body-sm text-wds-text-secondary">
              {order.reference ?? 'Draft'} · Raised by {order.raisedBy.name}
              {order.approvedBy ? ` · approved by ${order.approvedBy.name}` : ''}
            </p>
          </div>

          {mark.failure ? (
            <div role="alert" className="rounded-wds-md border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-wds-caption text-wds-error-fg">
              {mark.failure.message}
            </div>
          ) : null}

          <ol className="flex" aria-label="Stages">
            {order.tracker.map((t, i) => (
              <li key={t.step} className={cn('flex flex-col gap-2', i < order.tracker.length - 1 ? 'grow basis-0' : 'w-[110px] shrink-0')}>
                <span className="flex items-center">
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                      t.state === 'DONE' ? 'border-wds-success-fg bg-wds-success-fg text-white' : t.state === 'CURRENT' ? 'border-wds-primary bg-wds-surface' : 'border-wds-neutral-300 bg-wds-surface'
                    )}
                  >
                    {t.state === 'DONE' ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
                  </span>
                  {i < order.tracker.length - 1 ? <span className={cn('mx-1 h-0.5 grow', t.state === 'DONE' ? 'bg-wds-success-fg' : 'bg-wds-neutral-300')} /> : null}
                </span>
                <span className="flex flex-col">
                  <span className={cn('font-wds-sans text-wds-body-sm', t.state === 'TODO' ? 'text-wds-text-secondary' : 'font-medium text-wds-neutral-950')}>{STEP_LABEL[t.step]}</span>
                  <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{trackerNote(t, order)}</span>
                </span>
              </li>
            ))}
          </ol>

          {showMoney ? (
            <dl className="grid grid-cols-5 divide-x divide-wds-border rounded-wds-md border border-wds-border bg-wds-surface">
              {moneyCells.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1 px-4 py-3">
                  <dt className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{k}</dt>
                  <dd className="font-wds-mono text-wds-section text-wds-neutral-950">{v === '' ? '—' : kes(v)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <NextStep
            order={order}
            canReceive={can('orders.receive')}
            onApprove={() => setApproveOpen(true)}
            onWhatsapp={() => setWaOpen(true)}
            onPrint={() => void sendNow('PRINT')}
            onCopy={() => void sendNow('LINK')}
            onAdvance={() => setAdvanceOpen(true)}
            onInvoice={() => addToast({ variant: 'info', title: 'Adding the invoice comes in the next build', description: 'The invoice drawer is part of Session 2.' })}
            busy={mark.saving}
          />

          <div className="flex flex-col">
            <div role="tablist" className="flex gap-6 border-b border-wds-border">
              {(
                [
                  ['items', 'Items'],
                  ['documents', `Documents${order.documents.length ? ` ${order.documents.length}` : ''}`],
                  ['activity', 'Activity'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={cn(
                    '-mb-px border-b-2 pb-2.5 font-wds-sans text-wds-body-sm outline-none transition-colors focus-visible:shadow-wds-ring',
                    tab === k ? 'border-wds-primary font-semibold text-wds-neutral-950' : 'border-transparent text-wds-text-secondary hover:text-wds-neutral-950'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'items' ? (
              <div className="flex flex-col">
                <div className="flex h-[30px] items-center gap-4 border-b border-wds-neutral-950">
                  <span className={cn(thClass, 'grow')}>Item</span>
                  {delivered ? (
                    <>
                      <span className={cn(thClass, 'w-[90px] shrink-0')}>Ordered</span>
                      <span className={cn(thClass, 'w-[90px] shrink-0')}>Delivered</span>
                    </>
                  ) : (
                    <span className={cn(thClass, 'w-[120px] shrink-0')}>Qty</span>
                  )}
                  {showMoney ? <span className={cn(thClass, 'w-[100px] shrink-0 text-right')}>Price</span> : null}
                  {delivered ? <span className={cn(thClass, 'w-[170px] shrink-0')}>Result</span> : showMoney ? <span className={cn(thClass, 'w-[120px] shrink-0 text-right')}>Total</span> : null}
                </div>
                {order.lines.map((l) => (
                  <div key={l.id} className="flex min-h-12 items-center gap-4 border-b border-wds-neutral-100 py-2">
                    <div className="flex min-w-0 grow flex-col gap-0.5">
                      <span className="truncate font-wds-sans text-wds-body-sm text-wds-neutral-950">{l.itemName}</span>
                      {l.supplierItemName ? (
                        <span className="truncate font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">
                          {order.supplier.name.split(' ')[0]}: {l.supplierItemName}
                          {l.supplierItemCode ? ` · ${l.supplierItemCode}` : ''}
                        </span>
                      ) : null}
                    </div>
                    {delivered ? (
                      <>
                        <span className="w-[90px] shrink-0 font-wds-mono text-wds-caption text-wds-text-secondary">
                          {fmtQty(l.orderedQty)} {l.buyUnit}
                        </span>
                        <span className="w-[90px] shrink-0 font-wds-mono text-wds-caption text-wds-neutral-950">
                          {fmtQty(l.receivedQty)} {l.buyUnit}
                        </span>
                      </>
                    ) : (
                      <span className="w-[120px] shrink-0 font-wds-mono text-wds-caption text-wds-neutral-950">
                        {fmtQty(l.orderedQty)} {l.buyUnit}
                      </span>
                    )}
                    {showMoney ? <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-secondary">{kes(l.confirmedPrice ?? l.unitPrice)}</span> : null}
                    {delivered ? (
                      <span className="flex w-[170px] shrink-0 items-center gap-1.5">
                        <span className={cn('size-1.5 shrink-0 rounded-full', l.result === 'AS_ORDERED' ? 'bg-wds-success-fg' : l.result === 'PRICE_CHANGED' ? 'bg-wds-warning-fg' : 'bg-wds-error-fg')} aria-hidden />
                        <span className="font-wds-sans text-wds-caption text-wds-neutral-950">
                          {l.result === 'AS_ORDERED'
                            ? 'As ordered'
                            : l.result === 'PRICE_CHANGED'
                              ? showMoney
                                ? `Price up ${kes(Number.parseFloat(l.confirmedPrice ?? '0') - Number.parseFloat(l.unitPrice))} (was ${kes(l.unitPrice)})`
                                : 'Price changed'
                              : l.result === 'NOT_SUPPLIED'
                                ? 'Not supplied'
                                : `${fmtQty(Number.parseFloat(l.orderedQty) - Number.parseFloat(l.receivedQty ?? '0'))} ${l.buyUnit} not supplied`}
                        </span>
                      </span>
                    ) : showMoney ? (
                      <span className="w-[120px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-neutral-950">{kes(l.lineTotal)}</span>
                    ) : null}
                  </div>
                ))}
                {showMoney ? (
                  <div className="flex h-12 items-center justify-between">
                    <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Order total</span>
                    <span className="font-wds-mono text-wds-section font-medium text-wds-neutral-950">KES {kes2(order.orderedTotal)}</span>
                  </div>
                ) : null}
                {delivered ? <p className="pt-2 font-wds-sans text-wds-caption text-wds-text-secondary">Anything not supplied is dropped from the order, as agreed with the supplier.</p> : null}
              </div>
            ) : tab === 'documents' ? (
              order.documents.length === 0 ? (
                <p className="py-6 font-wds-sans text-wds-body-sm text-wds-text-secondary">No documents yet. The LPO appears here once the order is approved.</p>
              ) : (
                <ul className="flex flex-col">
                  {order.documents.map((d) => (
                    <li key={`${d.kind}-${d.at}`} className="flex items-center gap-3 border-b border-wds-neutral-100 py-3">
                      <span className="flex h-8 w-6 items-center justify-center rounded-[2px] bg-wds-neutral-100 font-wds-mono text-[8px] text-wds-text-secondary">{d.kind === 'LPO' ? 'PDF' : 'IMG'}</span>
                      <span className="grow font-wds-sans text-wds-body-sm text-wds-neutral-950">{d.title}</span>
                      <span className="font-wds-mono text-wds-caption text-wds-text-secondary">{whenLabel(d.at)}</span>
                      {d.kind === 'LPO' ? (
                        <Link href={`/app/inventory/purchasing-print/${order.id}`} target="_blank" className="font-wds-sans text-wds-caption text-wds-primary hover:underline">
                          Open
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : order.activity.length === 0 ? (
              <p className="py-6 font-wds-sans text-wds-body-sm text-wds-text-secondary">Nothing has happened on this order yet.</p>
            ) : (
              <ul className="flex flex-col">
                {order.activity.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="flex items-baseline gap-3 border-b border-wds-neutral-100 py-3">
                    <span className="w-28 shrink-0 font-wds-mono text-wds-caption text-wds-text-secondary">{whenLabel(a.at)}</span>
                    <span className="font-wds-sans text-wds-body-sm text-wds-neutral-950">
                      <span className="font-medium">{a.actor.name}</span> {a.what}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="flex w-[332px] shrink-0 flex-col gap-4 self-start">
          {order.delivery ? (
            <section className="flex flex-col gap-3 rounded-wds-md border border-wds-border bg-wds-surface p-4" aria-label="Delivery">
              <h2 className="font-wds-sans text-wds-body-sm font-semibold text-wds-neutral-950">Delivery</h2>
              <Field label="Delivery note" value={order.delivery.deliveryNoteNo} mono />
              <Field label="Received by" value={`${order.delivery.receivedBy.role} · ${whenLabel(order.delivery.receivedAt)}`} />
              {order.delivery.photo ? (
                <div className="flex items-center gap-3 rounded-wds-sm border border-wds-border px-3 py-2">
                  <span className="size-8 shrink-0 rounded-[2px] bg-wds-neutral-100" aria-hidden />
                  <span className="grow font-wds-sans text-wds-caption text-wds-neutral-950">Delivery note photo</span>
                  <button type="button" onClick={() => setPhotoOpen((o) => !o)} className="font-wds-sans text-wds-caption text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
                    {photoOpen ? 'Hide' : 'View'}
                  </button>
                </div>
              ) : null}
              {photoOpen && order.delivery.photo ? (
                <p className="font-wds-mono text-[11px] text-wds-text-secondary">
                  {order.delivery.photo.fileName} · {(order.delivery.photo.size / 1_000_000).toFixed(1)} MB (the demo does not keep the picture)
                </p>
              ) : null}
            </section>
          ) : (
            <section className="flex flex-col gap-3 rounded-wds-md border border-wds-border bg-wds-surface p-4" aria-label="Supplier">
              <h2 className="font-wds-sans text-wds-body-sm font-semibold text-wds-neutral-950">Supplier</h2>
              <Field label="Contact" value={order.supplier.contactName ?? '—'} />
              <Field label="WhatsApp" value={order.supplier.whatsapp ?? '—'} mono />
              <Field label="Expected delivery" value={`${order.expectedDate ? fullDate(order.expectedDate) : 'Not set'}${order.supplier.termsDays ? ` · Invoice, ${order.supplier.termsDays} days` : ''}`} />
            </section>
          )}

          {showMoney ? (
            <section className="flex flex-col gap-3 rounded-wds-md border border-wds-border bg-wds-surface p-4" aria-label="Payments">
              <div className="flex items-center justify-between">
                <h2 className="font-wds-sans text-wds-body-sm font-semibold text-wds-neutral-950">Payments</h2>
                {order.can.recordDeposit ? (
                  <button type="button" onClick={() => setAdvanceOpen(true)} className="font-wds-sans text-wds-caption text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
                    Record advance
                  </button>
                ) : null}
              </div>
              {order.payments.length === 0 ? (
                <p className="font-wds-sans text-wds-caption text-wds-text-secondary">No payments yet. An advance can be recorded any time and comes off the invoice automatically.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex flex-col gap-0.5">
                      <div className="flex items-baseline justify-between">
                        <span className="font-wds-sans text-wds-body-sm text-wds-neutral-950">{p.kind === 'ADVANCE' ? 'Advance' : p.kind === 'REVERSAL' ? 'Reversal' : 'Payment'}</span>
                        <span className="font-wds-mono text-wds-body-sm text-wds-neutral-950">{kes(p.amount)}</span>
                      </div>
                      <span className="font-wds-sans text-[11px] text-wds-text-secondary">
                        {dayMonth(p.paidOn)} · {p.method === 'CHEQUE' ? `Cheque ${p.chequeNo ?? ''}` : METHOD_LABEL[p.method]}
                        {p.methodRef ? ` ${p.methodRef}` : ''} · {p.recordedBy.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {advances.length > 0 && !delivered ? <p className="font-wds-sans text-[11px] text-wds-text-secondary">Applied to the invoice when you add it. Any amount left over stays as credit with the supplier.</p> : null}
            </section>
          ) : null}
        </aside>
      </div>

      <ApproveOrderSheet orderId={approveOpen ? order.id : null} onClose={() => setApproveOpen(false)} />
      <SendWhatsappDialog order={order} open={waOpen} onOpenChange={setWaOpen} />
      <RecordAdvanceSheet order={order} open={advanceOpen} onOpenChange={setAdvanceOpen} />
      <CancelOrderSheet order={order} open={cancelOpen} onOpenChange={setCancelOpen} />
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{label}</span>
      <span className={cn('text-wds-body-sm text-wds-neutral-950', mono ? 'font-wds-mono' : 'font-wds-sans')}>{value}</span>
    </div>
  );
}

/** The "Next step" card: what to do now, and the buttons for whoever may do it. Readers see the same words with no buttons. */
function NextStep({
  order,
  canReceive,
  onApprove,
  onWhatsapp,
  onPrint,
  onCopy,
  onAdvance,
  onInvoice,
  busy,
}: {
  order: PurchaseFile;
  canReceive: boolean;
  onApprove: () => void;
  onWhatsapp: () => void;
  onPrint: () => void;
  onCopy: () => void;
  onAdvance: () => void;
  onInvoice: () => void;
  busy: boolean;
}) {
  const supplier = order.supplier.name.split(' ')[0];
  let title = '';
  let body = '';
  let actions: React.ReactNode = null;
  switch (order.status) {
    case 'DRAFT':
      title = 'Finish this order';
      body = 'It is saved but not sent to anyone. Add what is missing, then send it for approval.';
      actions = order.can.edit ? (
        <Button asChild>
          <Link href={`/app/inventory/purchasing/new?edit=${order.id}`}>Edit and send</Link>
        </Button>
      ) : null;
      break;
    case 'AWAITING_APPROVAL':
      title = order.can.approve ? 'Approve this order' : 'Waiting for the Store Manager to approve';
      body = order.can.approve ? `Read it through, then approve with your PIN or send it back with a note. Raised by ${order.raisedBy.name}.` : 'The Store Manager approves it with a PIN. There is nothing for you to do until then.';
      actions = order.can.approve ? <Button onClick={onApprove}>Review and approve</Button> : null;
      break;
    case 'RETURNED':
      title = 'Sent back with a note';
      body = order.returnedNote ?? '';
      actions = order.can.edit ? (
        <Button asChild>
          <Link href={`/app/inventory/purchasing/new?edit=${order.id}`}>Edit and send again</Link>
        </Button>
      ) : null;
      break;
    case 'APPROVED':
      title = `Send the order to ${supplier}`;
      body = 'Send it on WhatsApp, or print it. Sending marks it Sent.';
      actions = order.can.send ? (
        <>
          <Button onClick={onWhatsapp} disabled={busy}>
            <MessageCircle /> Send on WhatsApp
          </Button>
          <Button variant="secondary" onClick={onPrint} disabled={busy}>
            Print
          </Button>
          <Button variant="secondary" onClick={onCopy} disabled={busy}>
            Copy link
          </Button>
        </>
      ) : null;
      break;
    case 'SENT':
      title = order.dueLabel === 'OVERDUE' ? `${supplier} is late` : `Waiting for ${supplier}'s delivery`;
      body = order.expectedDate ? `Expected ${fullDate(order.expectedDate)}. When the goods arrive, check them against the order and sign for them.` : 'When the goods arrive, check them against the order and sign for them.';
      actions = (
        <>
          {order.can.receive || canReceive ? (
            <Button asChild>
              <Link href={`/app/inventory/receiving/${order.id}`}>Receive delivery</Link>
            </Button>
          ) : null}
          {order.can.recordDeposit ? (
            <Button variant="secondary" onClick={onAdvance}>
              Record advance
            </Button>
          ) : null}
        </>
      );
      break;
    case 'DELIVERED':
      title = "Add the supplier's invoice";
      body = order.payments.some((p) => p.kind === 'ADVANCE') ? `The advance of KES ${kes(order.payments.filter((p) => p.kind === 'ADVANCE').reduce((t, p) => t + Number.parseFloat(p.amount), 0))} will be taken off automatically.` : 'One invoice per order. Add it with a photo of the invoice.';
      actions = order.can.addInvoice ? <Button onClick={onInvoice}>Add invoice</Button> : null;
      break;
    case 'INVOICED':
      title = 'Waiting to be paid';
      body = 'The Accountant records the payment.';
      break;
    case 'CLOSED':
      title = 'Paid in full';
      body = 'Everyone can open this file. Nothing further to do.';
      break;
    case 'CANCELLED':
      title = 'Cancelled';
      body = order.cancelled ? `${order.cancelled.by.name} cancelled it${order.cancelled.note ? `: ${order.cancelled.note}` : '.'} Nothing is deleted.` : 'It stays on record.';
      break;
  }
  return (
    <section className="flex items-center gap-6 rounded-wds-md border border-wds-border bg-wds-surface-sunken px-5 py-4" aria-label="Next step">
      <div className="flex min-w-0 grow flex-col gap-1">
        <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Next step</span>
        <span className="font-wds-sans text-wds-section font-semibold text-wds-neutral-950">{title}</span>
        <span className="font-wds-sans text-wds-caption text-wds-text-secondary">{body}</span>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </section>
  );
}
