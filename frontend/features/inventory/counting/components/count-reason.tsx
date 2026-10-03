'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import type { CountReasonValue } from '../types/count';
import { COUNT_REASON_LABEL } from '../../_shared/components/stock-format';

/**
 * The one reason control (plan §7 Q-3): a preset list + "Other (describe)",
 * identical on Verify, Spot count and (Session 3) the branch day. Desktop
 * `1D7W-0` (list open) / `1DAK-0` ("Other" chosen). "Other" reveals a note
 * field (required — the server refuses "Other" without one).
 */
/** `1DAK-0`: the note counts to 120 characters. */
const NOTE_MAX = 120;
const COUNT_REASONS: CountReasonValue[] = ['SUSPECTED_MISCOUNT', 'UNLOGGED_SPOILAGE', 'SUSPECTED_LOSS', 'WITHIN_NORMAL_RANGE', 'OTHER'];

export interface ReasonOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Generic over the reason set: the Central Store uses `CountReason` (default),
 * the branch day passes its own `GapReason` options (Session 3) — same control,
 * same "Other needs a note" rule (plan §7 Q-3).
 */
export interface CountReasonControlProps<T extends string = CountReasonValue> {
  reason: T | null;
  note: string | null;
  onChange: (reason: T, note: string | null) => void;
  /** Defaults to the Central Store count reasons. The set must include an `OTHER` value. */
  options?: ReasonOption<T>[];
  disabled?: boolean;
  invalid?: boolean;
  /** Mark an empty select itself invalid (red border). The branch day draws the label red but keeps the field neutral until closing. Default true. */
  flagEmpty?: boolean;
  /** Desktop trigger at 32px instead of 34 — the branch day artboards (`1E13-0`) draw the select tighter than the Central Store's. */
  compact?: boolean;
  /** `mono` = the branch day's mobile label (`1E8C-0`: Geist Mono 400, all caps). Default sans 600. */
  labelFont?: 'sans' | 'mono';
  /** Mobile draws a 38px trigger at full width; desktop 34px at 320px. */
  mobile?: boolean;
  label: string;
  /** `1BC1-0` draws the spot-count reason label in amber; Verify's is blue (red when missing). */
  labelTone?: 'info' | 'warning';
  ariaLabel: string;
}

export function CountReasonControl<T extends string = CountReasonValue>({ reason, note, onChange, options, disabled, invalid, flagEmpty = true, compact = false, labelFont = 'sans', mobile = false, label, labelTone = 'info', ariaLabel }: CountReasonControlProps<T>) {
  const choices = (options ?? COUNT_REASONS.map((r) => ({ value: r, label: COUNT_REASON_LABEL[r] }))) as ReasonOption<T>[];
  const [draftNote, setDraftNote] = React.useState(note ?? '');
  React.useEffect(() => setDraftNote(note ?? ''), [note]);
  // "Other" is held locally until it has a note — the server refuses it without one.
  const [pendingOther, setPendingOther] = React.useState(false);
  React.useEffect(() => setPendingOther(false), [reason]);
  const shown: T | null = pendingOther ? ('OTHER' as T) : reason;
  const noteMissing = shown === 'OTHER' && draftNote.trim().length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn(labelFont === 'mono' ? 'font-wds-mono tracking-[0.04em]' : 'font-wds-sans font-semibold', labelTone === 'warning' ? 'text-[12px]/4 tracking-[0.02em]' : 'text-[11px]/[14px]', invalid ? 'text-wds-error-fg' : labelTone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-info-fg')}>{label}</span>
      <Select
        value={shown ?? undefined}
        onValueChange={(v) => {
          if (v === 'OTHER' && draftNote.trim().length === 0) {
            setPendingOther(true);
            return;
          }
          setPendingOther(false);
          onChange(v as T, v === 'OTHER' ? draftNote.trim() : null);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          aria-invalid={invalid && flagEmpty && !shown ? true : undefined}
          className={cn(
            'justify-between border-wds-border-strong bg-wds-surface font-wds-sans text-[13px]/4',
            mobile ? 'h-[38px] !rounded-[4px] px-3' : cn(compact ? 'h-8' : 'h-[34px]', 'w-[320px] rounded-wds-sm px-2.5'),
            !shown && 'text-wds-text-faint',
          )}
        >
          <SelectValue placeholder="Select a reason…" />
        </SelectTrigger>
        <SelectContent className="motion-safe:duration-150">
          {choices.map((r) => (
            <SelectItem key={r.value} value={r.value} className="text-[13px]">
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {shown === 'OTHER' ? (
        <input
          type="text"
          value={draftNote}
          maxLength={NOTE_MAX}
          disabled={disabled}
          placeholder="Describe the reason…"
          aria-label={`${ariaLabel} — describe`}
          aria-invalid={noteMissing && invalid ? true : undefined}
          onChange={(e) => setDraftNote(e.target.value)}
          onBlur={() => {
            const next = draftNote.trim();
            if (next && next !== (note ?? '').trim()) onChange('OTHER' as T, next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className={cn(
            'border bg-wds-surface font-wds-sans text-[13px]/4 text-wds-text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-wds-text-faint focus:border-wds-primary focus:shadow-wds-ring aria-[invalid=true]:border-wds-error-fg',
            mobile ? 'h-[38px] rounded-[4px] border-wds-border-strong px-3' : 'h-[34px] max-w-[560px] rounded-wds-sm border-wds-border-strong px-2.5',
          )}
        />
      ) : null}
      {shown === 'OTHER' ? (
        <span className={cn('font-wds-sans text-[11px]/[14px]', noteMissing && invalid ? 'text-wds-error-fg' : 'text-wds-text-copy-muted')}>
          Required for Other · {draftNote.length} / {NOTE_MAX}
        </span>
      ) : null}
    </div>
  );
}
