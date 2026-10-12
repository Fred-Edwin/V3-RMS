'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useLoader } from '../../../_shared/hooks/use-async';
import { roleLabel } from '@/components/app/shell/role-label';
import type { AppRole } from '@/types/auth';
import type { CarrierRef } from '../../_shared/types/dispatch-contract';
import { CARRIER_KIND_TEXT } from '../../lib/dispatch-words';
import { dispatchPhoneApi } from '../../services/dispatch-phone-api';

/** Who carries the delivery: a carrier from Settings (a vehicle, a person or a courier company) or a staff member (Paper "Training fixes" T1, T2). */
export type CarrierPick = { mode: 'carrier'; carrierId: string } | { mode: 'staff'; userId: string; name: string };

export interface CarrierChoiceProps {
  carriers: readonly CarrierRef[];
  value: CarrierPick;
  onChange: (pick: CarrierPick) => void;
  disabled?: boolean;
}

const rowBase = 'flex min-h-14 w-full items-center gap-3 border-b border-wds-border px-3.5 text-left outline-none last:border-b-0 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)]';

function Row({ name, line, selected, disabled, onPick }: { name: string; line: string; selected: boolean; disabled?: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onPick}
        className={cn(rowBase, selected ? 'bg-wds-espresso-50 shadow-[inset_3px_0_0_var(--wds-primary-btn-start)]' : 'bg-wds-surface active:bg-wds-neutral-50', 'disabled:opacity-60')}
      >
        <span className="flex min-w-0 grow flex-col">
          <span className={cn('truncate font-wds-sans text-[15px] leading-5 text-wds-text-ink', selected && 'font-semibold')}>{name}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{line}</span>
        </span>
        {selected ? (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0 text-wds-espresso-700">
            <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : null}
      </button>
    </li>
  );
}

export function CarrierChoice({ carriers, value, onChange, disabled }: CarrierChoiceProps) {
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);
  const [wantStaff, setWantStaff] = React.useState(value.mode === 'staff');
  const showStaff = wantStaff || value.mode === 'staff';
  const staff = useLoader(showStaff ? `carrier-staff:${debounced}` : null, () => dispatchPhoneApi.carrierStaff(debounced || undefined), 'We could not load the staff list.');

  const tab = (label: string, on: boolean, pick: () => void): React.ReactElement => (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      disabled={disabled}
      onClick={pick}
      className={cn(
        'flex h-12 grow basis-0 items-center justify-center font-wds-sans text-[15px] leading-5 outline-none transition-colors focus-visible:shadow-wds-ring disabled:opacity-60',
        on ? 'bg-wds-espresso-50 font-semibold text-wds-espresso-700 shadow-[inset_0_-3px_0_var(--wds-primary-btn-start)]' : 'bg-wds-surface text-wds-text-secondary',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div role="tablist" aria-label="Who carries it" className="flex border border-wds-border-strong">
        {tab('Carrier', !showStaff, () => setWantStaff(false))}
        <span className="w-px bg-wds-border-strong" aria-hidden="true" />
        {tab('Staff member', showStaff, () => setWantStaff(true))}
      </div>

      {!showStaff ? (
        <>
          {carriers.length === 0 ? null : (
            <ul role="radiogroup" aria-label="Carrier" className="flex max-h-[260px] flex-col overflow-y-auto border border-wds-border">
              {carriers.map((c) => (
                <Row key={c.id} name={c.name} line={CARRIER_KIND_TEXT[c.kind]} selected={value.mode === 'carrier' && value.carrierId === c.id} disabled={disabled} onPick={() => onChange({ mode: 'carrier', carrierId: c.id })} />
              ))}
            </ul>
          )}
          <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Carriers are vehicles, people and courier companies. The Store Manager keeps the list in Settings, Carriers.</p>
        </>
      ) : (
        <>
          <input
            type="search"
            autoComplete="off"
            aria-label="Search staff by name"
            placeholder="Search by name"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full border border-wds-border-strong bg-white px-3.5 font-wds-sans text-[15px] leading-5 text-wds-text-ink outline-none placeholder:text-wds-text-faint focus-visible:border-[var(--wds-primary-btn-start)] focus-visible:shadow-wds-ring"
          />
          {staff.status === 'error' ? (
            <p role="alert" className="font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
              {staff.error ?? 'We could not load the staff list.'}
            </p>
          ) : null}
          <ul role="radiogroup" aria-label="Staff member" className="flex max-h-[260px] flex-col overflow-y-auto border border-wds-border">
            {(staff.data?.staff ?? []).map((s) => (
              <Row key={s.id} name={s.name} line={roleLabel(s.role as AppRole)} selected={value.mode === 'staff' && value.userId === s.id} disabled={disabled} onPick={() => onChange({ mode: 'staff', userId: s.id, name: s.name })} />
            ))}
            {staff.status === 'ready' && (staff.data?.staff.length ?? 0) === 0 ? <li className="px-3.5 py-4 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No one by that name.</li> : null}
            {staff.status === 'loading' || staff.status === 'idle' ? <li className="px-3.5 py-4 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Loading…</li> : null}
          </ul>
          <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Anyone with a login at the Central Store or the company can carry a delivery. They are named on the dispatch and the delivery note.</p>
        </>
      )}
    </div>
  );
}
