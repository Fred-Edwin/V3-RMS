'use client';

import * as React from 'react';

import { OwnInfoNote } from '../../components/own-contact-card';
import { OwnButton, OwnPage, OwnTextButton } from '../../components/own-page';
import { ACCEPT, MAX_PICK_MB, usePhotoFlow } from '../hooks/use-photo-flow';
import { PhotoCard, SaveFailed, chosenLine } from './photo-parts';
import { PhotoStage } from './photo-stage';

/**
 * The photo as three full pages on a phone (frames 8.4 to 8.6), not a sheet: choose from the gallery (no camera), adjust (circle crop
 * and zoom), and "Photo not saved" with what happened. A desktop has the same steps as dialogs (`PhotoDialogs`).
 */
export function PhotoPages({ name, onClose, done }: { name: string; onClose: () => void; done: (message: string) => void }) {
  const flow = usePhotoFlow(done);
  const { page, source, action } = flow;

  const gallery = (
    <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-[2px] bg-wds-primary font-wds-sans text-[15px] font-medium leading-[18px] text-white focus-within:shadow-wds-ring">
      <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
        <rect x="2" y="3" width="14" height="12" rx="1.5" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="6.5" cy="7.5" r="1.3" fill="#FFFFFF" />
        <path d="M3 13l4-3.5 3 2.5 2-1.5 3 2.5" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      Choose from your gallery
      <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => flow.choose(e.target.files?.[0])} />
    </label>
  );

  if (page === 'adjust' && source) {
    return (
      <OwnPage kicker="ADD YOUR PHOTO" title="Adjust your photo" subtitle="Drag to move it. Use the slider to zoom. The circle is what your team sees." onBack={() => flow.setPage('choose')} backLabel="Back to choosing a photo">
        <PhotoStage source={source} zoom={flow.zoom} drag={flow.drag} onDrag={flow.setDrag} onZoom={flow.changeZoom} />
        <OwnButton disabled={action.busy} onClick={() => void flow.save()}>{action.busy ? 'Saving…' : 'Use this photo'}</OwnButton>
        <OwnTextButton disabled={action.busy} onClick={() => flow.setPage('choose')}>Choose another</OwnTextButton>
      </OwnPage>
    );
  }
  if (page === 'failed') {
    return (
      <OwnPage kicker="ADD YOUR PHOTO" title="Photo not saved" subtitle="Nothing was changed on your file." onBack={onClose} backLabel="Close">
        <PhotoCard name={name} url={source?.url} title="The photo you chose" line={chosenLine(source, 'From your gallery')} />
        <SaveFailed reference={action.reference} />
        <OwnButton onClick={() => { action.clearError(); flow.setPage('adjust'); }}>Try again</OwnButton>
        <div className="flex h-12 items-center justify-center gap-6">
          <OwnTextButton className="h-auto" onClick={() => { action.clearError(); flow.setPage('choose'); }}>Choose another photo</OwnTextButton>
          <OwnTextButton className="h-auto" onClick={onClose}>Cancel</OwnTextButton>
        </div>
      </OwnPage>
    );
  }
  return (
    <OwnPage kicker="MY FILE" title="Add your photo" subtitle="Your team sees it on the rota and your shift card. You can change it any time." onBack={onClose} backLabel="Close">
      <PhotoCard name={name} title="Pick a photo of your face" line="A clear photo, with your face in the middle." plus />
      {gallery}
      <OwnInfoNote>
        <span>The photo must already be in your phone&apos;s gallery. JPG or PNG, up to {MAX_PICK_MB} MB.</span>
        <span>Only you in the photo, so your team can recognise you.</span>
      </OwnInfoNote>
      {flow.problem ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{flow.problem}</p> : null}
      <OwnTextButton onClick={onClose}>Cancel</OwnTextButton>
    </OwnPage>
  );
}
