'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { Checkbox } from '@/components/ui2/checkbox';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { SearchInput } from '@/components/ui2/search-input';
import { Textarea } from '@/components/ui2/textarea';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { FormErrorBanner, StockEmptyCard, StockErrorCard } from '../../../_shared/components/stock-states';
import { useAction, useLoader } from '../../../_shared/hooks/use-async';
import { useUnsavedChangesGuard } from '../../../_shared/hooks/use-unsaved-changes-guard';
import { usePurchasing } from '../../hooks/use-purchasing';
import { isoDay, kes, kes2, qty as fmtQty } from '../../lib/format';
import { errorDetails, isPurchasingError, type CatalogItem, type CatalogResult, type Order } from '../../types';
import { PinDialog } from '../pin-dialog';
import { DotLabel, FieldLabel, SegmentedToggle, thClass } from '../parts';

type Filter = 'low' | 'all' | 'selected';

const addDays = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

/**
 * New order from the supplier's catalog (Paper `03`). Tick what you need, set quantities, pick the delivery date, then send
 * for approval (anyone who raises) or approve and send (anyone who approves). Also edits a draft or an order the manager
 * returned (`?edit=`): the same screen with the manager's note on top.
 */
export function NewOrderScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('edit');
  const { service, can, role, ready } = usePurchasing();
  const addToast = useWdsToastStore((s) => s.addToast);
  const showPrices = can('catalog.see_costs');
  const canApprove = can('orders.approve');

  const [supplierId, setSupplierId] = React.useState<string>(params.get('supplier') ?? '');
  const [lines, setLines] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      (params.get('lines') ?? '')
        .split(',')
        .filter(Boolean)
        .map((p) => p.split(':') as [string, string])
    )
  );
  const [date, setDate] = React.useState<string>(addDays(1));
  const [note, setNote] = React.useState('');
  const [attNote, setAttNote] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('low');
  const [search, setSearch] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [openOrder, setOpenOrder] = React.useState<{ id: string; reference: string | null } | null>(null);
  const [changing, setChanging] = React.useState(false);
  const guard = useUnsavedChangesGuard(dirty);
  const touch = (): void => setDirty(true);

  // Editing an existing draft or returned order: load it once and fill the form.
  const existing = useLoader<Order>(editId && ready ? `edit:${editId}` : null, () => service.getOrder(editId as string), 'We could not load this order.');
  const filled = React.useRef(false);
  React.useEffect(() => {
    const o = existing.data;
    if (!o || filled.current) return;
    filled.current = true;
    setSupplierId(o.supplier.id);
    setLines(Object.fromEntries(o.lines.map((l) => [l.inventoryItemId, l.orderedQty])));
    if (o.expectedDate) setDate(o.expectedDate);
    setNote(o.supplierNote ?? '');
    setAttNote(o.attendantNote ?? '');
  }, [existing.data]);

  const suppliers = useLoader(ready ? 'needs-suppliers' : null,() => service.getNeedsRestocking({}), 'We could not load the suppliers.');
  const catalogLoader = useLoader<CatalogResult>(supplierId && ready ? `catalog:${supplierId}` : null, () => service.getCatalog({ supplierId, filter: 'all' }), 'We could not load the supplier’s catalog.');
  const supplier = suppliers.data?.suppliers.find((s) => s.id === supplierId) ?? (existing.data ? { id: existing.data.supplier.id, name: existing.data.supplier.name, code: existing.data.supplier.code, termsLabel: '' } : undefined);
  const catalog = catalogLoader.data;

  const byId = new Map<string, CatalogItem>((catalog?.items ?? []).map((i) => [i.inventoryItemId, i]));
  const selectedIds = Object.keys(lines).filter((id) => byId.has(id));
  const total = selectedIds.reduce((t, id) => t + (Number.parseFloat(byId.get(id)?.price || '0') || 0) * (Number.parseFloat(lines[id] ?? '0') || 0), 0);

  const setQty = (id: string, value: string): void => {
    touch();
    setLines((prev) => ({ ...prev, [id]: value }));
  };
  const toggle = (item: CatalogItem): void => {
    touch();
    setLines((prev) => {
      const next = { ...prev };
      if (item.inventoryItemId in next) delete next[item.inventoryItemId];
      else next[item.inventoryItemId] = item.qty ?? '1';
      return next;
    });
  };

  const visible = (catalog?.items ?? [])
    .filter((i) => (filter === 'low' ? i.status !== 'OK' : filter === 'selected' ? i.inventoryItemId in lines : true))
    .filter((i) => !search || i.itemName.toLowerCase().includes(search.toLowerCase()));

  const payload = () => ({
    supplierId,
    expectedDate: date || null,
    supplierNote: note.trim() || null,
    attendantNote: attNote.trim() || null,
    lines: selectedIds.map((id) => ({ inventoryItemId: id, qty: lines[id] ?? '0', unitPrice: byId.get(id)?.price ?? '' })),
  });
  const valid = supplierId !== '' && selectedIds.length > 0 && selectedIds.every((id) => Number.parseFloat(lines[id] ?? '0') > 0);

  /**
   * Create the draft, or update the one being edited. Once a draft exists (even if the next step, a PIN or the send, failed)
   * a retry updates it instead of creating a second one, which the one-open-order-per-supplier rule would refuse.
   */
  const draftId = React.useRef<string | null>(editId);
  const saveDraft = async (): Promise<Order> => {
    const o = draftId.current ? await service.updateOrder(draftId.current, payload()) : await service.createOrder(payload());
    draftId.current = o.id;
    return o;
  };

  const handleOpenOrder = (e: unknown): boolean => {
    // A race on the one-open-order rule is refused without the other order's id: that one falls through to the plain message.
    if (isPurchasingError(e, 'SUPPLIER_ORDER_OPEN')) {
      const details = errorDetails(e);
      if (typeof details.openOrderId === 'string') {
        setOpenOrder({ id: details.openOrderId, reference: (details.openReference as string | null) ?? null });
        return true;
      }
    }
    return false;
  };

  const draft = useAction(async () => {
    try {
      const o = await saveDraft();
      setDirty(false);
      addToast({ variant: 'success', title: 'Draft saved', description: 'Find it under Awaiting approval until you send it.' });
      router.push(`/app/inventory/purchasing/${o.id}`);
      return o;
    } catch (e) {
      if (handleOpenOrder(e)) return null as unknown as Order;
      throw e;
    }
  }, 'We could not save the draft. Try again.');

  const send = useAction(async () => {
    try {
      const o = await saveDraft();
      const sent = await service.submitOrder(o.id);
      setDirty(false);
      addToast({ variant: 'success', title: `${sent.reference} sent for approval`, description: 'The Store Manager will approve it with a PIN.' });
      router.push('/app/inventory/purchasing?tab=approval');
      return sent;
    } catch (e) {
      if (handleOpenOrder(e)) return null as unknown as Order;
      throw e;
    }
  }, 'We could not send the order. Try again.');

  const approveAndSend = async (pin: string): Promise<void> => {
    const o = await saveDraft().catch((e: unknown) => {
      if (handleOpenOrder(e)) setPinOpen(false);
      throw e;
    });
    const approved = await service.approveOrder(o.id, pin);
    setDirty(false);
    setPinOpen(false);
    addToast({ variant: 'success', title: `${approved.reference} approved`, description: 'Send it to the supplier from the order page.' });
    router.push(`/app/inventory/purchasing/${approved.id}`);
  };

  const actionFailure = draft.failure ?? send.failure;
  const busy = draft.saving || send.saving;

  if (editId && existing.status === 'error') {
    return (
      <>
        <Topbar breadcrumb={{ section: 'Purchasing', screen: 'New order', sectionHref: '/app/inventory/purchasing' }} hideSearch className="shrink-0" />
        <div className="p-8">
          <StockErrorCard title="We couldn't load this order" description={existing.error ?? 'Try again.'} onRetry={() => void existing.reload()} />
        </div>
      </>
    );
  }

  const returnedNote = existing.data?.status === 'RETURNED' ? existing.data : null;

  return (
    <>
      <Topbar
        breadcrumb={{ section: 'Purchasing', screen: editId ? 'Edit order' : 'New order', sectionHref: '/app/inventory/purchasing' }}
        hideSearch
        className="shrink-0"
        actions={
          <Button variant="secondary" asChild>
            <Link href="/app/inventory/purchasing">Discard</Link>
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 gap-8 overflow-y-auto px-8 py-7">
        <div className="flex min-w-0 grow basis-0 flex-col gap-4" style={{ maxWidth: 796 }}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-neutral-950">{editId ? 'Edit order' : 'New order'}</h1>
              <span className="rounded-[2px] border border-wds-border-strong px-2 py-0.5 font-wds-sans text-[11px] text-wds-text-secondary">{existing.data?.status === 'RETURNED' ? 'Returned' : 'Draft'}</span>
            </div>
            <p className="font-wds-sans text-wds-body-sm text-wds-text-secondary">
              {supplier ? `Tick what you need from ${supplier.name.split(' ')[0]}’s catalog. Items that are low or out are listed first.` : 'Choose who you are buying from, then tick what you need.'}
            </p>
          </div>

          {returnedNote ? (
            <div role="note" className="flex flex-col gap-1 rounded-wds-md border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
              <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-warning-fg">{returnedNote.returnedBy?.name ?? 'The manager'} sent this back</span>
              <span className="font-wds-sans text-wds-caption text-wds-warning-fg">{returnedNote.returnedNote}</span>
            </div>
          ) : null}

          {!supplierId ? (
            <SupplierPicker
              suppliers={suppliers.data?.suppliers ?? []}
              loading={suppliers.status === 'loading'}
              onPick={(id) => {
                setSupplierId(id);
                touch();
              }}
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${supplier?.name.split(' ')[0] ?? ''}’s catalog`} aria-label="Search the catalog" shortcutHint="" className="w-[230px]" />
                <SegmentedToggle
                  label="Which items to show"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'low', label: `Low and out ${catalog?.counts.lowOrOut ?? ''}` },
                    { value: 'all', label: `All ${catalog?.counts.all ?? ''}` },
                    { value: 'selected', label: `Selected ${selectedIds.length}` },
                  ]}
                />
              </div>
              {catalogLoader.status === 'error' ? (
                <StockErrorCard title="We couldn't load the catalog" description={catalogLoader.error ?? 'Try again.'} onRetry={() => void catalogLoader.reload()} />
              ) : catalogLoader.status !== 'ready' ? (
                <div className="flex flex-col gap-2" aria-busy>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[54px] animate-pulse rounded bg-wds-neutral-100" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <StockEmptyCard
                  title={filter === 'selected' ? 'Nothing selected yet' : 'No items to show'}
                  description={filter === 'low' ? 'Nothing from this supplier is low. Switch to All to see the whole catalog.' : 'Try another filter or search.'}
                  actionLabel={filter === 'low' ? 'Show all items' : undefined}
                  onAction={filter === 'low' ? () => setFilter('all') : undefined}
                />
              ) : (
                <div className="flex flex-col">
                  <div className="flex h-8 items-center gap-3 border-b border-wds-neutral-950">
                    <span className="w-6 shrink-0" />
                    <span className={cn(thClass, 'grow')}>Item</span>
                    <span className={cn(thClass, 'w-[118px] shrink-0')}>Stock</span>
                    <span className={cn(thClass, 'w-24 shrink-0')}>Sold as</span>
                    {showPrices ? <span className={cn(thClass, 'w-[74px] shrink-0 text-right')}>Price</span> : null}
                    <span className={cn(thClass, 'w-[100px] shrink-0')}>Qty</span>
                  </div>
                  {visible.map((i) => {
                    const on = i.inventoryItemId in lines;
                    return (
                      <div key={i.inventoryItemId} className="flex h-[54px] items-center gap-3 border-b border-wds-neutral-100">
                        <span className="flex w-6 shrink-0 items-center">
                          <Checkbox checked={on} onCheckedChange={() => toggle(i)} aria-label={`Select ${i.itemName}`} />
                        </span>
                        <div className="flex min-w-0 grow flex-col gap-0.5">
                          <span className="truncate font-wds-sans text-wds-body-sm leading-4 text-wds-neutral-950">{i.itemName}</span>
                          <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{i.category}</span>
                        </div>
                        <div className="flex w-[118px] shrink-0 flex-col gap-0.5">
                          <DotLabel tone={i.status === 'OUT' ? 'error' : i.status === 'LOW' ? 'warning' : 'success'}>{i.status === 'OUT' ? 'Out' : i.status === 'LOW' ? 'Low' : 'OK'}</DotLabel>
                          <span className="font-wds-mono text-[11px] text-wds-text-secondary">
                            {i.onHand !== undefined && i.level !== undefined ? `${fmtQty(i.onHand)} / ${fmtQty(i.level)}` : ''}
                          </span>
                        </div>
                        <span className="w-24 shrink-0 font-wds-sans text-wds-caption text-wds-text-secondary">{i.soldAs}</span>
                        {showPrices ? <span className="w-[74px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-neutral-950">{kes(i.price)}</span> : null}
                        <div className="w-[100px] shrink-0">
                          {on ? (
                            <label className="flex h-7 items-center justify-end gap-1.5 rounded-[2px] border border-wds-border-strong bg-wds-surface px-2 focus-within:border-wds-primary focus-within:shadow-wds-ring">
                              <input
                                inputMode="decimal"
                                value={lines[i.inventoryItemId] ?? ''}
                                onChange={(e) => setQty(i.inventoryItemId, e.target.value.replace(/[^0-9.]/g, ''))}
                                aria-label={`Quantity of ${i.itemName}`}
                                className="w-full min-w-0 bg-transparent text-right font-wds-mono text-wds-caption text-wds-neutral-950 outline-none"
                              />
                              <span className="shrink-0 font-wds-sans text-[11px] text-wds-text-secondary">{i.buyUnit}</span>
                            </label>
                          ) : (
                            <span className="block text-right font-wds-mono text-wds-caption text-wds-text-faint">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex h-10 items-center justify-between">
                    <span className="font-wds-sans text-wds-caption text-wds-text-secondary">
                      Showing {visible.length} of {catalog?.total ?? 0}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="flex w-80 shrink-0 flex-col self-start rounded-wds-md border border-wds-border bg-wds-surface" aria-label="Order summary">
          <div className="flex h-11 items-center justify-between border-b border-wds-border px-4">
            <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-neutral-950">Order summary</span>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-[2px] bg-wds-neutral-100 px-1.5 font-wds-mono text-[11px] text-wds-neutral-950">{selectedIds.length}</span>
          </div>
          <div className="flex flex-col gap-4 p-4">
            {actionFailure ? <FormErrorBanner title="We couldn't do that" description={actionFailure.message} /> : null}
            <div className="flex flex-col gap-1">
              <FieldLabel>Supplier</FieldLabel>
              <div className="flex items-center justify-between gap-2">
                <span className="font-wds-sans text-wds-body-sm font-medium text-wds-neutral-950">{supplier?.name ?? 'Not chosen yet'}</span>
                {supplierId && !editId ? (
                  <button type="button" onClick={() => setChanging((c) => !c)} className="font-wds-sans text-wds-caption text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
                    Change
                  </button>
                ) : null}
              </div>
              {supplier?.termsLabel ? <span className="font-wds-sans text-[11px] text-wds-text-secondary">{supplier.termsLabel}</span> : null}
              {changing ? (
                <select
                  aria-label="Change supplier"
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    setLines({});
                    setChanging(false);
                    touch();
                  }}
                  className="mt-1 h-8 rounded-wds-sm border border-wds-border-strong bg-white px-2 font-wds-sans text-wds-body-sm outline-none focus-visible:shadow-wds-ring"
                >
                  {(suppliers.data?.suppliers ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="flex flex-col">
              {selectedIds.length === 0 ? (
                <p className="font-wds-sans text-wds-caption text-wds-text-secondary">Nothing ticked yet.</p>
              ) : (
                selectedIds.map((id) => {
                  const it = byId.get(id) as CatalogItem;
                  const q = Number.parseFloat(lines[id] ?? '0') || 0;
                  return (
                    <div key={id} className="flex items-start gap-2 border-b border-wds-neutral-100 py-2 last:border-b-0">
                      <div className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="truncate font-wds-sans text-wds-body-sm text-wds-neutral-950">{it.itemName}</span>
                        <span className="font-wds-mono text-[11px] text-wds-text-secondary">
                          {fmtQty(lines[id])} {it.buyUnit}
                          {showPrices ? ` × ${kes(it.price)}` : ''}
                        </span>
                      </div>
                      {showPrices ? <span className="font-wds-mono text-wds-body-sm text-wds-neutral-950">{kes(q * Number.parseFloat(it.price || '0'))}</span> : null}
                      <button
                        type="button"
                        onClick={() => toggle(it)}
                        aria-label={`Remove ${it.itemName}`}
                        className="flex size-5 items-center justify-center text-wds-text-faint outline-none hover:text-wds-neutral-950 focus-visible:shadow-wds-ring"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="expected">Expected delivery</FieldLabel>
              <input
                id="expected"
                type="date"
                value={date}
                min={isoDay(new Date())}
                onChange={(e) => {
                  setDate(e.target.value);
                  touch();
                }}
                className="h-8 rounded-wds-sm border border-wds-border-strong bg-white px-2 font-wds-sans text-wds-body-sm text-wds-neutral-950 outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
              />
              <div className="flex gap-1.5">
                {[
                  ['Today', 0],
                  ['Tomorrow', 1],
                  ['In 3 days', 3],
                ].map(([label, n]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setDate(addDays(n as number));
                      touch();
                    }}
                    className={cn(
                      'h-6 rounded-[2px] border px-2 font-wds-sans text-[11px] outline-none focus-visible:shadow-wds-ring',
                      date === addDays(n as number) ? 'border-wds-primary bg-wds-espresso-50 text-wds-neutral-950' : 'border-wds-border-strong bg-white text-wds-text-secondary hover:bg-wds-neutral-50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="supplier-note">Note to supplier (optional)</FieldLabel>
              <Textarea
                id="supplier-note"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  touch();
                }}
                placeholder="e.g. deliver before 10am"
                className="min-h-12"
              />
            </div>
            {!canApprove ? (
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="att-note">Note for the Store Manager (optional)</FieldLabel>
                <Textarea
                  id="att-note"
                  value={attNote}
                  onChange={(e) => {
                    setAttNote(e.target.value);
                    touch();
                  }}
                  placeholder="Why do we need this?"
                  className="min-h-12"
                />
              </div>
            ) : null}
          </div>

          {showPrices ? (
            <div className="flex h-12 items-center justify-between border-t border-wds-border px-4">
              <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Order total</span>
              <span className="font-wds-mono text-wds-section font-medium text-wds-neutral-950">KES {kes2(total)}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-wds-border p-4">
            {canApprove ? (
              <Button className="h-9" disabled={!valid || busy} onClick={() => setPinOpen(true)}>
                Approve and send
              </Button>
            ) : (
              <Button className="h-9" disabled={!valid || busy || !can('orders.request')} onClick={() => void send.run()}>
                {send.saving ? 'Sending…' : 'Send for approval'}
              </Button>
            )}
            <Button variant="secondary" disabled={!valid || busy || !can('orders.request')} onClick={() => void draft.run()}>
              {draft.saving ? 'Saving…' : 'Save draft'}
            </Button>
            <p className="font-wds-sans text-[11px] leading-[15px] text-wds-text-secondary">
              {canApprove
                ? role === 'SYSTEM_ADMIN'
                  ? 'You are signed in as System Admin, so you approve with your own PIN.'
                  : 'You are the Store Manager, so you approve with your PIN. An order raised by someone else waits for you.'
                : 'The Store Manager approves it with a PIN before it goes to the supplier.'}
            </p>
          </div>
        </aside>
      </div>

      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Approve with your PIN"
        subtitle={role === 'SYSTEM_ADMIN' ? 'You are signed in as System Admin. Approve with your own PIN.' : 'Your signature goes on the printed LPO.'}
        summary={{ title: `${supplier?.name ?? ''}`, detail: `${selectedIds.length} line${selectedIds.length === 1 ? '' : 's'}${showPrices ? ` · KES ${kes2(total)}` : ''}` }}
        confirmLabel="Approve order"
        onSubmit={approveAndSend}
      />

      <ConfirmDialog
        open={guard.pendingHref !== null}
        onOpenChange={(o) => (!o ? guard.stay() : undefined)}
        title="Leaving with unsaved changes"
        description="Discard this order? What you typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={guard.confirmLeave}
      />

      <ConfirmDialog
        open={openOrder !== null}
        onOpenChange={(o) => (!o ? setOpenOrder(null) : undefined)}
        title="Another order is still open"
        description={`${openOrder?.reference ?? 'A draft'} to ${supplier?.name ?? 'this supplier'} is still open. There is one order per supplier, so add your items to that order instead.`}
        confirmLabel={`Open ${openOrder?.reference ?? 'it'}`}
        cancelLabel="Close"
        destructive={false}
        onConfirm={() => {
          const id = openOrder?.id;
          setDirty(false);
          setOpenOrder(null);
          if (id) router.push(`/app/inventory/purchasing/${id}`);
        }}
      />
    </>
  );
}

function SupplierPicker({ suppliers, loading, onPick }: { suppliers: Array<{ id: string; name: string; code: string; termsLabel: string }>; loading: boolean; onPick: (id: string) => void }) {
  if (loading) return <div className="h-24 animate-pulse rounded bg-wds-neutral-100" aria-busy />;
  return (
    <div className="flex flex-col rounded-wds-md border border-wds-border bg-wds-surface">
      <div className="border-b border-wds-border px-4 py-3 font-wds-sans text-wds-body-sm font-semibold text-wds-neutral-950">Who are you buying from?</div>
      {suppliers.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.id)}
          className="flex items-center gap-3 border-b border-wds-neutral-100 px-4 py-3 text-left outline-none transition-colors last:border-b-0 hover:bg-wds-neutral-50 focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
        >
          <span className="font-wds-sans text-wds-body-sm text-wds-neutral-950">{s.name}</span>
          <span className="font-wds-mono text-[11px] text-wds-text-secondary">{s.code}</span>
          <span className="ml-auto font-wds-sans text-wds-caption text-wds-text-secondary">{s.termsLabel}</span>
        </button>
      ))}
    </div>
  );
}
