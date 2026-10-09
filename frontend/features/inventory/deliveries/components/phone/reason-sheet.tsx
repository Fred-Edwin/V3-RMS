'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { B2ErrorNote, B2PrimaryButton } from '../../../_shared/components/block2-phone-parts';
import { block2ErrorMessage } from '../../../_shared/lib/block2-words';
import { useRestoreFocus } from '../../../requisitions/hooks/use-restore-focus';
import { formatQty } from '../../../requisitions/lib/qty';
import { COUNT_REASONS, COUNT_REASON_TEXT, PHOTO_MAX_PER_LINE, PHOTO_MIME_TYPES, type CountReason, type PhotoRef } from '../../../dispatch/_shared/types/dispatch-contract';
import type { CountLine } from '../../_shared/types/deliveries-contract';
import { isTooLarge, shrinkImage } from '../../lib/shrink-image';
import { deliveriesApi } from '../../services/deliveries-phone-api';
import { AuthedImage } from './authed-image';

export interface ReasonSheetProps {
  deliveryId: string;
  line: CountLine | null;
  /** "Line 1 of 2" when more than one line still needs a reason. */
  position: { index: number; total: number } | null;
  /** The number the person typed first, to say "both times" or "second count". */
  firstCount: string | null;
  onClose: () => void;
  /** The reason is saved: the caller goes on to the next line or the summary. */
  onSaved: (updated: CountLine) => void;
}

/** Reason and photo (Paper D10), with the Extra and second-count-differs wording and photo thumbnails. */
export function ReasonSheet({ deliveryId, line, position, firstCount, onClose, onSaved }: ReasonSheetProps) {
  const open = line !== null;
  useRestoreFocus(open);
  const [reason, setReason] = React.useState<CountReason | null>(null);
  const [photos, setPhotos] = React.useState<PhotoRef[]>([]);
  const [busy, setBusy] = React.useState<'save' | 'photo' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const keyRef = React.useRef<string | null>(null);

  if (line && keyRef.current !== line.lineId) {
    keyRef.current = line.lineId;
    setReason(line.reason);
    setPhotos(line.photos);
    setError(null);
  }
  if (!line && keyRef.current !== null) keyRef.current = null;

  const addPhoto = async (picked: File | undefined): Promise<void> => {
    if (!line || !picked) return;
    setError(null);
    setBusy('photo');
    try {
      const file = await shrinkImage(picked);
      if (isTooLarge(file)) {
        setError('That photo is over 5 MB.');
        return;
      }
      const result = await deliveriesApi.uploadPhoto(deliveryId, line.lineId, file);
      setPhotos(result.photos);
    } catch (err) {
      setError(block2ErrorMessage(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async (photoId: string): Promise<void> => {
    setError(null);
    setBusy('photo');
    try {
      const result = await deliveriesApi.deletePhoto(deliveryId, photoId);
      setPhotos(result.photos);
    } catch (err) {
      setError(block2ErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async (): Promise<void> => {
    if (!line || !reason) return;
    setBusy('save');
    setError(null);
    try {
      const updated = await deliveriesApi.setReason(deliveryId, line.lineId, { reason });
      onSaved({ ...updated, photos });
    } catch (err) {
      setError(block2ErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const direction = line?.direction === 'EXTRA' ? 'extra' : 'short';
  const counted = line?.countedQty ? formatQty(line.countedQty) : '';
  const countLine = firstCount !== null && firstCount === line?.countedQty ? `You counted ${counted} both times.` : `Your second count, ${counted}, is final.`;

  return (
    <BottomSheet open={open} onOpenChange={(next) => (next ? undefined : onClose())} label={line ? `${line.itemName}: why is it different?` : 'Why is it different?'} scrim={45}>
      {line ? (
        <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
          <SheetGrabber />
          <div className="flex flex-col gap-1.5">
            {position && position.total > 1 ? <p className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-muted">Line {position.index} of {position.total}</p> : null}
            <h2 className="font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.01em] text-wds-text-ink">{line.itemName}: why is it different?</h2>
            <p className="font-wds-sans text-[16px] leading-6 text-wds-text-muted">
              {countLine} This line will be marked {direction}.
            </p>
          </div>
          <div role="radiogroup" aria-label="What do you think happened" className="flex flex-col gap-2.5">
            <span className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-muted">What do you think happened</span>
            <div className="flex flex-wrap gap-2.5">
              {COUNT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    'h-11 min-w-11 border px-4 font-wds-sans text-[16px] leading-5 outline-none transition-colors duration-100 focus-visible:shadow-wds-ring',
                    reason === r ? 'border-wds-sidebar-top bg-wds-sidebar-top text-wds-neutral-0' : 'border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50',
                  )}
                >
                  {COUNT_REASON_TEXT[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {photos.length > 0 ? (
              <ul className="flex flex-wrap gap-2.5" aria-label="Photos">
                {photos.map((p, i) => (
                  <li key={p.id} className="relative size-[72px] border border-wds-border bg-wds-neutral-100">
                    <AuthedImage url={p.url} alt={`Photo ${i + 1} of ${line.itemName}`} className="flex size-full items-center object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => void removePhoto(p.id)}
                      disabled={busy !== null}
                      className="absolute -right-2.5 -top-2.5 flex size-8 items-center justify-center rounded-full border border-wds-border-strong bg-white text-[16px] leading-none text-wds-text-ink outline-none focus-visible:shadow-wds-ring disabled:opacity-50"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {photos.length < PHOTO_MAX_PER_LINE ? (
              <>
                <input ref={fileRef} id="reason-photo" type="file" accept={PHOTO_MIME_TYPES.join(',')} className="sr-only" tabIndex={-1} onChange={(e) => void addPhoto(e.target.files?.[0])} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy !== null}
                  className="flex min-h-[64px] items-center gap-3.5 border border-dashed border-wds-border-strong px-4 py-3.5 text-left outline-none transition-colors duration-100 hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:opacity-60"
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-wds-text-muted">
                    <path d="M4 8h3l1.5-2h7L17 8h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  <span className="flex flex-col">
                    <span className="font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink">{busy === 'photo' ? 'Adding the photo…' : photos.length === 0 ? 'Add a photo (optional)' : `Add another photo (${photos.length} of ${PHOTO_MAX_PER_LINE})`}</span>
                    <span className="font-wds-sans text-[14px] leading-5 text-wds-text-muted">Helpful for damaged or wrong items</span>
                  </span>
                </button>
              </>
            ) : null}
          </div>

          {error ? <B2ErrorNote>{error}</B2ErrorNote> : null}
          <B2PrimaryButton disabled={!reason || busy !== null} onClick={() => void save()}>
            {busy === 'save' ? 'Saving…' : 'Save and go on'}
          </B2PrimaryButton>
        </div>
      ) : null}
    </BottomSheet>
  );
}
