'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import type { CountReasonValue } from '../../types/count';
import { COUNT_REASON_LABEL } from './stock-format';

/**
 * The one reason control (plan §7 Q-3): a preset list + "Other (describe)",
 * identical on Verify, Spot count and (Session 3) the branch day. Desktop
 * `1D7W-0` (list open) / `1DAK-0` ("Other" chosen). "Other" reveals a note
 * field (required — the server refuses "Other" without one).
 */
/** `1DAK-0`: the note counts to 120 characters. */
const NOTE_MAX = 120;
const REASONS: CountReasonValue[] = ['SUSPECTED_MISCOUNT', 'UNLOGGED_SPOILAGE', 'SUSPECTED_LOSS', 'WITHIN_NORMAL_RANGE', 'OTHER'];

export interface CountReasonControlProps {
  reason: CountReasonValue | null;
  note: string | null;
  onChange: (reason: CountReasonValue, note: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Mobile draws a 38px trigger at full width; desktop 34px at 320px. */
  mobile?: boolean;
  label: string;
  /** `1BC1-0` draws the spot-count reason label in amber; Verify's is blue (red when missing). */
  labelTone?: 'info' | 'warning';
  ariaLabel: string;
}

export function CountReasonControl({ reason, note, onChange, disabled, invalid, mobile = false, label, labelTone = 'info', ariaLabel }: CountReasonControlProps) {
  const [draftNote, setDraftNote] = React.useState(note ?? '');
  React.useEffect(() => setDraftNote(note ?? ''), [note]);
  // "Other" is held locally until it has a note — the server refuses it without one.
  const [pendingOther, setPendingOther] = React.useState(false);
  React.useEffect(() => setPendingOther(false), [reason]);
  const shown: CountReasonValue | null = pendingOther ? 'OTHER' : reason;
  const noteMissing = shown === 'OTHER' && draftNote.trim().length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn('font-wds-sans font-semibold', labelTone === 'warning' ? 'text-[12px]/4 tracking-[0.02em]' : 'text-[11px]/[14px]', invalid ? 'text-wds-error-fg' : labelTone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-info-fg')}>{label}</span>
      <Select
        value={shown ?? undefined}
        onValueChange={(v) => {
          if (v === 'OTHER' && draftNote.trim().length === 0) {
            setPendingOther(true);
            return;
          }
          setPendingOther(false);
          onChange(v as CountReasonValue, v === 'OTHER' ? draftNote.trim() : null);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          aria-invalid={invalid && !shown ? true : undefined}
          className={cn(
            'justify-between border-wds-border-strong bg-wds-surface font-wds-sans text-[13px]/4',
            mobile ? 'h-[38px] rounded-[4px] px-3' : 'h-[34px] w-[320px] rounded-wds-sm px-2.5',
            !shown && 'text-wds-text-faint',
          )}
        >
          <SelectValue placeholder="Select a reason…" />
        </SelectTrigger>
        <SelectContent className="motion-safe:duration-150">
          {REASONS.map((r) => (
            <SelectItem key={r} value={r} className="text-[13px]">
              {COUNT_REASON_LABEL[r]}
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
            if (next && next !== (note ?? '').trim()) onChange('OTHER', next);
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
