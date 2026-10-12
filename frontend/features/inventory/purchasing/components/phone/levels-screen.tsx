'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { B2Header, PagerBar } from '../../../_shared/components/block2-phone-parts';
import { PhoneFilterSelect } from '../../../_shared/components/phone-filter-select';
import { useAttendantData } from '../../hooks/use-attendant';
import { qty } from '../../lib/format';
import type { RestockLevelRow } from '../../types/attendant';
import { PURCHASING } from './order-cards';
import { useUrlParams } from './gate';
import { HeaderSearch, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, useDebouncedQuery, useGoBack, withRole } from './phone-kit';

const PAGE_SIZE = 20;
type Status = 'OUT' | 'LOW' | 'OK';

const TONE: Record<Status, { text: string; fill: string }> = {
  OUT: { text: 'text-wds-error-fg', fill: 'bg-wds-error-fg' },
  LOW: { text: 'text-wds-warning-fg', fill: 'bg-wds-warning-fg' },
  OK: { text: 'text-wds-success-fg', fill: 'bg-wds-success-fg' },
};

function Row({ row }: { row: RestockLevelRow }) {
  const tone = TONE[row.status];
  const percent = Math.round(Math.min(1, Math.max(0, row.fill)) * 100);
  return (
    <li className="flex flex-col gap-[7px] border-b border-wds-border px-5 py-[11px]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{row.name}</p>
        <p className={cn('shrink-0 font-wds-mono text-[12px] leading-4', tone.text)}>
          {Number.parseFloat(row.onHand) < 0 ? '0' : qty(row.onHand)} / {qty(row.level)} {row.usageUnit}
          <span className="sr-only">{row.status === 'OUT' ? ', out of stock' : row.status === 'LOW' ? ', running low' : ', fine'}</span>
        </p>
      </div>
      <div aria-hidden="true" className="h-1 bg-wds-neutral-100">
        <div className={cn('h-1', tone.fill)} style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}

/** 28P: what the hub holds against when to reorder it; read only, the Store Manager sets the levels. */
export function LevelsScreen() {
  const back = useGoBack(PURCHASING, { parent: true });
  const { params, set } = useUrlParams();
  const status = (['OUT', 'LOW', 'OK'].includes(params.get('status') ?? '') ? params.get('status') : undefined) as Status | undefined;
  const supplierId = params.get('supplier') ?? undefined;
  const q = (params.get('q') ?? '').trim();
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1);
  const [text, setText] = useDebouncedQuery(params.get('q') ?? '', (value) => set({ q: value.trim() || null, page: null }));
  const { data, status: load, error, reload } = useAttendantData(`attendant:levels:${status ?? ''}:${supplierId ?? ''}:${q}:${page}`, (s) => s.getRestockLevels({ status, supplierId, q: q || undefined, page, pageSize: PAGE_SIZE }), 'We could not load the restock levels.');
  const filtered = Boolean(status || supplierId || q);

  return (
    <PhoneScreen
      header={
        <B2Header title="Restock levels" subtitle={`What we hold against when to reorder. Levels are set by ${withRole(data?.setBy)}.`} leading="back" onBack={back} place="HUB">
          <HeaderSearch value={text} onChange={setText} placeholder="Search an item or supplier" label="Search restock levels" />
        </B2Header>
      }
      bar={data && data.total > PAGE_SIZE ? <PagerBar bar page={data.page} pageSize={data.pageSize} total={data.total} shown={data.rows.length} onPage={(p) => set({ page: p === 1 ? null : String(p) })} noun="" /> : undefined}
    >
      <div className="flex shrink-0 gap-2 bg-wds-canvas px-5 py-3">
        <PhoneFilterSelect
          label="Status"
          options={[
            { value: 'OUT', label: 'Out' },
            { value: 'LOW', label: 'Low' },
            { value: 'OK', label: 'Fine' },
          ]}
          value={status}
          onChange={(v) => set({ status: v ?? null, page: null })}
        />
        <PhoneFilterSelect label="Supplier" options={(data?.suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))} value={supplierId} onChange={(v) => set({ supplier: v ?? null, page: null })} />
      </div>
      {load === 'loading' || load === 'idle' ? (
        <PhoneLoading rows={6} label="Loading restock levels" />
      ) : (
        <>
          {load === 'error' ? <PhoneError className="mx-5 mb-3" onRetry={() => void reload()} message={error} /> : null}
          {data && data.rows.length === 0 ? (
            filtered ? (
              <PhoneEmpty title={q ? `No match for "${q}"` : 'No items match'} line="Check the spelling or change the filters." action={{ label: 'Clear filters', onClick: () => { setText(''); set({ status: null, supplier: null, q: null, page: null }); } }} />
            ) : (
              <PhoneEmpty title="No restock levels set" line={`Levels are set in Catalog by ${withRole(data.setBy)}.`} />
            )
          ) : null}
          {data && data.rows.length > 0 ? (
            <div className="border-t border-wds-border bg-white">
              <div className="flex items-center justify-between border-b border-wds-border-strong px-5 pb-1.5 pt-3 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                <span>Item</span>
                <span>On hand / reorder at</span>
              </div>
              <ul>
                {data.rows.map((row) => (
                  <Row key={row.inventoryItemId} row={row} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </PhoneScreen>
  );
}
