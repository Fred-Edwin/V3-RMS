'use client';

import * as React from 'react';

import { Picker } from '@/components/ui2/picker';
import { cn } from '@/lib/cn';
import { B2Header, PagerBar } from '../../../_shared/components/block2-phone-parts';
import { useAction } from '../../../_shared/hooks/use-async';
import { useAttendantData } from '../../hooks/use-attendant';
import { kes, qty } from '../../lib/format';
import { useRestockList, type ListLine } from '../../store/restock-list-store';
import type { RestockLevelRow } from '../../types/attendant';
import { PURCHASING } from './order-cards';
import { useUrlParams } from './gate';
import { AddOrStepper, SetSupplierSheet } from './restock-list-screen';
import { HeaderSearch, PhoneBar, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, PrimaryButton, plural, useDebouncedQuery, useGoBack } from './phone-kit';

/**
 * New order on the phone (Paper "Training fixes" T9 to T11): every item the store buys, whatever its level, with a search, a
 * Low-and-out filter and a supplier filter. Add what you need; each supplier gets its own order at the review (the same review the
 * Restock list uses). An item with no supplier yet offers "Set a supplier" instead of "Add".
 */
const PAGE_SIZE = 20;
const TONE = { OUT: 'bg-wds-error-fg text-wds-error-fg', LOW: 'bg-wds-warning-fg text-wds-warning-fg', OK: 'bg-wds-success-fg text-wds-text-secondary' } as const;
const WORD = { OUT: 'Out', LOW: 'Low', OK: 'OK' } as const;

const toListLine = (row: RestockLevelRow): ListLine => ({
  inventoryItemId: row.inventoryItemId,
  name: row.name,
  qty: row.suggestedQty ?? '1',
  buyUnit: row.buyUnit ?? row.usageUnit,
  supplierId: row.supplier?.id ?? null,
  supplierName: row.supplier?.name ?? null,
  unitPrice: row.lastPrice,
});

function ItemRow({ row, list, onSetSupplier }: { row: RestockLevelRow; list: ReturnType<typeof useRestockList>; onSetSupplier: (row: RestockLevelRow) => void }) {
  const onList = list.get(row.inventoryItemId);
  const tone = TONE[row.status];
  const suggested = row.suggestedQty ? qty(row.suggestedQty) : '1';
  const unit = row.buyUnit ?? row.usageUnit;
  return (
    <li className={cn('flex items-center justify-between gap-3 border-b border-wds-border px-5 py-3', onList ? 'bg-wds-espresso-50' : 'bg-white')}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{row.name}</p>
        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{row.supplier ? `${row.supplier.name}${row.lastPrice ? ` · KES ${kes(row.lastPrice)} / ${unit}` : ''}` : 'No supplier yet'}</p>
        <p className="flex items-center gap-1.5 font-wds-sans text-[12px] leading-4">
          <span aria-hidden="true" className={cn('size-1.5 rounded-full', tone.split(' ')[0])} />
          <span className={tone.split(' ')[1]}>
            {WORD[row.status]} · {Number.parseFloat(row.onHand) < 0 ? '0' : qty(row.onHand)} of {qty(row.level)} {row.usageUnit}
          </span>
        </p>
      </div>
      {!row.supplier ? (
        <button type="button" aria-label={`Set a supplier for ${row.name}`} onClick={() => onSetSupplier(row)} className="flex h-11 min-w-[104px] shrink-0 items-center justify-center border border-wds-border-strong bg-white px-2 font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700 outline-none focus-visible:shadow-wds-ring">
          Set supplier
        </button>
      ) : (
        <AddOrStepper name={row.name} onList={Boolean(onList)} buyUnit={unit} suggested={suggested} qtyValue={onList?.qty ?? suggested} onAdd={() => list.add(toListLine(row))} onSet={(n) => list.setQty(row.inventoryItemId, n)} />
      )}
    </li>
  );
}

export function NewOrderPhoneScreen() {
  const back = useGoBack(PURCHASING, { parent: true });
  const { params, set } = useUrlParams();
  const list = useRestockList();
  const view = params.get('view') === 'needs' ? 'needs' : 'all';
  const supplierId = params.get('supplier') ?? undefined;
  const q = (params.get('q') ?? '').trim();
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1);
  const [text, setText] = useDebouncedQuery(params.get('q') ?? '', (value) => set({ q: value.trim() || null, page: null }));
  const { data, status, error, reload, service } = useAttendantData(`attendant:new-order:${view}:${supplierId ?? ''}:${q}:${page}`, (s) => s.getRestockLevels({ status: view === 'needs' ? 'NEEDS' : undefined, supplierId, q: q || undefined, page, pageSize: PAGE_SIZE }), 'We could not load the items.');
  const suppliers = useAttendantData('attendant:new-order:suppliers', (s) => s.getNeedsRestocking({ group: 'supplier' }), 'We could not load the suppliers.');
  const [picking, setPicking] = React.useState<RestockLevelRow | null>(null);
  const link = useAction((itemId: string, supplierId2: string) => service.linkItemSupplier(itemId, supplierId2), 'We could not set the supplier. Try again.');
  const onPickSupplier = async (id: string): Promise<void> => {
    if (!picking) return;
    if ((await link.run(picking.inventoryItemId, id)) === null) return;
    setPicking(null);
    void reload();
  };
  const total = list.summary.total;
  const needs = data ? data.counts.out + data.counts.low : null;

  return (
    <PhoneScreen
      header={
        <B2Header title="New order" subtitle="Every item you can buy. Tick what you need; each supplier gets its own order." leading="back" onBack={back} place="HUB">
          <HeaderSearch value={text} onChange={setText} placeholder="Search an item or supplier" label="Search items" />
        </B2Header>
      }
      bar={
        <>
          {data && data.total > PAGE_SIZE ? <PagerBar bar page={data.page} pageSize={data.pageSize} total={data.total} shown={data.rows.length} onPage={(p) => set({ page: p === 1 ? null : String(p) })} noun="" /> : null}
          <PhoneBar gap={14}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0" aria-live="polite">
                <p className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{plural(list.count, 'item')} on your list</p>
                <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                  {plural(list.summary.suppliers, 'supplier')}
                  {total !== null ? ` · about KES ${kes(total)}` : ''}
                </p>
              </div>
              <PrimaryButton size="list" href={`${PURCHASING}/restock/review`} disabled={list.count === 0} className="w-[140px]">
                Review order
              </PrimaryButton>
            </div>
          </PhoneBar>
        </>
      }
    >
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-wds-border bg-white px-5 py-3">
        <div role="group" aria-label="Which items" className="flex gap-2">
          {(
            [
              ['all', `All items${data ? ` · ${data.counts.all}` : ''}`],
              ['needs', `Low and out${needs !== null ? ` · ${needs}` : ''}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => set({ view: key === 'all' ? null : key, page: null })}
              className={cn(
                'flex min-h-11 grow basis-0 items-center justify-center border px-3 font-wds-sans text-[14px] leading-5 outline-none transition-colors focus-visible:shadow-wds-ring',
                view === key ? 'border-[var(--wds-primary-btn-start)] bg-wds-espresso-50 font-semibold text-wds-espresso-700 shadow-[inset_0_-3px_0_var(--wds-primary-btn-start)]' : 'border-wds-border-strong bg-white text-wds-text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Picker
          aria-label="Supplier"
          value={supplierId ?? ''}
          onValueChange={(v) => set({ supplier: v || null, page: null })}
          chips={false}
          className="h-11 text-[14px]"
          options={[{ value: '', label: 'Supplier: All suppliers' }, ...(data?.suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))]}
        />
      </div>
      {status === 'loading' || status === 'idle' ? (
        <PhoneLoading rows={6} label="Loading the items" />
      ) : (
        <>
          {status === 'error' ? <PhoneError className="m-5" onRetry={() => void reload()} message={error} /> : null}
          {data && data.rows.length === 0 ? (
            <PhoneEmpty
              title={q ? `No match for "${q}"` : view === 'needs' ? 'Nothing is low or out' : 'No items'}
              line={view === 'needs' && !q ? 'Switch to All items to order something that is not low.' : 'Check the spelling or change the filters.'}
              action={view === 'needs' || q || supplierId ? { label: 'Show all items', onClick: () => { setText(''); set({ view: null, supplier: null, q: null, page: null }); } } : undefined}
            />
          ) : null}
          {data && data.rows.length > 0 ? (
            <ul className="border-t border-wds-border">
              {data.rows.map((row) => (
                <ItemRow key={row.inventoryItemId} row={row} list={list} onSetSupplier={setPicking} />
              ))}
            </ul>
          ) : null}
        </>
      )}
      <SetSupplierSheet itemName={picking?.name ?? null} suppliers={suppliers.data?.suppliers ?? []} saving={link.saving} failure={link.failure?.message ?? null} onPick={(id) => void onPickSupplier(id)} onClose={() => { setPicking(null); link.clear(); }} />
    </PhoneScreen>
  );
}
