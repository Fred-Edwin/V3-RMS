'use client';

import * as React from 'react';

import { initialsOf } from '../../../_shared/lib/avatar';
import { peopleWrites } from '../../_shared/services/people-writes';
import { useFileAction } from '../../file/hooks/use-file-action';
import { OUTPUT_PIXELS, clampDrag, cropSquare, type PhotoSize } from '../lib/photo-crop';
import { OwnInfoNote } from './own-contact-card';
import { OwnButton, OwnPage, OwnTextButton } from './own-page';
import { CIRCLE, PhotoStage } from './photo-stage';

const ACCEPT = 'image/jpeg,image/png';
/** The largest photo the person may pick from the gallery (frame 8.4). It is cropped to a small square before it is sent. */
const MAX_PICK_MB = 5;

type Page = 'choose' | 'adjust' | 'failed';
interface Picked {
  url: string;
  size: PhotoSize;
  file: File;
}

const GRADIENT = 'linear-gradient(145deg, #E9CFAE 0%, #C99A68 100%)';
const CARD = 'flex items-center gap-4 border border-wds-border bg-white p-[18px] shadow-[0_10px_24px_-18px_#1715122E]';

/** The 68 px avatar of frames 8.4 and 8.6: the chosen photo if there is one, otherwise initials, ringed in amber. */
function RingAvatar({ name, url, plus = false }: { name: string; url?: string; plus?: boolean }) {
  return (
    <span className="relative h-[68px] w-[68px] shrink-0">
      <span className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full font-wds-sans text-[22px] font-medium leading-7 text-[#4E2C14] shadow-[0_0_0_2px_#FFFFFF,0_0_0_3px_#B5823E]" style={{ backgroundImage: GRADIENT }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview of a file the person just chose
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initialsOf(name)}</span>
        )}
      </span>
      {plus ? (
        <span aria-hidden className="absolute -bottom-0.5 -right-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-wds-primary font-wds-sans text-[13px] leading-4 text-wds-canvas">
          +
        </span>
      ) : null}
    </span>
  );
}

/**
 * The photo as three full pages (frames 8.4 to 8.6), not a sheet: choose from the gallery (no camera), adjust (circle crop and zoom),
 * and "Photo not saved" with what happened. Saving sends the cropped square, so what the person sees is what is kept.
 */
export function PhotoPages({ name, onClose, done }: { name: string; onClose: () => void; done: (message: string) => void }) {
  const [page, setPage] = React.useState<Page>('choose');
  const [source, setSource] = React.useState<Picked | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [drag, setDrag] = React.useState({ x: 0, y: 0 });
  const action = useFileAction((m) => done(m ?? 'Photo saved.'));

  React.useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);

  const choose = (file: File | undefined): void => {
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) return setProblem('Choose a JPG or PNG photo.');
    if (file.size > MAX_PICK_MB * 1_000_000) return setProblem(`That photo is over ${MAX_PICK_MB} MB. Choose a smaller one.`);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setProblem(null);
      setSource({ url, size: { width: img.naturalWidth, height: img.naturalHeight }, file });
      setZoom(1);
      setDrag({ x: 0, y: 0 });
      setPage('adjust');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setProblem('That photo could not be opened. Choose another one.');
    };
    img.src = url;
  };

  const save = async (): Promise<void> => {
    if (!source) return;
    const square = cropSquare(source.size, CIRCLE, zoom, drag);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('The photo could not be read.'));
      el.src = source.url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_PIXELS;
    canvas.height = OUTPUT_PIXELS;
    canvas.getContext('2d')?.drawImage(image, square.x, square.y, square.size, square.size, 0, 0, OUTPUT_PIXELS, OUTPUT_PIXELS);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return setPage('failed');
    const cropped = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    const ok = await action.run(() => peopleWrites.photo('me', cropped), 'Your photo is saved.');
    if (!ok) setPage('failed');
  };

  const gallery = (
    <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-[2px] bg-wds-primary font-wds-sans text-[15px] font-medium leading-[18px] text-white focus-within:shadow-wds-ring">
      <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
        <rect x="2" y="3" width="14" height="12" rx="1.5" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="6.5" cy="7.5" r="1.3" fill="#FFFFFF" />
        <path d="M3 13l4-3.5 3 2.5 2-1.5 3 2.5" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      Choose from your gallery
      <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
    </label>
  );

  if (page === 'adjust' && source) {
    return (
      <OwnPage kicker="ADD YOUR PHOTO" title="Adjust your photo" subtitle="Drag to move it. Use the slider to zoom. The circle is what your team sees." onBack={() => setPage('choose')} backLabel="Back to choosing a photo">
        <PhotoStage source={source} zoom={zoom} drag={drag} onDrag={setDrag} onZoom={(z) => { setZoom(z); setDrag(clampDrag(source.size, CIRCLE, z, drag)); }} />
        <OwnButton disabled={action.busy} onClick={() => void save()}>{action.busy ? 'Saving…' : 'Use this photo'}</OwnButton>
        <OwnTextButton disabled={action.busy} onClick={() => setPage('choose')}>Choose another</OwnTextButton>
      </OwnPage>
    );
  }
  if (page === 'failed') {
    return (
      <OwnPage kicker="ADD YOUR PHOTO" title="Photo not saved" subtitle="Nothing was changed on your file." onBack={onClose} backLabel="Close">
        <div className={CARD}>
          <RingAvatar name={name} url={source?.url} />
          <div className="flex flex-col gap-[3px]">
            <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">The photo you chose</span>
            <span className="font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">From your gallery{source ? ` · ${(source.file.size / 1_000_000).toFixed(1)} MB` : ''}</span>
          </div>
        </div>
        <div role="alert" className="flex items-start gap-3 border border-l-[3px] border-[#E3B8AE] border-l-[#A8321C] bg-[#FBEDEA] px-4 py-3.5">
          <span aria-hidden className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#A8321C] font-wds-sans text-[12px] font-semibold leading-[14px] text-white">!</span>
          <div className="flex min-w-0 flex-col gap-1 text-[#7A2210]">
            <span className="font-wds-sans text-[14px] font-semibold leading-[18px]">We could not save your photo</span>
            <span className="font-wds-sans text-[13px] leading-[18px]">
              {action.reference ? (
                <>
                  Try again, or tell HR <span className="font-wds-mono">{action.reference}</span>.
                </>
              ) : (
                'Try again, or tell HR.'
              )}
            </span>
          </div>
        </div>
        <OwnButton onClick={() => { action.clearError(); setPage('adjust'); }}>Try again</OwnButton>
        <div className="flex h-12 items-center justify-center gap-6">
          <OwnTextButton className="h-auto" onClick={() => { action.clearError(); setPage('choose'); }}>Choose another photo</OwnTextButton>
          <OwnTextButton className="h-auto" onClick={onClose}>Cancel</OwnTextButton>
        </div>
      </OwnPage>
    );
  }
  return (
    <OwnPage kicker="MY FILE" title="Add your photo" subtitle="Your team sees it on the rota and your shift card. You can change it any time." onBack={onClose} backLabel="Close">
      <div className={CARD}>
        <RingAvatar name={name} plus />
        <div className="flex flex-col gap-[3px]">
          <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">Pick a photo of your face</span>
          <span className="font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">A clear photo, with your face in the middle.</span>
        </div>
      </div>
      {gallery}
      <OwnInfoNote>
        <span>The photo must already be in your phone&apos;s gallery. JPG or PNG, up to {MAX_PICK_MB} MB.</span>
        <span>Only you in the photo, so your team can recognise you.</span>
      </OwnInfoNote>
      {problem ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{problem}</p> : null}
      <OwnTextButton onClick={onClose}>Cancel</OwnTextButton>
    </OwnPage>
  );
}
