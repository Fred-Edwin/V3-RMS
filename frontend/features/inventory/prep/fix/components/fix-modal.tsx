'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui2/sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface FixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** The button row. Phone: pinned to the bottom of the sheet (Paper `825-0`, `85D-0`). Wide: the dialog's grey footer (Paper `8FT-0`). */
  footer: React.ReactNode;
  /** Left side of the wide footer, e.g. "Stays on record as cancelled." */
  footerNote?: React.ReactNode;
  /** While a write is in flight Escape and the backdrop must not close it. */
  locked?: boolean;
}

/**
 * The one modal for Fix a slip: a bottom sheet on a phone (drag handle, 16px gutters, Paper steps 15 and 16) and a centred 540px
 * dialog from tablet width (Paper step 18). Radix gives both the focus trap, Escape and focus return; `locked` holds the modal open
 * while a save is running so a half-done write is never hidden.
 */
export function FixModal({ open, onOpenChange, title, description, children, footer, footerNote, locked = false }: FixModalProps) {
  const { matches: wide } = useMediaQuery('(min-width: 768px)');
  const guard = (next: boolean): void => {
    if (!next && locked) return;
    onOpenChange(next);
  };

  if (!wide) {
    return (
      <Sheet open={open} onOpenChange={guard}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 px-wds-4 pb-wds-5 pt-[10px] [&>button]:hidden">
          <span aria-hidden className="mx-auto mb-wds-3.5 h-1 w-9 shrink-0 rounded-[2px] bg-wds-border-strong" />
          <div className="flex shrink-0 flex-col gap-[3px] pb-wds-3.5">
            <SheetTitle className="text-[18px] font-semibold leading-6 tracking-normal">{title}</SheetTitle>
            {description ? <SheetDescription className="text-wds-body-sm leading-[18px] text-wds-text-copy-muted">{description}</SheetDescription> : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-wds-3.5 overflow-y-auto">{children}</div>
          <div className="mt-wds-3.5 flex shrink-0 gap-[10px]">{footer}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={guard}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-48px)] w-[540px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'border border-wds-border bg-wds-surface shadow-wds-md outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto px-wds-6 pb-wds-5 pt-wds-6">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="font-wds-sans text-wds-body-sm leading-[18px] text-wds-text-copy-muted">{description}</DialogPrimitive.Description>
              ) : null}
            </div>
            {children}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-wds-4 border-t border-wds-border bg-wds-neutral-50 px-wds-6 py-wds-4">
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{footerNote}</span>
            <div className="flex shrink-0 gap-wds-2">{footer}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
