'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui2/sheet';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useWdsToastStore } from '@/store/wdsToastStore';
import type { CreateWasteResult } from '../../types/waste';
import { LogWasteFields, useLogWasteForm } from './log-waste-form';
import { StockMobileHeader } from './stock-mobile-header';
import { formatKes, formatQty } from './stock-format';

/**
 * Motion for the Milestone Six drawers (§4.2 + emil-design-eng): slide in
 * from the right in 250ms on the iOS-style drawer curve, out in 200ms;
 * reduced motion drops the slide (the overlay fade stays).
 */
export const STOCK_DRAWER_MOTION =
  'data-[state=open]:duration-[250ms] data-[state=closed]:duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:slide-out-to-right-0';

/**
 * Radix Dialog only returns focus to a `Dialog.Trigger`; these drawers open
 * from ordinary buttons (top bar, band links). `capture` runs in
 * `onOpenAutoFocus` — the moment before Radix moves focus inside, when the
 * opener still has it — and `restore` in `onCloseAutoFocus` (§4.2 "focus
 * returns to the trigger").
 */
export function useReturnFocus() {
  const opener = React.useRef<HTMLElement | null>(null);
  const capture = React.useCallback(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);
  const restore = React.useCallback((e: Event) => {
    if (opener.current?.isConnected) {
      e.preventDefault();
      opener.current.focus();
    }
    opener.current = null;
  }, []);
  return { capture, restore };
}

function useWasteLoggedToast() {
  const addToast = useWdsToastStore((s) => s.addToast);
  return React.useCallback(
    (result: CreateWasteResult) => {
      const { entry } = result;
      addToast({
        variant: 'success',
        title: 'Waste logged',
        description:
          `${entry.itemName} · ${formatQty(entry.quantity, entry.usageUnit)} · ${formatKes(entry.value)}` +
          (result.wentNegative ? ' — on-hand is now negative; a spot count will settle it.' : ''),
      });
    },
    [addToast],
  );
}

/**
 * Shared close guard: closing with a filled-in entry asks first (§4.2
 * "dirty-form guard"), so a stray Escape or backdrop click never throws an
 * entry away.
 */
function useGuardedClose(dirty: boolean, submitting: boolean, close: () => void, reset: () => void) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const requestClose = React.useCallback(() => {
    if (submitting) return;
    if (dirty) setConfirmOpen(true);
    else {
      reset();
      close();
    }
  }, [dirty, submitting, close, reset]);
  const dialog = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Discard this waste entry?"
      description="Nothing has been written to the ledger yet. Your entry will be lost."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => {
        setConfirmOpen(false);
        reset();
        close();
      }}
    />
  );
  return { requestClose, dialog };
}

export interface LogWasteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "the Central Store". */
  locationLabel: string;
  onLogged?: (result: CreateWasteResult) => void;
}

/** Desktop drawer — `18VZ-0` (440px, `18YH-0`). */
export function LogWasteDrawer({ open, onOpenChange, locationLabel, onLogged }: LogWasteDrawerProps) {
  const toast = useWasteLoggedToast();
  const handleLogged = React.useCallback(
    (result: CreateWasteResult) => {
      toast(result);
      onOpenChange(false);
      onLogged?.(result);
    },
    [toast, onOpenChange, onLogged],
  );
  const form = useLogWasteForm(handleLogged);
  const { requestClose, dialog } = useGuardedClose(form.dirty, form.submitting, () => onOpenChange(false), form.reset);
  const returnFocus = useReturnFocus();

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <SheetContent
          className={cn('w-[440px] gap-[18px] overflow-y-auto overscroll-contain px-6 pb-6 pt-5 [&>button:first-of-type]:hidden', STOCK_DRAWER_MOTION)}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onCloseAutoFocus={returnFocus.restore}
          onOpenAutoFocus={(e) => {
            returnFocus.capture();
            // Land on the first field (the item search), not the close button.
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>('[role="combobox"]')?.focus();
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">Log waste</SheetTitle>
              <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                Writes a waste entry against {locationLabel}
              </SheetDescription>
            </div>
            <SheetPrimitive.Close
              onClick={(e) => {
                e.preventDefault();
                requestClose();
              }}
              aria-label="Close"
              className="-m-1.5 rounded-wds-sm p-1.5 font-wds-sans text-[16px]/5 text-wds-text-faint outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
            >
              <span aria-hidden>×</span>
            </SheetPrimitive.Close>
          </div>
          <LogWasteFields form={form} variant="drawer" />
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  );
}

export interface LogWasteMobileProps {
  /** e.g. "the Central Store" / "Kitchen, Nyeri Town". */
  locationLabel: string;
  onClose: () => void;
  onLogged?: (result: CreateWasteResult) => void;
  /** Overlay (opened from the hub) or a routed page (DH `/app/branch/waste/new`). */
  asOverlay?: boolean;
}

/** Mobile full-screen — `1BX0-0` (Central Store) / `1ACM-0` (Department). */
export function LogWasteMobile({ locationLabel, onClose, onLogged, asOverlay = true }: LogWasteMobileProps) {
  const toast = useWasteLoggedToast();
  const handleLogged = React.useCallback(
    (result: CreateWasteResult) => {
      toast(result);
      onLogged?.(result);
      onClose();
    },
    [toast, onLogged, onClose],
  );
  const form = useLogWasteForm(handleLogged);
  const { requestClose, dialog } = useGuardedClose(form.dirty, form.submitting, onClose, form.reset);

  React.useEffect(() => {
    if (!asOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asOverlay, requestClose]);

  return (
    <div
      role={asOverlay ? 'dialog' : undefined}
      aria-modal={asOverlay || undefined}
      aria-label={asOverlay ? 'Log waste' : undefined}
      className={cn(
        'flex flex-col bg-wds-canvas',
        asOverlay
          ? 'fixed inset-0 z-50 overflow-y-auto overscroll-contain motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fade-in-0 motion-safe:duration-[250ms] motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]'
          : 'min-h-full',
      )}
    >
      <MobileStatusBar className="bg-wds-sidebar-top" />
      <StockMobileHeader
        title="Log waste"
        subtitle={`Writes a waste entry against ${locationLabel}`}
        onBack={requestClose}
        trailingLabel="Cancel"
        onTrailing={requestClose}
      />
      <div className="flex flex-1 flex-col">
        <LogWasteFields form={form} variant="mobile" />
      </div>
      {dialog}
    </div>
  );
}
