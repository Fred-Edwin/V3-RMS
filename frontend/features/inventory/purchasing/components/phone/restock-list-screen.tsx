'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { useAttendantData } from '../../hooks/use-attendant';
import { kes, qty } from '../../lib/format';
import { useRestockList, type ListLine } from '../../store/restock-list-store';
import type { NeedsGroup, NeedsLine } from '../../types';
import { PURCHASING } from './order-cards';
import { useUrlParams } from './gate';
import { FilterChips, HeaderSearch, HIT, Label, PhoneBar, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, PrimaryButton, StatusLine, plural, useDebouncedQuery, useGoBack } from './phone-kit';

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
      <button type="button" onClick={onAdd} aria-label={`Add ${suggested} ${buyUnit} of ${name} to your list`} className={cn(HIT, 'flex h-9 w-28 shrink-0 items-center justify-center gap-1.5 border border-wds-border-strong bg-white font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink outline-none focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:bg-wds-neutral-50')}>
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

function Row({ entry, list }: { entry: Entry; list: ReturnType<typeof useRestockList> }) {
  const { line, supplier } = entry;
  const onList = list.get(line.inventoryItemId);
  const out = line.status === 'OUT';
  const unit = line.usageUnit;
  const suggested = line.suggestedQty ? qty(line.suggestedQty) : '1';
  return (
    <li className={cn('flex items-center justify-between gap-3 border-b border-wds-border px-5 py-3', onList ? 'bg-wds-espresso-50' : 'bg-white')}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{line.itemName}</p>
        <StatusLine tone={out ? 'error' : 'warning'}>{line.onHand !== undefined && line.level !== undefined ? `${qty(line.onHand)} left · reorder at ${qty(line.level)} ${unit}` : out ? 'Out of stock' : 'Running low'}</StatusLine>
        <p className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{supplier ? `${supplier.name}${line.lastPrice ? ` · KES ${kes(line.lastPrice)} each` : ''}` : 'No supplier yet'}</p>
      </div>
      <AddOrStepper
        name={line.itemName}
        onList={Boolean(onList)}
        buyUnit={line.buyUnit ?? unit}
        suggested={suggested}
        qtyValue={onList?.qty ?? suggested}
        onAdd={() => list.add(toListLine(entry))}
        onSet={(n) => list.setQty(line.inventoryItemId, n)}
      />
    </li>
  );
}

/** 28B: build the restock list: every item that is out or low, with the amount that brings it back to its level. */
export function RestockListScreen() {
  const back = useGoBack(PURCHASING);
  const { params, set } = useUrlParams();
  const list = useRestockList();
  const view = (['all', 'out', 'low', 'supplier'].includes(params.get('view') ?? '') ? params.get('view') : 'all') as View;
  const [text, setText] = useDebouncedQuery(params.get('q') ?? '', (q) => set({ q: q || null }));
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const { data, status, error, reload } = useAttendantData('attendant:needs', (s) => s.getNeedsRestocking({ group: 'supplier' }), 'We could not load the restock list.');

  const all = React.useMemo(() => (data ? flatten(data.groups).sort(byUrgency) : []), [data]);
  const matches = React.useMemo(() => all.filter((e) => !q || e.line.itemName.toLowerCase().includes(q) || (e.supplier?.name.toLowerCase().includes(q) ?? false)), [all, q]);
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
                      <Row key={e.line.inventoryItemId} entry={e} list={list} />
                    ))}
                  </ul>
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
                      <Row key={e.line.inventoryItemId} entry={e} list={list} />
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
                      <Row key={e.line.inventoryItemId} entry={e} list={list} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </PhoneScreen>
  );
}
