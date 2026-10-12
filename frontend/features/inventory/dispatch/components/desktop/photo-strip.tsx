'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Button } from '@/components/ui2/button';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import type { PhotoRef } from '../../_shared/types/dispatch-contract';

/** A photo link is authenticated: it is fetched with the caller's token and shown from an object URL. */
function useAuthImage(url: string | null): { src: string | null; failed: boolean } {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [state, setState] = React.useState<{ src: string | null; failed: boolean }>({ src: null, failed: false });
  React.useEffect(() => {
    if (!url) return undefined;
    let revoked: string | null = null;
    let cancelled = false;
    setState({ src: null, failed: false });
    const full = url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:') ? url : `${env.apiUrl}${url}`;
    fetch(full, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, credentials: 'include' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('photo'))))
      .then((blob) => {
        if (cancelled) return;
        revoked = URL.createObjectURL(blob);
        setState({ src: revoked, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, failed: true });
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [url, accessToken]);
  return state;
}

function Thumb({ photo, index, onOpen }: { photo: PhotoRef; index: number; onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { src, failed } = useAuthImage(photo.url);
  return (
    <button type="button" onClick={onOpen} aria-label={`Open photo ${index + 1}`} className="size-14 shrink-0 overflow-hidden border border-wds-border-strong bg-wds-neutral-100 outline-none focus-visible:shadow-wds-ring">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center font-wds-sans text-[11px] text-wds-text-secondary">{failed ? 'No preview' : '…'}</span>
      )}
    </button>
  );
}

function Viewer({ photos, index, onIndex, onClose, returnFocus }: { photos: readonly PhotoRef[]; index: number; onIndex: (i: number) => void; onClose: () => void; returnFocus: () => HTMLElement | null }) {
  const photo = photos[index];
  const { src, failed } = useAuthImage(photo?.url ?? null);
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-wds-scrim" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            const target = returnFocus();
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
            if (event.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
          }}
          className="fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-32px)] w-[720px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col border border-wds-border-strong bg-wds-surface outline-none"
        >
          <div className="flex items-center justify-between border-b border-wds-border px-5 py-3">
            <DialogPrimitive.Title className="font-wds-sans text-[16px] font-semibold text-wds-text-ink">
              Photo {index + 1} of {photos.length}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close photo">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">The photo the branch attached to this line.</DialogPrimitive.Description>
          <div className="flex min-h-[320px] items-center justify-center overflow-auto bg-wds-neutral-100 p-4">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`Photo ${index + 1} attached by the branch`} className="max-h-[60dvh] max-w-full object-contain" />
            ) : (
              <p className="font-wds-sans text-[14px] text-wds-text-secondary">{failed ? 'This photo could not be loaded.' : 'Loading the photo…'}</p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-wds-border px-5 py-3">
            <Button variant="secondary" onClick={() => onIndex(index - 1)} disabled={index === 0}>
              <ChevronLeft /> Previous
            </Button>
            <Button variant="secondary" onClick={() => onIndex(index + 1)} disabled={index >= photos.length - 1}>
              Next <ChevronRight />
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The photos the branch attached to a line; empty shows nothing (the caller words "None added"). */
export function PhotoStrip({ photos }: { photos: readonly PhotoRef[] }) {
  const [open, setOpen] = React.useState<number | null>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  if (photos.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Photos from the branch">
        {photos.map((photo, index) => (
          <Thumb
            key={photo.id}
            photo={photo}
            index={index}
            onOpen={(event) => {
              opener.current = event.currentTarget;
              setOpen(index);
            }}
          />
        ))}
      </div>
      {open !== null ? <Viewer photos={photos} index={open} onIndex={(i) => setOpen(Math.min(photos.length - 1, Math.max(0, i)))} onClose={() => setOpen(null)} returnFocus={() => opener.current} /> : null}
    </>
  );
}
