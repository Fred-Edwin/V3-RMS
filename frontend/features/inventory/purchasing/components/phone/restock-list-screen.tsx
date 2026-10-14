'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { useAction } from '../../../_shared/hooks/use-async';
import { useAttendantData } from '../../hooks/use-attendant';
import { kes, qty } from '../../lib/format';
import { useRestockList, type ListLine } from '../../store/restock-list-store';
import type { NeedsGroup, NeedsLine } from '../../types';
import { PURCHASING } from './order-cards';
import { useUrlParams } from './gate';
import { FilterChips, HeaderSearch, HIT, Label, PhoneBar, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, PrimaryButton, StatusLine, WriteError, plural, useDebouncedQuery, useGoBack } from './phone-kit';

interface Entry {
  line: NeedsLine;
  supplier: { id: string; name: string } | null;
}

type View = 'all' | 'out' | 'low' | 'supplier';

/** The list line the store keeps for a needs line (what is bought, from whom, at what price). */
export function toListLine(entry: Entry): ListLine {
  return {
    inventoryItemId: entry.line.inventoryItemId,
    name: entry.line.itemName,
    qty: entry.line.suggestedQty ?? '1',
    buyUnit: entry.line.buyUnit ?? entry.line.usageUnit,
    supplierId: entry.supplier?.id ?? null,
    supplierName: entry.supplier?.name ?? null,
    unitPrice: entry.line.lastPrice,
  };
}

/** "Add 6 tray" and, once on the list, the 112 × 36 stepper (Paper 28B). */
export function AddOrStepper({ name, onList, buyUnit, suggested, qtyValue, onAdd, onSet, floor = false }: { name: string; onList: boolean; buyUnit: string; suggested: string; qtyValue: string; onAdd: () => void; onSet: (n: number) => void; /** The stepper stops at 1 instead of taking the line off (a returned order keeps all its lines). */ floor?: boolean }) {
  if (!onList) {
    return (
      <button type="button" onClick={onAdd} aria-label={`Add ${suggested} ${buyUnit} of ${name} to your list`} className={cn(HIT, 'flex h-9 min-w-28 shrink-0 items-center justify-center gap-1.5 border border-wds-border-strong bg-white px-2 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink outline-none focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:bg-wds-neutral-50')}>
        <span aria-hidden="true" className="font-wds-sans text-[16px] font-normal leading-[18px] text-[var(--wds-primary-btn-start)]">
          +
        </span>
        Add {suggested} {buyUnit}
      </button>
    );
  }
  const n = Number.parseFloat(qtyValue) || 1;
  return (
    <div role="group" aria-label={`${name}, quantity`} className="flex h-9 w-28 shrink-0 items-stretch border border-[var(--wds-primary-btn-start)] bg-white">
      <button type="button" disabled={floor && n <= 1} aria-label={n <= 1 && !floor ? `Take ${name} off your list` : `Fewer ${name}`} onClick={() => onSet(n - 1)} className={cn(HIT, 'w-[34px] shrink-0 font-wds-sans text-[18px] leading-5 text-wds-text-ink outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)] disabled:text-wds-text-faint')}>
        −
      </button>
      <output aria-live="polite" className="flex grow items-center justify-center font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">
        {qty(qtyValue)}
      </output>
      <button type="button" aria-label={`More ${name}`} onClick={() => onSet(n + 1)} className={cn(HIT, 'w-[34px] shrink-0 font-wds-sans text-[18px] leading-5 text-[var(--wds-primary-btn-start)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)]')}>
        +
      </button>
    </div>
  );
}

function flatten(groups: NeedsGroup[]): Entry[] {
  return groups.flatMap((g) => g.lines.map((line) => ({ line, supplier: g.supplier ? { id: g.supplier.id, name: g.supplier.name } : null })));
}

const byUrgency = (a: Entry, b: Entry): number => (a.line.status === b.line.status ? a.line.itemName.localeCompare(b.line.itemName) : a.line.status === 'OUT' ? -1 : 1);

/** "Set a supplier" (training fix 9): pick one of the suppliers already on file; the item gets it with no price, and its history names who did it. */
export function SetSupplierSheet({ itemName, suppliers, saving, failure, onPick, onClose }: { itemName: string | null; suppliers: Array<{ id: string; name: string; code: string }>; saving: boolean; failure: string | null; onPick: (supplierId: string) => void; onClose: () => void }) {
  const [text, setText] = React.useState('');
  const shown = suppliers.filter((s) => !text.trim() || s.name.toLowerCase().includes(text.trim().toLowerCase()));
  return (
    <BottomSheet open={itemName !== null} onOpenChange={(o) => (!o ? onClose() : undefined)} label="Set a supplier" className="flex max-h-[80dvh] flex-col gap-3 border-t border-wds-border-strong bg-wds-surface px-5 pb-7 pt-3">
      <SheetGrabber />
      <Label small>{`SUPPLIER FOR ${(itemName ?? '').toUpperCase()}`}</Label>
      <input type="search" autoComplete="off" aria-label="Search suppliers" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search a supplier" className="h-11 w-full border border-wds-border-strong bg-white px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-wds-text-faint focus-visible:border-[var(--wds-primary-btn-start)] focus-visible:shadow-wds-ring" />
      {failure ? <WriteError>{failure}</WriteError> : null}
      <ul className="min-h-0 overflow-y-auto border border-wds-border">
        {shown.length === 0 ? <li className="px-3.5 py-4 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No supplier by that name.</li> : null}
        {shown.map((s) => (
          <li key={s.id} className="border-b border-wds-border last:border-b-0">
            <button type="button" disabled={saving} onClick={() => onPick(s.id)} className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)] disabled:opacity-60">
              <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{s.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Only suppliers already on file. The Store Manager adds the price later.</p>
    </BottomSheet>
  );
}

function Row({ entry, list, onSetSupplier }: { entry: Entry; list: ReturnType<typeof useRestockList>; onSetSupplier?: (entry: Entry) => void }) {
  const { line, supplier } = entry;
  const onList = list.get(line.inventoryItemId);
  const out = line.status === 'OUT';
  const unit = line.usageUnit;
  const suggested = line.suggestedQty ? qty(line.suggestedQty) : '1';
  return (
    <li className={cn('flex items-center justify-between gap-3 border-b border-wds-border px-5 py-3', onList ? 'bg-wds-espresso-50' : 'bg-white')}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{line.itemName}</p>
        <StatusLine tone={out ? 'error' : 'warning'}>{line.onHand !== undefined && line.level !== undefined ? `${Number.parseFloat(line.onHand) < 0 ? '0' : qty(line.onHand)} left · reorder at ${qty(line.level)} ${unit}` : out ? 'Out of stock' : 'Running low'}</StatusLine>
        <p className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{supplier ? `${supplier.name}${line.lastPrice ? ` · KES ${kes(line.lastPrice)} each` : ''}` : 'No supplier yet'}</p>
      </div>
      {!supplier && !onList ? (
        // Review would leave this item out anyway, so the dead end is shown here instead; who may set a supplier gets a button.
        onSetSupplier ? (
          <button type="button" aria-label={`Set a supplier for ${line.itemName}`} onClick={() => onSetSupplier(entry)} className={cn(HIT, 'flex h-9 min-w-28 shrink-0 items-center justify-center border border-wds-border-strong bg-white px-2 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink outline-none focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:bg-wds-neutral-50')}>
            Set a supplier
          </button>
        ) : (
          <span className="flex h-9 min-w-28 shrink-0 items-center justify-center border border-wds-border bg-white px-2 text-center font-wds-sans text-[12px] leading-4 text-wds-text-faint">Set a supplier first</span>
        )
      ) : (
        <AddOrStepper
          name={line.itemName}
          onList={Boolean(onList)}
          buyUnit={line.buyUnit ?? unit}
          suggested={suggested}
          qtyValue={onList?.qty ?? suggested}
          onAdd={() => list.add(toListLine(entry))}
          onSet={(n) => list.setQty(line.inventoryItemId, n)}
        />
      )}
    </li>
  );
}

const EXTRAS_SHOWN = 3;

/** The end of a supplier group (Paper board 3): a quiet row that opens the supplier's other, not-low items in place. */
function MoreFromSupplier({ supplier, skip, list }: { supplier: { id: string; name: string }; skip: Set<string>; list: ReturnType<typeof useRestockList> }) {
  const [open, setOpen] = React.useState(false);
  const [all, setAll] = React.useState(false);
  const short = supplier.name.split(' ')[0] ?? supplier.name;
  const { data, status } = useAttendantData(`attendant:catalog:${supplier.id}`, (s) => s.getCatalog({ supplierId: supplier.id, filter: 'all' }), 'We could not load this supplier’s items.');
  const items = (data?.items ?? []).filter((i) => !skip.has(i.inventoryItemId));
  if (status === 'ready' && items.length === 0) return null;
  if (!data) return null;
  const shown = all ? items : items.slice(0, EXTRAS_SHOWN);
  return (
    <div className="border-b border-wds-border bg-white">
      {open ? (
        <>
          <div className="flex items-center justify-between px-5 pb-2 pt-3.5">
            <Label>{`ALSO FROM ${short.toUpperCase()} · ${items.length}`}</Label>
            <button type="button" onClick={() => setOpen(false)} className={cn(HIT, 'font-wds-sans text-[13px] font-medium leading-4 text-wds-text-secondary outline-none focus-visible:shadow-wds-ring')}>
              Hide ⌃
            </button>
          </div>
          <ul className="border-t border-wds-border">
            {shown.map((i) => {
              const onList = list.get(i.inventoryItemId);
              const price = Number.parseFloat(i.price);
              const priced = Number.isFinite(price) && price > 0;
              return (
                <li key={i.inventoryItemId} className={cn('flex items-center justify-between gap-3 border-b border-wds-border px-5 py-3 last:border-b-0', onList ? 'bg-wds-espresso-50' : 'bg-white')}>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{i.itemName}</p>
                    <StatusLine tone="success">{i.onHand !== undefined ? `${qty(i.onHand)} left · fine for now` : 'Fine for now'}</StatusLine>
                    <p className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{priced ? `${supplier.name} · KES ${kes(i.price)} each` : supplier.name}</p>
                  </div>
                  {!priced && !onList ? (
                    <span className="flex h-9 min-w-28 shrink-0 items-center justify-center border border-wds-border bg-white px-2 text-center font-wds-sans text-[12px] leading-4 text-wds-text-faint">No price yet</span>
                  ) : onList ? (
                    <AddOrStepper name={i.itemName} onList buyUnit={i.buyUnit} suggested="1" qtyValue={onList.qty} onAdd={() => undefined} onSet={(n) => list.setQty(i.inventoryItemId, n)} />
                  ) : (
                    <button
                      type="button"
                      aria-label={`Add ${i.itemName} to your list`}
                      onClick={() => list.add({ inventoryItemId: i.inventoryItemId, name: i.itemName, qty: '1', buyUnit: i.buyUnit, supplierId: supplier.id, supplierName: supplier.name, unitPrice: i.price || null })}
                      className={cn(HIT, 'flex h-9 min-w-28 shrink-0 items-center justify-center gap-1.5 border border-wds-border-strong bg-white px-2 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink outline-none focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:bg-wds-neutral-50')}
                    >
                      <span aria-hidden="true" className="text-[16px] font-normal leading-[18px] text-[var(--wds-primary-btn-start)]">+</span>
                      Add
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {items.length > EXTRAS_SHOWN ? (
            <button type="button" onClick={() => setAll((v) => !v)} className={cn(HIT, 'flex w-full items-center px-5 py-3 text-left font-wds-sans text-[13px] font-medium leading-4 text-[var(--wds-primary-btn-start)] outline-none focus-visible:shadow-wds-ring')}>
              {all ? 'Show fewer' : `Show ${items.length - EXTRAS_SHOWN} more`}
            </button>
          ) : null}
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={cn(HIT, 'flex w-full items-center justify-between px-5 py-3 text-left outline-none focus-visible:shadow-wds-ring')}>
          <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-secondary">{`More from ${short} · ${plural(items.length, 'more item')}`}</span>
          <span aria-hidden="true" className="text-wds-text-secondary">⌄</span>
        </button>
      )}
    </div>
  );
}

/** 28B: build the restock list: every item that is out or low, with the amount that brings it back to its level. */
export function RestockListScreen() {
  const back = useGoBack(PURCHASING, { parent: true });
  const { params, set } = useUrlParams();
  const list = useRestockList();
  const view = (['all', 'out', 'low', 'supplier'].includes(params.get('view') ?? '') ? params.get('view') : 'all') as View;
  const [text, setText] = useDebouncedQuery(params.get('q') ?? '', (q) => set({ q: q || null }));
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const { data, status, error, reload, service, can } = useAttendantData('attendant:needs', (s) => s.getNeedsRestocking({ group: 'supplier' }), 'We could not load the restock list.');
  const canLink = can('suppliers.link_item');
  const [picking, setPicking] = React.useState<Entry | null>(null);
  const link = useAction((itemId: string, supplierId: string) => service.linkItemSupplier(itemId, supplierId), 'We could not set the supplier. Try again.');
  const onPickSupplier = async (supplierId: string): Promise<void> => {
    if (!picking) return;
    const done = await link.run(picking.line.inventoryItemId, supplierId);
    if (done === null) return;
    setPicking(null);
    void reload();
  };

  const all = React.useMemo(() => (data ? flatten(data.groups).sort(byUrgency) : []), [data]);
  const matches = React.useMemo(() => all.filter((e) => !q || e.line.itemName.toLowerCase().includes(q) || (e.supplier?.name.toLowerCase().includes(q) ?? false)), [all, q]);
  const allLowIds = React.useMemo(() => new Set(all.map((e) => e.line.inventoryItemId)), [all]);
  const out = matches.filter((e) => e.line.status === 'OUT');
  const low = matches.filter((e) => e.line.status === 'LOW');
  const shown = view === 'out' ? out : view === 'low' ? low : matches;

  const bySupplier = React.useMemo(() => {
    const map = new Map<string, { name: string; entries: Entry[] }>();
    for (const e of matches) {
      const key = e.supplier?.id ?? 'none';
      const slot = map.get(key) ?? { name: e.supplier?.name ?? 'No supplier yet', entries: [] };
      slot.entries.push(e);
      map.set(key, slot);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] === 'none' ? 1 : b[0] === 'none' ? -1 : a[1].name.localeCompare(b[1].name)));
  }, [matches]);

  // "Add all" works on what is on screen, and skips items with no supplier (they cannot be ordered yet).
  const addable = (view === 'supplier' ? matches : shown).filter((e) => e.supplier !== null);
  const total = list.summary.total;
  return (
    <PhoneScreen
      header={
        <B2Header title="Restock list" subtitle="Suggested = reorder level minus what is left." leading="back" onBack={back} place="HUB">
          <HeaderSearch value={text} onChange={setText} placeholder="Search an item or supplier" label="Search the restock list" />
        </B2Header>
      }
      bar={
        <PhoneBar gap={14}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0" aria-live="polite">
              <p className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{plural(list.count, 'item')} on your list</p>
              <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                {plural(list.summary.suppliers, 'supplier')}
                {total !== null ? ` · about KES ${kes(total)}` : ''}
              </p>
            </div>
            <PrimaryButton size="list" href={`${PURCHASING}/restock/review`} disabled={list.count === 0} className="w-[132px]">
              Review list
            </PrimaryButton>
          </div>
        </PhoneBar>
      }
    >
      <FilterChips
        label="Show"
        active={view}
        onChange={(key) => set({ view: key === 'all' ? null : key })}
        chips={[
          { key: 'all', label: 'All', count: matches.length },
          { key: 'out', label: 'Out', count: out.length, dot: 'error' },
          { key: 'low', label: 'Low', count: low.length, dot: 'warning' },
          { key: 'supplier', label: 'By supplier' },
        ]}
      />
      <Link href={`${PURCHASING}/new`} className={cn(HIT, 'flex items-center justify-between gap-3 border-b border-wds-border bg-white px-5 py-2.5 font-wds-sans text-[13px] leading-4 outline-none focus-visible:shadow-wds-ring')}>
        <span className="text-wds-text-secondary">Need something that is not low?</span>
        <span className="font-medium text-[var(--wds-primary-btn-start)]">New order →</span>
      </Link>
      {data && addable.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-wds-border bg-white px-5 py-2.5">
          <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            {addable.filter((e) => list.get(e.line.inventoryItemId)).length} of {addable.length} on your list
          </p>
          <button
            type="button"
            onClick={() => addable.forEach((e) => (list.get(e.line.inventoryItemId) ? undefined : list.add(toListLine(e))))}
            disabled={addable.every((e) => list.get(e.line.inventoryItemId))}
            className={cn(HIT, 'font-wds-sans text-[13px] font-medium leading-4 text-[var(--wds-primary-btn-start)] outline-none focus-visible:shadow-wds-ring disabled:text-wds-text-faint')}
          >
            Add all
          </button>
        </div>
      ) : null}
      {status === 'loading' || status === 'idle' ? (
        <PhoneLoading rows={5} label="Loading the restock list" />
      ) : (
        <>
          {status === 'error' ? <PhoneError className="m-5" onRetry={() => void reload()} message={error} /> : null}
          {data && all.length === 0 ? <PhoneEmpty title="Nothing needs restocking" line="Every item is above its reorder level." action={{ label: 'Restock levels', href: `${PURCHASING}/levels` }} /> : null}
          {data && all.length > 0 && shown.length === 0 && view !== 'supplier' ? <PhoneEmpty title={q ? `No match for "${params.get('q')}"` : 'Nothing here'} line={q ? 'Check the spelling or search a supplier.' : 'No items in this list.'} action={q ? { label: 'Clear search', onClick: () => { setText(''); set({ q: null }); } } : undefined} /> : null}
          {data && view === 'supplier'
            ? bySupplier.map(([key, group]) => (
                <section key={key} aria-labelledby={`grp-${key}`}>
                  <div className="px-5 pb-2 pt-3.5">
                    <Label id={`grp-${key}`}>{`${group.name} · ${group.entries.length}`}</Label>
                  </div>
                  <ul className="border-t border-wds-border">
                    {group.entries.map((e) => (
                      <Row key={e.line.inventoryItemId} entry={e} list={list} onSetSupplier={canLink ? setPicking : undefined} />
                    ))}
                  </ul>
                  {key !== 'none' && !q && data.groups.some((g) => g.supplier?.id === key) ? <MoreFromSupplier supplier={{ id: key, name: group.name }} skip={allLowIds} list={list} /> : null}
                </section>
              ))
            : null}
          {data && view !== 'supplier' && shown.length > 0 ? (
            <>
              {(view === 'all' || view === 'out') && out.length > 0 ? (
                <section aria-labelledby="grp-out">
                  <div className="px-5 pb-2 pt-3.5">
                    <Label id="grp-out" tone="error">
                      OUT OF STOCK · {out.length}
                    </Label>
                  </div>
                  <ul className="border-t border-wds-border">
                    {out.map((e) => (
                      <Row key={e.line.inventoryItemId} entry={e} list={list} onSetSupplier={canLink ? setPicking : undefined} />
                    ))}
                  </ul>
                </section>
              ) : null}
              {(view === 'all' || view === 'low') && low.length > 0 ? (
                <section aria-labelledby="grp-low">
                  <div className="px-5 pb-2 pt-4">
                    <Label id="grp-low" tone="warning">
                      RUNNING LOW · {low.length}
                    </Label>
                  </div>
                  <ul className="border-t border-wds-border">
                    {low.map((e) => (
                      <Row key={e.line.inventoryItemId} entry={e} list={list} onSetSupplier={canLink ? setPicking : undefined} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </>
      )}
      <SetSupplierSheet itemName={picking?.line.itemName ?? null} suppliers={data?.suppliers ?? []} saving={link.saving} failure={link.failure?.message ?? null} onPick={(id) => void onPickSupplier(id)} onClose={() => { setPicking(null); link.clear(); }} />
    </PhoneScreen>
  );
}
