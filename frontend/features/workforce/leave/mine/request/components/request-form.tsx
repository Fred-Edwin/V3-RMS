'use client';

import * as React from 'react';

import { DateRangePicker, type DateRange } from '@/components/ui2/date-range-picker';

import { Callout, ChoiceChips, FIELD_CLASS, FormField, PhoneButton } from '../../../../_shared';
import { leaveErrorText, waitingOn } from '../../../_shared/lib/leave-copy';
import { addDays, dayLong, mondayOf, nairobiToday, rangeLong } from '../../../_shared/lib/leave-dates';
import { useIdempotencyKey } from '../../../_shared/lib/idempotency';
import { leaveWrites } from '../../../_shared/services/leave-services';
import type { RequestableType, WriteResult } from '../../../_shared/types/leave-types';
import { useRequestPreview } from '../hooks/use-request-preview';
import { ShortfallBlock } from './shortfall-block';

const NOTE_MAX = 300;
const DRAFT_KEY = 'wendo.leave.request-draft';

interface Draft {
  typeCode: string | null;
  start: string | null;
  end: string | null;
}

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(draft: Draft | null): void {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* Private window or blocked storage: the form works without it. */
  }
}

/**
 * Ask for leave (spec Step 2b, 8): type chips, the standard range picker, the summary the server worked out, the tight-days line (a
 * yes or no, never numbers), the unpaid-tail choice when the days are short, the reason or note, and Send. Every change asks the
 * server for a preview first; Send needs a server answer, so it is disabled with the reason when offline. One idempotency key per
 * intent, so a double tap sends one request.
 */
export function RequestForm({ chips, initial, online, onSent, onOpenExisting }: { chips: readonly RequestableType[]; initial?: { typeCode?: string; start?: string; end?: string }; online: boolean; onSent: (result: WriteResult, sentTo: string) => void; onOpenExisting?: (id: string) => void }) {
  const today = nairobiToday();
  const [typeCode, setTypeCode] = React.useState<string | null>(initial?.typeCode ?? chips[0]?.code ?? null);
  const [range, setRange] = React.useState<DateRange | null>(initial?.start && initial.end ? { from: initial.start, to: initial.end } : null);
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [failure, setFailure] = React.useState<{ code: string; text: string } | null>(null);
  const key = useIdempotencyKey();

  // The dates of an earlier visit are kept for this visit only (spec: sessionStorage); an explicit link wins.
  React.useEffect(() => {
    if (initial?.start) return;
    const draft = readDraft();
    if (draft?.start && draft.end && draft.start >= today) setRange({ from: draft.start, to: draft.end });
    if (draft?.typeCode && chips.some((c) => c.code === draft.typeCode) && !initial?.typeCode) setTypeCode(draft.typeCode);
    // Runs once on open; `chips` and `initial` do not change under the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => writeDraft({ typeCode, start: range?.from ?? null, end: range?.to ?? null }), [typeCode, range]);

  const type = chips.find((c) => c.code === typeCode) ?? null;
  const previewState = useRequestPreview(typeCode, range?.from ?? null, range?.to ?? null);
  const preview = previewState.status === 'ready' ? previewState.preview : null;
  const short = preview?.errors.find((e) => e.code === 'BALANCE_TOO_LOW') ?? null;
  const overlap = preview?.errors.find((e) => e.code === 'OVERLAP') ?? null;
  const otherErrors = preview?.errors.filter((e) => e.code !== 'BALANCE_TOO_LOW' && e.code !== 'OVERLAP') ?? [];
  const needsReason = Boolean(type?.requiresReason);

  const changed = (): void => {
    key.fresh();
    setFailure(null);
  };
  const quick = (from: string, to: string): void => {
    changed();
    setRange({ from, to });
  };
  const nextMonday = addDays(mondayOf(today), 7);

  const disabledReason = !online ? 'No connection.' : !range ? 'Pick the days first.' : previewState.status === 'loading' ? 'Checking those days…' : needsReason && !note.trim() ? 'Add why.' : preview && preview.errors.length > 0 ? null : null;
  const canSend = Boolean(type && range && preview && preview.errors.length === 0 && !disabledReason && !sending);

  const send = async (tail: number): Promise<void> => {
    if (!type || !range) return;
    setSending(true);
    setFailure(null);
    try {
      const result = await leaveWrites.ask({ typeCode: type.code, start: range.from, end: range.to, ...(tail > 0 ? { unpaidTailDays: tail } : {}), ...(note.trim() ? { note: note.trim() } : {}) }, key.current());
      writeDraft(null);
      key.fresh();
      onSent(result, waitingOn(preview?.sendTo ?? null));
    } catch (err) {
      const e = leaveErrorText(err, 'Could not send. Nothing was saved. Try again.');
      setFailure({ code: e.code, text: e.text });
    } finally {
      setSending(false);
    }
  };

  const chipOptions = chips.map((c) => ({ value: c.code, label: c.code === typeCode && c.left !== null ? `${c.label} · ${c.left} left` : c.label }));

  return (
    <div className="flex flex-col gap-3.5">
      <ChoiceChips legend="Kind of leave" legendStyle="caps" options={chipOptions} value={typeCode} onChange={(v) => { changed(); setTypeCode(v); }} />

      <div className="flex flex-col gap-2.5 border border-wds-border-strong bg-wds-surface p-3.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-[44px] border border-wds-border-strong px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring" onClick={() => quick(addDays(today, 1), addDays(today, 1))}>
            Tomorrow
          </button>
          <button type="button" className="min-h-[44px] border border-wds-border-strong px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring" onClick={() => quick(nextMonday, addDays(nextMonday, 6))}>
            Next week
          </button>
        </div>
        <DateRangePicker
          value={range}
          today={today}
          onChange={(r) => { changed(); setRange(r); }}
          minDate={today}
          maxDate={`${today.slice(0, 4)}-12-31`}
          label="Pick a date or range"
          note="Earlier dates can't be picked. Every calendar day counts."
          sheet
        />
      </div>

      {range ? (
        <div className="flex flex-col gap-0.5" role="status">
          <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{`${rangeLong(range.from, range.to)} · ${preview ? preview.days : '…'} ${preview?.days === 1 ? 'day' : 'days'}`}</span>
          {preview && preview.errors.length === 0 ? (
            <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
              {`Back at work ${dayLong(preview.returnOn)}${preview.leftAfter !== null ? ` · ${preview.leftAfter} ${preview.leftAfter === 1 ? 'day' : 'days'} left after this` : ''}`}
            </span>
          ) : null}
          {type?.approvedBy === 'HR' ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">HR decides this one.</span> : null}
        </div>
      ) : null}

      {previewState.status === 'failed' ? <Callout tone="error" size="sm" role="alert">{previewState.text}</Callout> : null}
      {overlap ? (
        <Callout tone="error" size="sm" role="alert" action={onOpenExisting && typeof overlap.details?.id === 'string' ? <button type="button" className="font-wds-sans text-[13px] font-medium text-wds-primary underline" onClick={() => onOpenExisting(String(overlap.details?.id))}>Open it</button> : undefined}>
          {overlap.details?.start && overlap.details?.end ? `You already have leave on ${rangeLong(String(overlap.details.start), String(overlap.details.end))}.` : overlap.message}
        </Callout>
      ) : null}
      {otherErrors.map((e) => <Callout key={e.code} tone="error" size="sm" role="alert">{e.message}</Callout>)}

      {preview?.tight && preview.errors.length === 0 ? (
        <Callout tone="warning" size="sm">{`Those days are tight for your team. ${waitingOn(preview.sendTo).replace(/^your /, 'Your ')} will see this when deciding. You can still send it.`}</Callout>
      ) : null}
      {preview?.sickNote && type ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{`A sick note is needed after ${type.sickNoteAfterDays} days. Show it to ${waitingOn(preview.sendTo)}.`}</p> : null}

      {short && type ? (
        <ShortfallBlock type={type} days={preview?.days ?? 0} left={type.left ?? 0} suggestedTail={preview?.suggestedTail ?? 0} tailAllowed={Boolean(preview?.tailAllowed)} paid={type.paid} sending={sending} disabled={!online || sending} onSendWithTail={() => send(preview?.suggestedTail ?? 0)} onChangeDates={() => { changed(); setRange(null); }} />
      ) : (
        <>
          {type ? (
            <FormField label={needsReason ? `Why? (needed for ${type.label.toLowerCase()})` : `A note for ${waitingOn(preview?.sendTo ?? null)} (optional)`} helper={note.length >= 250 ? `${note.length} of ${NOTE_MAX}` : undefined}>
              {(ids) => <textarea id={ids.id} aria-describedby={ids.describedBy} autoComplete="off" rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => { changed(); setNote(e.target.value); }} className={`${FIELD_CLASS} h-auto resize-none py-2`} />}
            </FormField>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <PhoneButton size="sm" disabled={!canSend} aria-busy={sending} onClick={() => send(0)}>
              {sending ? 'Sending…' : `Send to ${waitingOn(preview?.sendTo ?? null)}`}
            </PhoneButton>
            {disabledReason ? <p className="m-0 text-center font-wds-sans text-[12px] leading-4 text-wds-text-secondary" role="status">{disabledReason}</p> : null}
          </div>
        </>
      )}
      {failure ? <Callout tone="error" size="sm" role="alert">{failure.text}</Callout> : null}
    </div>
  );
}
