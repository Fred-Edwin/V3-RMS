'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { ErrorState } from '@/components/app/shell/shell-states';
import { DrawerShell } from '../../../_shared/components/drawer-shell';
import { useAction, useLoader } from '../../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { MonoLabel, PinField } from '../../../requisitions/components/req-parts';
import type { CheckCountResult, ConfirmPreview, CountLine, CountView } from '../../../deliveries/_shared/types/deliveries-contract';
import { COUNT_REASONS, COUNT_REASON_TEXT, PHOTO_MAX_BYTES, PHOTO_MAX_PER_LINE, PHOTO_MIME_TYPES, type CountReason, type PhotoRef } from '../../_shared/types/dispatch-contract';
import { differenceText, itemWord } from '../../../_shared/lib/block2-words';
import { errorText } from '../../lib/dispatch-words';
import { deliveriesDrawerApi } from '../../services/branch-side-api';
import { ChoiceChips } from './choice-chips';
import { PhotoStrip } from './photo-strip';

type Step = 'count' | 'recount' | 'reason' | 'summary' | 'pin';

const eyebrow = (reference: string, department: string, lines: number): string => `${reference} · ${department.toUpperCase()} · ${lines} LINES`;
const isCount = (value: string): boolean => /^\d+(\.\d{1,4})?$/.test(value.trim());

/**
 * Paper D19 and the D22 walk-through: the Branch Manager confirms a delivery nobody counted, for the department. The same blind count
 * as the phone (D8 to D11) in one drawer: count every line, the check flags a line that differs ("This doesn't match what was sent.
 * Count again."), the second count is final, a reason and photos for what still differs, a summary that finally shows the sent
 * figure, then the Branch Manager's own PIN. The record shows who really counted.
 */
export function ConfirmForDepartmentDrawer({ dispatchId, reference, departmentName, lineCount, leftAtLabel, open, onOpenChange, onConfirmed }: {
  dispatchId: string;
  reference: string;
  departmentName: string;
  lineCount: number;
  leftAtLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: (summary: string) => void;
}) {
  const view = useLoader<CountView>(open ? `count:${dispatchId}` : null, () => deliveriesDrawerApi.count(dispatchId), 'Could not load the delivery.');
  const [step, setStep] = React.useState<Step>('count');
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [lines, setLines] = React.useState<CountLine[]>([]);
  const [reasonIndex, setReasonIndex] = React.useState(0);
  const [preview, setPreview] = React.useState<ConfirmPreview | null>(null);
  const [pin, setPin] = React.useState('');
  const [photoMessage, setPhotoMessage] = React.useState<string | null>(null);
  const idem = useIdempotencyKey();
  const fileInput = React.useRef<HTMLInputElement>(null);

  const save = useAction((counts: { lineId: string; countedQty: string }[]) => deliveriesDrawerApi.save(dispatchId, { counts }), 'Could not save your counts. Try again.');
  const check = useAction(() => deliveriesDrawerApi.check(dispatchId), 'Could not check the counts. Try again.');
  const reason = useAction((lineId: string, value: CountReason, note?: string) => deliveriesDrawerApi.reason(dispatchId, lineId, { reason: value, note }), 'Could not save the reason. Try again.');
  const previewCall = useAction(() => deliveriesDrawerApi.preview(dispatchId), 'Could not build the summary. Try again.');
  const confirm = useAction((code: string) => deliveriesDrawerApi.confirm(dispatchId, { pin: code, onBehalf: true, idempotencyKey: idem.key() }), 'Could not confirm. Nothing was changed. Try again.');

  // A fresh walk each time the drawer opens; the loader refetches the view by its key.
  React.useEffect(() => {
    if (!open) return;
    setStep('count');
    setValues({});
    setTouched({});
    setReasonIndex(0);
    setPreview(null);
    setPin('');
    setPhotoMessage(null);
    idem.renew();
    save.clear();
    check.clear();
    confirm.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!view.data) return;
    setLines(view.data.lines);
    setValues((prev) => {
      const next = { ...prev };
      for (const l of view.data?.lines ?? []) if (next[l.lineId] === undefined && l.countedQty !== null) next[l.lineId] = l.countedQty;
      return next;
    });
  }, [view.data]);

  const flagged = lines.filter((l) => l.state === 'COUNT_AGAIN');
  const finalDiffs = lines.filter((l) => l.state === 'SHORT' || l.state === 'EXTRA');
  const counted = lines.filter((l) => (values[l.lineId] ?? '').trim() !== '' && isCount(values[l.lineId] ?? '')).length;
  const total = view.data?.lineCount ?? lineCount;
  const currentReasonLine = finalDiffs[reasonIndex];

  const setValue = (lineId: string, value: string): void => {
    setValues((v) => ({ ...v, [lineId]: value.replace(/[^\d.]/g, '') }));
    setTouched((t) => ({ ...t, [lineId]: true }));
  };
  const persist = async (ids?: string[]): Promise<boolean> => {
    const counts = lines.filter((l) => (!ids || ids.includes(l.lineId)) && isCount(values[l.lineId] ?? '')).map((l) => ({ lineId: l.lineId, countedQty: (values[l.lineId] ?? '').trim() }));
    if (counts.length === 0) return true;
    const result = await save.run(counts);
    if (result) setLines(result.lines);
    return result !== null;
  };

  const afterCheck = async (result: CheckCountResult): Promise<void> => {
    setLines(result.view.lines);
    const again = result.view.lines.filter((l) => l.state === 'COUNT_AGAIN');
    if (again.length > 0) {
      setTouched({});
      setStep('recount');
      return;
    }
    const diffs = result.view.lines.filter((l) => l.state === 'SHORT' || l.state === 'EXTRA');
    if (diffs.length > 0 && !result.reasonsComplete) {
      setReasonIndex(Math.max(0, diffs.findIndex((l) => l.reason === null)));
      setStep('reason');
      return;
    }
    await toSummary();
  };

  const toSummary = async (): Promise<void> => {
    const result = await previewCall.run();
    if (result) {
      setPreview(result);
      setStep('summary');
    }
  };

  const onPrimary = async (): Promise<void> => {
    if (step === 'count') {
      if (!(await persist())) return;
      const result = await check.run();
      if (result) await afterCheck(result);
    } else if (step === 'recount') {
      if (!(await persist(flagged.map((l) => l.lineId)))) return;
      const result = await check.run();
      if (result) await afterCheck(result);
    } else if (step === 'reason') {
      const line = currentReasonLine;
      if (!line || !line.reason) return;
      if (reasonIndex < finalDiffs.length - 1) setReasonIndex(reasonIndex + 1);
      else await toSummary();
    } else if (step === 'summary') {
      setStep('pin');
    } else if (step === 'pin') {
      const result = await confirm.run(pin);
      if (result) onConfirmed(`${result.matchedCount} of ${result.lineCount} lines match${result.discrepancies.length > 0 ? `. ${result.discrepancies.map((d) => d.reference).join(', ')} opened for the Store Manager.` : '. Their stock is updated.'}`);
      else setPin('');
    }
  };

  const chooseReason = async (line: CountLine, value: CountReason): Promise<void> => {
    const updated = await reason.run(line.lineId, value);
    if (updated) setLines((all) => all.map((l) => (l.lineId === updated.lineId ? updated : l)));
  };

  const addPhoto = async (line: CountLine, file: File | undefined): Promise<void> => {
    if (!file) return;
    setPhotoMessage(null);
    if (!(PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) return setPhotoMessage('Use a JPEG, PNG or WebP photo.');
    if (file.size > PHOTO_MAX_BYTES) return setPhotoMessage(errorText('PHOTO_TOO_LARGE', null));
    if (line.photos.length >= PHOTO_MAX_PER_LINE) return setPhotoMessage(errorText('TOO_MANY_PHOTOS', null));
    try {
      const result = await deliveriesDrawerApi.uploadPhoto(dispatchId, line.lineId, file);
      setLines((all) => all.map((l) => (l.lineId === result.lineId ? { ...l, photos: result.photos as PhotoRef[] } : l)));
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : null;
      setPhotoMessage(errorText(code, null, 'That photo could not be added. Try again.'));
    }
  };

  const busy = save.saving || check.saving || previewCall.saving || confirm.saving || reason.saving;
  const failure = save.failure ?? check.failure ?? previewCall.failure ?? confirm.failure ?? reason.failure;
  const failureText = failure && failure.code !== 'INVALID_PIN' ? (failure.code === 'ALREADY_CONFIRMED' ? `Someone from ${departmentName} already confirmed this delivery.` : errorText(failure.code, failure.message)) : null;

  const primary = (() => {
    switch (step) {
      case 'count':
      case 'recount':
        return { label: busy ? 'Checking…' : 'Check and confirm', disabled: busy || (step === 'count' ? counted < total : flagged.some((l) => !touched[l.lineId] || !isCount(values[l.lineId] ?? ''))) };
      case 'reason':
        return { label: reasonIndex < finalDiffs.length - 1 ? 'Save and go on' : 'Save and go on', disabled: busy || !currentReasonLine?.reason };
      case 'summary':
        return { label: 'Go to the PIN', disabled: busy };
      case 'pin':
        return { label: busy ? 'Confirming…' : `Confirm for ${departmentName}`, disabled: busy || pin.length !== 4 };
    }
  })();

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={step === 'pin' ? `Confirm ${departmentName}'s delivery` : `Confirm ${departmentName}'s delivery for them`}
      description={eyebrow(reference, departmentName, lineCount)}
      primaryLabel={primary.label}
      primaryDisabled={primary.disabled}
      onPrimaryAction={() => void onPrimary()}
      cancelLabel={step === 'summary' || step === 'pin' ? 'Back' : 'Cancel'}
      paper
      paperWidth={540}
      onCancel={() => {
        if (step === 'pin') setStep('summary');
        else if (step === 'summary') setStep(finalDiffs.length > 0 ? 'reason' : 'count');
        else onOpenChange(false);
      }}
    >
      {view.status === 'error' ? (
        <ErrorState title="Couldn't load this delivery" description="Check your connection and try again." onRetry={() => void view.reload()} />
      ) : !view.data ? (
        <div aria-hidden className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <>
          {failureText ? <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{failureText}</p> : null}

          {step === 'count' ? (
            <>
              <div className="flex flex-col gap-[3px] border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
                <p className="font-wds-sans text-[14px] font-semibold leading-5 text-wds-warning-fg">Nobody in {departmentName} has counted it yet</p>
                <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">It left at {leftAtLabel}. {departmentName}&apos;s day cannot close until it is confirmed. Count what is on the shelf; the number sent is not shown.</p>
              </div>
              <div className="border border-wds-neutral-950">
                <div className="flex items-center justify-between border-b border-wds-neutral-950 px-3.5 py-2.5">
                  <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink" aria-live="polite">{counted} of {total} counted</span>
                  <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Count each item as you find it</span>
                </div>
                <ul>
                  {lines.map((l) => (
                    <li key={l.lineId} className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-[9px] last:border-b-0 focus-within:bg-wds-caramel-100 focus-within:shadow-[inset_3px_0_0_0_var(--wds-primary-btn-start)]">
                      <div className="flex flex-col">
                        <label htmlFor={`count-${l.lineId}`} className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{l.itemName}</label>
                        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Count in {l.unit}</span>
                      </div>
                      <input
                        id={`count-${l.lineId}`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={values[l.lineId] ?? ''}
                        placeholder="—"
                        onChange={(event) => setValue(l.lineId, event.target.value)}
                        onBlur={() => void persist([l.lineId])}
                        className="h-9 w-[60px] border border-wds-border-strong bg-wds-surface text-center font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink outline-none placeholder:font-normal placeholder:text-wds-text-faint focus:border-wds-primary focus:shadow-wds-ring"
                      />
                    </li>
                  ))}
                </ul>
              </div>
              <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Counts save as you type. 0 is a count; an empty box is not. Signed by the Branch Manager, on behalf of {departmentName}. The record shows who really counted.</p>
            </>
          ) : null}

          {step === 'recount' ? (
            <>
              {flagged.map((l) => (
                <div key={l.lineId} className="flex flex-col gap-3 border border-wds-error-border bg-wds-error-bg p-4">
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor={`recount-${l.lineId}`} className="font-wds-sans text-[15px] font-medium text-wds-text-ink">{l.itemName}</label>
                    <input
                      id={`recount-${l.lineId}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={values[l.lineId] ?? ''}
                      autoFocus={l.lineId === flagged[0]?.lineId}
                      onChange={(event) => setValue(l.lineId, event.target.value)}
                      aria-describedby={`recount-hint-${l.lineId}`}
                      className="h-[46px] w-20 border border-wds-error-fg bg-wds-surface text-center font-wds-mono text-[18px] text-wds-text-ink outline-none focus:shadow-wds-ring"
                    />
                  </div>
                  <p id={`recount-hint-${l.lineId}`} role="alert" className="font-wds-sans text-[14px] leading-5 text-wds-error-fg">This doesn&apos;t match what was sent. Count again.</p>
                </div>
              ))}
              <p className="font-wds-sans text-[13px] text-wds-text-secondary">The sent figure is never shown here. Count the {flagged.length === 1 ? (flagged[0] ? itemWord(flagged[0].itemName) : 'item') : 'items'} again to go on.</p>
            </>
          ) : null}

          {step === 'reason' && currentReasonLine ? (
            <>
              <div className="flex flex-col gap-1">
                <h3 className="font-wds-sans text-[18px] font-semibold text-wds-text-ink">{currentReasonLine.itemName}: why is it different?</h3>
                <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Your second count, {currentReasonLine.countedQty}, is final. This line will be marked {currentReasonLine.state === 'SHORT' ? 'short' : 'extra'}.</p>
              </div>
              <ChoiceChips label="Why it is different" value={currentReasonLine.reason ?? ''} options={COUNT_REASONS.map((r) => ({ value: r, label: COUNT_REASON_TEXT[r] }))} onChange={(next) => void chooseReason(currentReasonLine, next)} disabled={busy} />
              <div className="flex flex-col gap-2">
                <MonoLabel>Photos (optional, up to 3)</MonoLabel>
                <PhotoStrip photos={currentReasonLine.photos} />
                <input ref={fileInput} type="file" accept={PHOTO_MIME_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-label="Add a photo" onChange={(event) => { void addPhoto(currentReasonLine, event.target.files?.[0]); event.target.value = ''; }} />
                <Button variant="secondary" className="h-10 w-fit border-dashed" onClick={() => fileInput.current?.click()} disabled={currentReasonLine.photos.length >= PHOTO_MAX_PER_LINE}>
                  Add a photo
                </Button>
                {photoMessage ? <p role="alert" className="font-wds-sans text-[13px] text-wds-error-fg">{photoMessage}</p> : null}
              </div>
            </>
          ) : null}

          {step === 'summary' && preview ? (
            <>
              <h3 className="font-wds-sans text-[18px] font-semibold text-wds-text-ink">
                {preview.lineCount} lines · {preview.matchingLines.length} match{preview.differingLines.length > 0 ? ` · ${differenceText(preview.differingLines.map((l) => l.direction))}` : ''}
              </h3>
              {preview.differingLines.map((l) => (
                <div key={l.lineId} className="flex flex-col gap-0.5 border border-wds-warning-border bg-wds-warning-bg px-4 py-3">
                  <p className="font-wds-sans text-[15px] font-medium text-wds-warning-fg">{l.itemName}</p>
                  <p className="font-wds-sans text-[14px] text-wds-text-ink">
                    You counted {l.countedQty}, {l.sentQty} were sent.{l.direction === 'EXTRA' ? ` The Store Manager will say what happened to the ${Math.abs(Number(l.gapQty))} extra.` : ''}
                  </p>
                  {l.reason ? <p className="font-wds-sans text-[14px] text-wds-text-ink">Reason: {COUNT_REASON_TEXT[l.reason].toLowerCase()}.</p> : null}
                </div>
              ))}
              {preview.differingLines.length === 0 ? <p className="border border-wds-success-border bg-wds-success-bg px-4 py-3 font-wds-sans text-[14px] text-wds-success-fg">Every line matches what was sent.</p> : null}
              <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                Signed by {preview.signedBy.name}, {preview.signedBy.roleLabel}, on behalf of {departmentName}. The record shows who really counted.
              </p>
            </>
          ) : null}

          {step === 'pin' ? (
            <>
              <PinField wide value={pin} onChange={setPin} onSubmit={() => void onPrimary()} invalid={confirm.failure?.code === 'INVALID_PIN'} id="confirm-for-department-pin" />
              {confirm.failure?.code === 'INVALID_PIN' ? <p role="alert" className="font-wds-sans text-[13px] text-wds-error-fg">That PIN is not right. Try again.</p> : null}
              <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">If someone from {departmentName} confirms first, you will see who and when, and nothing is written twice.</p>
            </>
          ) : null}
        </>
      )}
    </DrawerShell>
  );
}
