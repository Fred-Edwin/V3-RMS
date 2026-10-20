'use client';

import * as React from 'react';

import { PadNumberInput } from '@/components/ui2/quantity-field';
import { Picker } from '@/components/ui2/picker';

import { Callout, ChoiceChips, FIELD_CLASS, FormField, WorkforcePinDialog } from '../../../_shared';
import { useIdempotencyKey } from '../../_shared/lib/idempotency';
import { ADJUST_CHIPS, leaveErrorText } from '../../_shared/lib/leave-copy';
import { leaveToast } from '../../_shared/lib/leave-toast';
import { leaveReads, leaveWrites } from '../../_shared/services/leave-services';
import type { AdjustPreview, AdjustReason } from '../../_shared/types/leave-types';
import { adjustBlocker, parseAdd } from '../lib/adjust-input';
import { AdjustFigures } from './adjust-figures';
import { PersonPicker, type PickedPerson } from './person-picker';

/**
 * Adjust a balance (spec Step 15): HR adds or takes off whole days for one person and one type, with a reason, a PIN, and the person
 * told. NOW and NEW come from the server's preview; a stale NOW (another adjustment landed) is replaced and the PIN is asked again.
 * `prefill` opens it from the drawer with the person already chosen and the focus on ADD.
 */
export function AdjustDialog({ open, onOpenChange, prefill, site, onAdjusted }: { open: boolean; onOpenChange: (open: boolean) => void; prefill?: { person: PickedPerson; typeCode?: string }; site: string | undefined; onAdjusted: () => void }) {
  const [person, setPerson] = React.useState<PickedPerson | null>(null);
  const [types, setTypes] = React.useState<{ code: string; label: string }[]>([]);
  const [typeCode, setTypeCode] = React.useState<string | null>(null);
  // The ADD box is the in-app number pad (digits only), so add and take off are a choice beside it; the sign is applied here.
  const [digits, setDigits] = React.useState('');
  const [direction, setDirection] = React.useState<'add' | 'take'>('add');
  const addText = direction === 'take' && digits ? `-${digits}` : digits;
  const [reason, setReason] = React.useState<AdjustReason | null>(null);
  const [note, setNote] = React.useState('');
  const [preview, setPreview] = React.useState<AdjustPreview | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [stale, setStale] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const key = useIdempotencyKey();
  const addRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPerson(prefill?.person ?? null);
    setTypeCode(prefill?.typeCode ?? null);
    setDigits('');
    setDirection('add');
    setReason(null);
    setNote('');
    setPreview(null);
    setStale(false);
    setError(undefined);
    key.fresh();
    // Resets once per opening; `prefill` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The kinds of leave the person has days in (and any HR may grant), from the same read the drawer uses.
  React.useEffect(() => {
    if (!open || !person) { setTypes([]); return; }
    let cancelled = false;
    leaveReads.drawer(person.id).then(
      (d) => {
        if (cancelled) return;
        const list = d.cards.map((c) => ({ code: c.typeCode, label: c.label }));
        setTypes(list);
        setTypeCode((current) => (current && list.some((t) => t.code === current) ? current : list[0]?.code ?? null));
      },
      () => { if (!cancelled) setTypes([]); }
    );
    return () => { cancelled = true; };
  }, [open, person]);

  const add = parseAdd(addText);
  React.useEffect(() => {
    if (!person || !typeCode) { setPreview(null); return; }
    let cancelled = false;
    setPreviewing(true);
    const timer = window.setTimeout(() => {
      leaveWrites.adjustPreview({ employeeId: person.id, typeCode, ...(add.kind === 'ok' ? { add: add.value } : {}) }).then(
        (p) => { if (!cancelled) { setPreview(p); setPreviewing(false); } },
        () => { if (!cancelled) { setPreview(null); setPreviewing(false); } }
      );
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // `add` is derived from addText; depending on the text keeps the dependency list stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, typeCode, addText]);

  React.useEffect(() => { if (open && prefill) window.setTimeout(() => addRef.current?.focus(), 50); }, [open, prefill]);

  const blocker = adjustBlocker({ hasPerson: Boolean(person), hasType: Boolean(typeCode), add, hasReason: Boolean(reason), otherNeedsNote: reason === 'OTHER' && !note.trim() });
  const previewErrors = preview?.errors.map((e) => e.message) ?? [];

  const submit = async (pin: string): Promise<void> => {
    if (blocker || !person || !typeCode || !reason || add.kind !== 'ok') { setError(blocker ?? 'Fill in the details first.'); return; }
    setBusy(true);
    setError(undefined);
    try {
      const result = await leaveWrites.adjust({ employeeId: person.id, typeCode, add: add.value, reasonCode: reason, ...(note.trim() ? { note: note.trim() } : {}), pin, ...(preview ? { expectedNow: preview.now } : {}) }, key.current());
      onOpenChange(false);
      leaveToast(`${person.name}, ${person.roleLabel}: ${preview?.typeLabel.toLowerCase() ?? 'leave'} is now ${result.after} ${result.after === 1 ? 'day' : 'days'}.`);
      onAdjusted();
    } catch (err) {
      const e = leaveErrorText(err, 'Could not adjust. Nothing was changed. Try again.');
      if (e.code === 'BALANCE_CHANGED') {
        setStale(true);
        key.fresh();
        const p = await leaveWrites.adjustPreview({ employeeId: person.id, typeCode, add: add.value }).catch(() => null);
        if (p) setPreview(p);
      }
      setError(e.text);
    } finally {
      setBusy(false);
    }
  };

  const told = preview?.told.map((t) => `${t.name}, ${t.label}`).join(' and ') ?? (person ? `${person.name}, ${person.roleLabel}` : 'The person');
  return (
    <WorkforcePinDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adjust a leave balance"
      summary={
        <div className="flex flex-col gap-4">
          {prefill ? <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{`${prefill.person.name} · ${prefill.person.roleLabel}`}</p> : <PersonPicker value={person} onChange={(p) => { key.fresh(); setPerson(p); }} site={site} />}
          {types.length > 0 ? (
            <FormField label="Leave type">
              {(ids) => <Picker id={ids.id} aria-label="Leave type" value={typeCode ?? ''} onValueChange={(v) => { key.fresh(); setTypeCode(v); }} options={types.map((t) => ({ value: t.code, label: t.label }))} className="h-9" />}
            </FormField>
          ) : null}
          <AdjustFigures
            now={preview?.now ?? null}
            next={preview?.new ?? null}
            loading={previewing && !preview}
            input={<PadNumberInput label={direction === 'take' ? 'Days to take off' : 'Days to add'} decimal={false} maxLength={2} aria-invalid={add.kind === 'invalid'} inputRef={(node) => { addRef.current = node; }} value={digits} onChange={(v) => { key.fresh(); setDigits(v); }} className="h-10 w-full border-wds-text-ink px-3 font-wds-mono text-[16px] leading-5" />}
          />
          <ChoiceChips legend="Add or take off" legendStyle="caps" size="sm" value={direction} onChange={(v) => { key.fresh(); setDirection(v as 'add' | 'take'); }} options={[{ value: 'add', label: 'Add days' }, { value: 'take', label: 'Take days off' }]} />
          {add.kind === 'invalid' ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{add.message}</p> : null}
          {previewErrors.map((m) => <p key={m} role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{m}</p>)}
          {stale ? <Callout tone="warning" size="sm" role="alert">This balance changed a moment ago. Check the new figure.</Callout> : null}
          <ChoiceChips legend="Why? (required)" legendStyle="sentence" size="sm" options={ADJUST_CHIPS} value={reason} onChange={(v) => { key.fresh(); setReason(v as AdjustReason); }} />
          {reason === 'OTHER' ? (
            <FormField label="A short note (needed for Other)" error={!note.trim() ? 'Say why, in a few words.' : undefined}>
              {(ids) => <input id={ids.id} aria-describedby={ids.describedBy} aria-invalid={ids.invalid} autoComplete="off" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={FIELD_CLASS} />}
            </FormField>
          ) : null}
          {blocker ? <p role="status" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{blocker}</p> : null}
        </div>
      }
      pinLabel="Your PIN, to sign the change"
      caption={`${told} ${preview?.told.length === 1 || !preview ? 'is' : 'are'} told. This is recorded in the audit log: ${preview ? `${preview.now} d to ${preview.new} d` : 'the change'}, the reason, your name and the time. Nothing already taken is changed.`}
      onSubmit={submit}
      submitting={busy}
      error={error}
      confirmLabel="Adjust balance"
    />
  );
}
