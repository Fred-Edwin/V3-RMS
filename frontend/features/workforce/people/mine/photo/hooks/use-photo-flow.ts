'use client';

import * as React from 'react';

import { peopleWrites } from '../../../_shared/services/people-writes';
import { useFileAction } from '../../../file/hooks/use-file-action';
import { OUTPUT_PIXELS, clampDrag, cropSquare, type PhotoSize } from '../../lib/photo-crop';
import { CIRCLE } from '../components/photo-stage';

export const ACCEPT = 'image/jpeg,image/png';
/** The largest photo the person may pick (frames 8.4 and 13.4). It is cropped to a small square before it is sent. */
export const MAX_PICK_MB = 5;

export type PhotoPage = 'choose' | 'adjust' | 'failed';
export interface PickedPhoto {
  url: string;
  size: PhotoSize;
  file: File;
}

/**
 * The state of the photo flow, shared by the phone's three full pages and the desktop's three dialogs: choose, adjust (circle crop and
 * zoom), and "Photo not saved". Saving sends the cropped square, so what the person sees is what is kept.
 */
export function usePhotoFlow(done: (message: string) => void) {
  const [page, setPage] = React.useState<PhotoPage>('choose');
  const [source, setSource] = React.useState<PickedPhoto | null>(null);
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

  const changeZoom = (z: number): void => {
    setZoom(z);
    if (source) setDrag(clampDrag(source.size, CIRCLE, z, drag));
  };

  return { page, setPage, source, problem, zoom, changeZoom, drag, setDrag, action, choose, save };
}
