'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { PersonAvatar } from '../../../_shared';
import { fileProblem } from '../../file/lib/upload-rules';
import { useFileAction } from '../../file/hooks/use-file-action';
import { peopleWrites } from '../../_shared/services/people-writes';
import { MAX_ZOOM, OUTPUT_PIXELS, clampDrag, cropSquare, scaleFor, type PhotoSize } from '../lib/photo-crop';

const ACCEPT = 'image/jpeg,image/png';
const CIRCLE = 260;

type Page = 'choose' | 'adjust' | 'failed';

/**
 * The photo as three full pages (frames 8.4 to 8.6), not a sheet: choose from the gallery (no camera), adjust (circle crop and
 * zoom), and "could not save" with the server's reference. Saving sends the cropped square, so what the person sees is what is kept.
 */
export function PhotoPages({ name, onClose, done }: { name: string; onClose: () => void; done: (message: string) => void }) {
  const [page, setPage] = React.useState<Page>('choose');
  const [source, setSource] = React.useState<{ url: string; size: PhotoSize; file: File } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [drag, setDrag] = React.useState({ x: 0, y: 0 });
  const action = useFileAction((m) => done(m ?? 'Photo saved.'));
  const pointer = React.useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);

  React.useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);

  const choose = (file: File | undefined): void => {
    if (!file) return;
    const bad = fileProblem(file, ACCEPT);
    if (bad) return setProblem(bad);
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

  const scale = source ? scaleFor(source.size, CIRCLE, zoom) : 1;
  const at = source ? clampDrag(source.size, CIRCLE, zoom, drag) : drag;
  return (
    <div role="dialog" aria-modal="true" aria-label="Your photo" className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
      <header className="flex h-14 shrink-0 items-center gap-3 bg-wds-sidebar-mid px-2 text-wds-primary-fg">
        <button type="button" onClick={page === 'adjust' ? () => setPage('choose') : onClose} aria-label={page === 'adjust' ? 'Back to choosing a photo' : 'Close'} className="flex h-11 w-11 items-center justify-center border-0 bg-transparent text-[20px] text-inherit outline-none focus-visible:shadow-wds-ring">
          ←
        </button>
        <h1 className="m-0 font-wds-sans text-[16px] font-semibold leading-5">{page === 'adjust' ? 'Adjust your photo' : page === 'failed' ? 'Could not save' : 'Your photo'}</h1>
      </header>
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center gap-6 overflow-y-auto px-4 py-8">
        {page === 'choose' ? (
          <>
            <PersonAvatar name={name} size="lg" />
            <p className="m-0 text-center font-wds-sans text-[15px] leading-5 text-wds-text-ink">Choose a photo of your face from your gallery. It replaces your initials everywhere.</p>
            <label className="flex min-h-11 w-full cursor-pointer items-center justify-center bg-wds-primary px-4 font-wds-sans text-[15px] font-medium text-wds-primary-fg focus-within:shadow-wds-ring">
              Choose from gallery
              <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
            </label>
            <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">JPG or PNG, up to 10 MB.</p>
            {problem ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{problem}</p> : null}
          </>
        ) : null}
        {page === 'adjust' && source ? (
          <>
            <div
              role="img"
              aria-label="Your photo in a circle. Drag to move it."
              className="relative shrink-0 touch-none overflow-hidden rounded-full border border-wds-border bg-wds-neutral-100"
              style={{ width: CIRCLE, height: CIRCLE }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                pointer.current = { x: e.clientX, y: e.clientY, from: at };
              }}
              onPointerMove={(e) => {
                const p = pointer.current;
                if (p) setDrag(clampDrag(source.size, CIRCLE, zoom, { x: p.from.x + e.clientX - p.x, y: p.from.y + e.clientY - p.y }));
              }}
              onPointerUp={() => {
                pointer.current = null;
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a file the person just chose */}
              <img
                src={source.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{ width: source.size.width * scale, height: source.size.height * scale, left: CIRCLE / 2 - (source.size.width * scale) / 2 + at.x, top: CIRCLE / 2 - (source.size.height * scale) / 2 + at.y }}
              />
            </div>
            <label className="flex w-full items-center gap-3 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
              Zoom
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                aria-label="Zoom"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setZoom(next);
                  setDrag(clampDrag(source.size, CIRCLE, next, at));
                }}
                className="h-11 min-w-0 flex-1"
              />
            </label>
            <div className="flex w-full flex-col gap-3">
              <Button type="button" className="min-h-11 w-full" disabled={action.busy} onClick={() => void save()}>{action.busy ? 'Saving…' : 'Save photo'}</Button>
              <Button type="button" variant="flat" className="min-h-11 w-full" disabled={action.busy} onClick={() => setPage('choose')}>Choose another</Button>
            </div>
          </>
        ) : null}
        {page === 'failed' ? (
          <>
            <p role="alert" className="m-0 text-center font-wds-sans text-[16px] font-semibold leading-6 text-wds-text-ink">Your photo was not saved.</p>
            <p className="m-0 text-center font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{action.error ?? 'Nothing was changed. Try again, or tell your manager.'}</p>
            <div className="flex w-full flex-col gap-3">
              <Button type="button" className="min-h-11 w-full" onClick={() => { action.clearError(); setPage('adjust'); }}>Try again</Button>
              <Button type="button" variant="flat" className="min-h-11 w-full" onClick={onClose}>Close</Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
