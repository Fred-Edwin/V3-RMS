'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { cn } from '@/lib/cn';

import { Callout, initialsOf } from '../../../../_shared';
import type { DuplicateCheck } from '../../../_shared/types/people-types';
import { STEP_NOTES, photoNote } from '../../lib/hire-copy';
import type { HireState } from '../../lib/hire-model';
import type { HireErrors } from '../../lib/hire-validation';
import { HireField, HireInput, NumberField } from '../hire-field';

/** Step 1, Who (Paper `R5O-0`): an optional photo, name, phone, national ID and the email the login will use. */
export interface StepProps {
  state: HireState;
  errors: HireErrors;
  set: (patch: Partial<HireState>) => void;
}

/** A photo chosen now is uploaded right after the file exists (the upload needs the file's id), so it is held as a `File` and previewed. */
function PhotoPicker({ name, photo, onPick }: { name: string; photo: File | null; onPick: (file: File | null) => void }) {
  const input = React.useRef<HTMLInputElement>(null);
  const preview = React.useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  React.useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);
  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden
        className={cn('flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-wds-neutral-400 bg-wds-neutral-50 font-wds-sans text-[26px] text-wds-text-muted')}
      >
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : name.trim() ? initialsOf(name) : '+'}
      </span>
      <div className="flex flex-col items-start gap-1.5">
        <Button type="button" variant="flat" size="sm" onClick={() => input.current?.click()}>
          {photo ? 'Change photo' : 'Add a photo'}
        </Button>
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{photoNote}</span>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Photo of the new employee"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file && file.size <= 5 * 1024 * 1024) onPick(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function DuplicateNotice({ duplicate, confirmed, onConfirm }: { duplicate: DuplicateCheck | null; confirmed: boolean; onConfirm: (v: boolean) => void }) {
  if (!duplicate) return null;
  if (duplicate.nationalId) return <Callout tone="error" role="alert">{STEP_NOTES.duplicateId}</Callout>;
  if (duplicate.email) return <Callout tone="error" role="alert">{STEP_NOTES.duplicateEmail}</Callout>;
  if (duplicate.phone) {
    return (
      <Callout tone="warning" role="alert">
        <span>{STEP_NOTES.duplicatePhone}</span>
        <label className="mt-2 flex items-center gap-2 text-[13px] text-wds-text-ink">
          <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} className="h-4 w-4 accent-[var(--wds-primary)]" />
          {STEP_NOTES.confirmPhone}
        </label>
      </Callout>
    );
  }
  return <Callout tone="info" role="status">{STEP_NOTES.noDuplicate}</Callout>;
}

export function WhoStep({
  state,
  errors,
  set,
  photo,
  onPhoto,
  duplicate,
}: StepProps & { photo: File | null; onPhoto: (file: File | null) => void; duplicate: DuplicateCheck | null }) {
  return (
    <>
      <PhotoPicker name={state.name} photo={photo} onPick={onPhoto} />
      <HireField label="Full name" error={errors.name}>
        {(ids) => <HireInput ids={ids} value={state.name} autoComplete="off" autoFocus onChange={(e) => set({ name: e.target.value })} />}
      </HireField>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <HireField label="Phone" error={errors.phone}>
          {(ids) => <HireInput ids={ids} mono type="tel" value={state.phone} onChange={(e) => set({ phone: e.target.value })} />}
        </HireField>
        <HireField label="National ID number" error={errors.nationalId}>
          {(ids) => <NumberField ids={ids} code decimal={false} maxLength={20} value={state.nationalId} onChange={(v) => set({ nationalId: v })} />}
        </HireField>
      </div>
      <HireField label="Personal email" note="optional" helper={STEP_NOTES.personalEmailPurpose} error={errors.email}>
        {(ids) => <HireInput ids={ids} type="email" value={state.email} onChange={(e) => set({ email: e.target.value })} />}
      </HireField>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{STEP_NOTES.personalEmailPrivacy}</p>
      <DuplicateNotice duplicate={duplicate} confirmed={state.confirmDuplicatePhone} onConfirm={(v) => set({ confirmDuplicatePhone: v })} />
    </>
  );
}
