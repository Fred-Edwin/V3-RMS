'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { B2ErrorNote, B2PrimaryButton } from '../../../_shared/components/block2-phone-parts';
import { block2ErrorMessage, linesText } from '../../../_shared/lib/block2-words';
import { useRestoreFocus } from '../../../requisitions/hooks/use-restore-focus';
import { COUNT_REASON_TEXT, PHOTO_MAX_PER_LINE, PHOTO_MIME_TYPES, type CountReason, type PhotoRef } from '../../../dispatch/_shared/types/dispatch-contract';
import type { CountLine } from '../../_shared/types/deliveries-contract';
import { reasonsFor } from '../../lib/count-logic';
import { isTooLarge, shrinkImage } from '../../lib/shrink-image';
import { deliveriesApi } from '../../services/deliveries-phone-api';
import { AuthedImage } from './authed-image';

export interface ReasonSheetProps {
  deliveryId: string;
  /** Every flagged line that still needs a reason: one sheet for all of them (Paper chapter 14, A). Empty closes the sheet. */
  lines: CountLine[];
  onClose: () => void;
  /** Every reason is saved: the caller goes on to the summary. */
  onSaved: (updated: CountLine[]) => void;
}

/** Reasons and photos (Paper D10, chapter 14 A): one sheet for all flagged lines, each with the reasons that fit its direction. */
export function ReasonSheet({ deliveryId, lines, onClose, onSaved }: ReasonSheetProps) {
  const open = lines.length > 0;
  useRestoreFocus(open);
  const [reasons, setReasons] = React.useState<Record<string, CountReason | null>>({});
  const [photos, setPhotos] = React.useState<Record<string, PhotoRef[]>>({});
  const [busy, setBusy] = React.useState<'save' | 'photo' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const photoTarget = React.useRef<string | null>(null);
  const keyRef = React.useRef<string | null>(null);

  // A fresh sheet each time the set of flagged lines changes.
  const key = lines.map((l) => l.lineId).join(',');
  if (open && keyRef.current !== key) {
    keyRef.current = key;
    setReasons(Object.fromEntries(lines.map((l) => [l.lineId, l.reason])));
    setPhotos(Object.fromEntries(lines.map((l) => [l.lineId, l.photos])));
    setError(null);
  }
  if (!open && keyRef.current !== null) keyRef.current = null;

  const addPhoto = async (picked: File | undefined): Promise<void> => {
    const lineId = photoTarget.current;
    if (!lineId || !picked) return;
    setError(null);
    setBusy('photo');
    try {
      const file = await shrinkImage(picked);
      if (isTooLarge(file)) {
        setError('That photo is over 5 MB.');
        return;
      }
      const result = await deliveriesApi.uploadPhoto(deliveryId, lineId, file);
      setPhotos((all) => ({ ...all, [lineId]: result.photos }));
    } catch (err) {
      setError(block2ErrorMessage(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async (lineId: string, photoId: string): Promise<void> => {
    setError(null);
    setBusy('photo');
    try {
      const result = await deliveriesApi.deletePhoto(deliveryId, photoId);
      setPhotos((all) => ({ ...all, [lineId]: result.photos }));
    } catch (err) {
      setError(block2ErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const allChosen = lines.every((l) => reasons[l.lineId]);

  const save = async (): Promise<void> => {
    if (!allChosen) return;
    setBusy('save');
    setError(null);
    try {
      const saved: CountLine[] = [];
      for (const line of lines) {
        const reason = reasons[line.lineId];
        if (!reason) return;
        const updated = await deliveriesApi.setReason(deliveryId, line.lineId, { reason });
        saved.push({ ...updated, photos: photos[line.lineId] ?? updated.photos });
      }
      onSaved(saved);
    } catch (err) {
      setError(block2ErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={(next) => (next ? undefined : onClose())} label={`Why ${linesText(lines.length)} ${lines.length === 1 ? 'differs' : 'differ'}`} scrim={45}>
      {open ? (
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto px-5 pb-6 pt-3">
          <SheetGrabber />
          <div className="flex flex-col gap-1">
            <h2 className="font-wds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.01em] text-wds-text-ink">
              {lines.length === 1 ? `${lines[0]?.itemName}: why is it different?` : `Why do ${lines.length} lines differ?`}
            </h2>
            <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Your counts are final. Pick a reason for {lines.length === 1 ? 'this line' : 'each line'}.</p>
          </div>

          {lines.map((line) => {
            const direction = line.direction === 'EXTRA' ? 'Extra' : 'Short';
            const linePhotos = photos[line.lineId] ?? [];
            return (
              <section key={line.lineId} aria-label={line.itemName} className="flex flex-col gap-3 border border-wds-border-strong bg-white p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{line.itemName}</span>
                  <span className={cn('font-wds-sans text-[13px] leading-[18px]', line.direction === 'EXTRA' ? 'text-wds-info-fg' : 'text-wds-warning-fg')}>{direction}</span>
                </div>
                <div role="radiogroup" aria-label={`What do you think happened to ${line.itemName}`} className="flex flex-wrap gap-2">
                  {reasonsFor(line.direction).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={reasons[line.lineId] === r}
                      onClick={() => setReasons((all) => ({ ...all, [line.lineId]: r }))}
                      // Paper D10: 14/18 chips with 10/14 padding (38 px tall); the touch target stays 44 px through the transparent extension.
                      className={cn(
                        'relative border px-3.5 py-[9px] font-wds-sans text-[14px] leading-[18px] outline-none transition-colors duration-100 before:absolute before:inset-x-0 before:-inset-y-[3px] before:content-[\'\'] focus-visible:shadow-wds-ring',
                        reasons[line.lineId] === r ? 'border-wds-sidebar-top bg-wds-sidebar-top text-wds-neutral-0' : 'border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50',
                      )}
                    >
                      {COUNT_REASON_TEXT[r]}
                    </button>
                  ))}
                </div>
                {linePhotos.length > 0 ? (
                  <ul className="flex flex-wrap gap-2.5" aria-label={`Photos of ${line.itemName}`}>
                    {linePhotos.map((p, i) => (
                      <li key={p.id} className="relative size-[72px] border border-wds-border bg-wds-neutral-100">
                        <AuthedImage url={p.url} alt={`Photo ${i + 1} of ${line.itemName}`} className="flex size-full items-center object-cover" />
                        <button
                          type="button"
                          aria-label={`Remove photo ${i + 1} of ${line.itemName}`}
                          onClick={() => void removePhoto(line.lineId, p.id)}
                          disabled={busy !== null}
                          className="absolute -right-2.5 -top-2.5 flex size-8 items-center justify-center rounded-full border border-wds-border-strong bg-white text-[16px] leading-none text-wds-text-ink outline-none focus-visible:shadow-wds-ring disabled:opacity-50"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {linePhotos.length < PHOTO_MAX_PER_LINE ? (
                  <button
                    type="button"
                    onClick={() => {
                      photoTarget.current = line.lineId;
                      fileRef.current?.click();
                    }}
                    disabled={busy !== null}
                    className="self-start font-wds-sans text-[14px] font-medium leading-[18px] text-[var(--wds-primary-btn-start)] underline underline-offset-2 outline-none focus-visible:shadow-wds-ring disabled:opacity-60"
                  >
                    {busy === 'photo' ? 'Adding the photo…' : linePhotos.length === 0 ? 'Add a photo (optional)' : `Add another photo (${linePhotos.length} of ${PHOTO_MAX_PER_LINE})`}
                  </button>
                ) : null}
              </section>
            );
          })}
          <input ref={fileRef} id="reason-photo" type="file" accept={PHOTO_MIME_TYPES.join(',')} className="sr-only" tabIndex={-1} onChange={(e) => void addPhoto(e.target.files?.[0])} />

          {error ? <B2ErrorNote>{error}</B2ErrorNote> : null}
          <B2PrimaryButton disabled={!allChosen || busy !== null} onClick={() => void save()}>
            {busy === 'save' ? 'Saving…' : 'Save and go on'}
          </B2PrimaryButton>
        </div>
      ) : null}
    </BottomSheet>
  );
}
