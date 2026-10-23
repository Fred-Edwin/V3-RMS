'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../../_shared';
import { OwnInfoNote } from '../../components/own-contact-card';
import { PhotoStage } from './photo-stage';
import { PhotoCard, SaveFailed, chosenLine } from './photo-parts';
import { ACCEPT, MAX_PICK_MB, usePhotoFlow } from '../hooks/use-photo-flow';

/**
 * The photo on a desktop as three centred dialogs over the dimmed page (frames 13.4 to 13.6): "Add your photo" (480), "Adjust your
 * photo" (520, circle crop and zoom) and "Photo not saved" (480). The phone has the same three steps as full pages (`PhotoPages`).
 */
export function PhotoDialogs({ name, onClose, done }: { name: string; onClose: () => void; done: (message: string) => void }) {
  const flow = usePhotoFlow(done);
  const { page, source, action } = flow;

  if (page === 'adjust' && source) {
    return (
      <KitDialog
        open
        onOpenChange={(o) => !o && onClose()}
        title="Adjust your photo"
        description="Drag to move it. Use the slider to zoom. The circle is what your team sees."
        width={520}
        busy={action.busy}
        footer={
          <>
            <button type="button" disabled={action.busy} onClick={() => flow.setPage('choose')} className="mr-auto border-0 bg-transparent font-wds-sans text-[13px] font-medium leading-[18px] text-[#A8680A] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring">
              Choose another
            </button>
            <DialogButton kind="primary" size="lg" onClick={() => void flow.save()} disabled={action.busy}>{action.busy ? 'Saving…' : 'Use this photo'}</DialogButton>
          </>
        }
      >
        <PhotoStage source={source} zoom={flow.zoom} drag={flow.drag} onDrag={flow.setDrag} onZoom={flow.changeZoom} />
      </KitDialog>
    );
  }
  if (page === 'failed') {
    return (
      <KitDialog
        open
        onOpenChange={(o) => !o && onClose()}
        title="Photo not saved"
        description="Nothing was changed on your file."
        width={480}
        footer={
          <>
            <button type="button" onClick={() => { action.clearError(); flow.setPage('choose'); }} className="mr-auto border-0 bg-transparent font-wds-sans text-[13px] font-medium leading-[18px] text-[#A8680A] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring">
              Choose another photo
            </button>
            <DialogButton kind="cancel" size="lg" onClick={onClose}>Cancel</DialogButton>
            <DialogButton kind="primary" size="lg" onClick={() => { action.clearError(); flow.setPage('adjust'); }}>Try again</DialogButton>
          </>
        }
      >
        <PhotoCard name={name} url={source?.url} title="The photo you chose" line={chosenLine(source, 'From this computer')} />
        <SaveFailed reference={action.reference} />
      </KitDialog>
    );
  }
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add your photo"
      description="Your team sees it on the rota and your shift card. You can change it any time."
      width={480}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose}>Cancel</DialogButton>
          <label className="flex h-10 cursor-pointer items-center justify-center bg-wds-primary px-4 font-wds-sans text-[14px] font-medium leading-[18px] text-white focus-within:shadow-wds-ring hover:bg-wds-primary-hover">
            Choose a photo
            <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => flow.choose(e.target.files?.[0])} />
          </label>
        </>
      }
    >
      <PhotoCard name={name} title="Pick a photo of your face" line="A clear photo, with your face in the middle." plus />
      <OwnInfoNote>
        <span>JPG or PNG, up to {MAX_PICK_MB} MB.</span>
        <span>Only you in the photo, so your team can recognise you.</span>
      </OwnInfoNote>
      {flow.problem ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{flow.problem}</p> : null}
    </KitDialog>
  );
}
