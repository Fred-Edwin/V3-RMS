'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { formatApiErrorMessage } from '@/types/api';

import { AddChip, DISABLED, FOCUS_RING, MOTION, PRESSED, RemovableChip, onHover } from '../../../../_shared';
import { orgWrites } from '../services/org-services';
import type { PositionView } from '../types/org-types';

/**
 * "Positions in it · pick or add" (Paper Chapter 3 step 05): chosen positions are dark chips with ×, the others are outlined chips to
 * tap, and "+ New position" adds a plain one (clocks in, casuals allowed) that can be refined on the Positions tab. Positions are
 * company-wide, so only someone who may write them (`canCreate`) sees the add chip.
 */
export function PositionChips({
  options,
  selected,
  onChange,
  onCreated,
  canCreate,
  disabled = false,
  legend = 'Positions in it',
}: {
  options: readonly { id: string; name: string; isActive: boolean }[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** Called with a position made here, so the parent can list it. */
  onCreated?: (position: PositionView) => void;
  canCreate: boolean;
  disabled?: boolean;
  /** The words before "· pick or add"; departments reuse the chips ("Offered by"). */
  legend?: string;
}) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const chosen = new Set(selected);

  const create = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const made = await orgWrites.createPosition({ name: trimmed, defaultTracksTime: true, loginRole: null, casualsAllowed: true, departmentIds: [] });
      onCreated?.(made);
      onChange([...selected, made.id]);
      setName('');
      setAdding(false);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'The position was not added.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span id="position-chips-label" className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">
        {legend} <span className="font-normal text-wds-text-secondary">· pick{canCreate ? ' or add' : ''}</span>
      </span>
      <div role="group" aria-labelledby="position-chips-label" className="flex flex-wrap gap-2">
        {options.filter((p) => chosen.has(p.id)).map((p) => (
          <RemovableChip key={p.id} label={p.name} disabled={disabled} onRemove={() => onChange(selected.filter((id) => id !== p.id))} />
        ))}
        {options.filter((p) => !chosen.has(p.id) && p.isActive).map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            aria-pressed={false}
            onClick={() => onChange([...selected, p.id])}
            className={cn('inline-flex items-center border border-wds-border-strong px-2.5 py-[5px] font-wds-sans text-[13px] leading-4 text-wds-text-ink', MOTION, FOCUS_RING, PRESSED, DISABLED, onHover('bg-wds-neutral-50'))}
          >
            {p.name}
          </button>
        ))}
        {canCreate && !adding ? <AddChip disabled={disabled} onClick={() => setAdding(true)}>+ New position</AddChip> : null}
      </div>
      {adding ? (
        <div className="flex items-center gap-2">
          <input
            aria-label="Name of the new position"
            value={name}
            autoFocus
            autoComplete="off"
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="h-9 min-w-0 flex-1 border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[14px] text-wds-text-ink outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
          />
          <button type="button" disabled={busy || name.trim() === ''} onClick={() => void create()} className={cn('h-9 border border-wds-border-strong px-3.5 font-wds-sans text-[13px] text-wds-text-ink', MOTION, FOCUS_RING, DISABLED, onHover('bg-wds-neutral-50'))}>
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setAdding(false); setName(''); setError(null); }} className={cn('h-9 px-2 font-wds-sans text-[13px] text-wds-text-secondary', MOTION, FOCUS_RING, DISABLED)}>
            Cancel
          </button>
        </div>
      ) : null}
      {error ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{error}</p> : null}
    </div>
  );
}
