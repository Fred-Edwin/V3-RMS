'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

/**
 * The phone bottom sheet of the Counting and Waste screens (Paper steps 3, 6, 17, 20, 41): a scrim, a white panel on the bottom
 * edge, and the same 480 px maximum width as the Attendant's phone column so it lines up with the screen behind it at any window
 * width. The caller draws the padding, gap and border its artboard has (they differ between sheets). Escape and a tap on the scrim
 * close it (unless `dismissible` is false); focus moves in, is trapped while open and returns to where it was; the entrance is a
 * short ease-out slide that is skipped under `prefers-reduced-motion`.
 */
export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The accessible name (read by screen readers; drawn only if the children draw it). */
  label: string;
  /** Scrim strength: Paper draws 45 % behind the move sheet and 52 % behind the check and PIN sheets. */
  scrim?: 45 | 52;
  /** False for a sheet that must be answered (a pending save): Escape and the scrim do nothing. */
  dismissible?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Moves focus to this element on open instead of the first control. */
  initialFocusRef?: React.RefObject<HTMLElement>;
}

const SCRIM = {
  45: 'bg-[color-mix(in_oklab,var(--wds-neutral-950)_45%,transparent)]',
  52: 'bg-[color-mix(in_oklab,var(--wds-neutral-950)_52%,transparent)]',
} as const;

export function BottomSheet({ open, onOpenChange, label, scrim = 45, dismissible = true, children, className, initialFocusRef }: BottomSheetProps) {
  // Radix returns focus only to a `Dialog.Trigger`, and a sheet is opened by state, so remember what had focus when it opened and
  // give it back on close (unless the screen has already moved focus somewhere on purpose, or the opener is gone).
  const opener = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    if (open) opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  }, [open]);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (dismissible || next ? onOpenChange(next) : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:duration-150 data-[state=open]:duration-200 motion-reduce:animate-none',
            SCRIM[scrim],
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = opener.current;
            const nowhere = document.activeElement === null || document.activeElement === document.body;
            if (nowhere && target && target.isConnected) target.focus();
          }}
          onInteractOutside={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-y-auto bg-wds-surface outline-none',
            'data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-150 data-[state=open]:duration-200 data-[state=open]:ease-out motion-reduce:animate-none',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The short grab bar at the top of the check and PIN sheets (`1WPU-0`: 36 × 4). */
export function SheetGrabber() {
  return <div className="h-1 w-9 shrink-0 self-center bg-wds-border-strong" aria-hidden />;
}
