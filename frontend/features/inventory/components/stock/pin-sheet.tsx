'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { OTPInput, type SlotProps } from 'input-otp';

import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { SetPinForm } from '@/components/app/shell/set-pin-form';
import { usePinStatus } from '@/hooks/usePinStatus';
import { FormErrorBanner } from './stock-states';

/**
 * The PIN step of every Milestone Six signature (attendant sign, Store
 * Manager approve, spot count). Mobile: the bottom sheet from Paper `18MQ-0`
 * (drag handle, four 46×54 boxes, info note, Cancel / Sign). Desktop: the
 * shared centred `SignSheetDialog`. The PIN is only ever held in this
 * component's state and handed to `onSubmit`; it is cleared on every open and
 * after a failed attempt.
 */
export interface PinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  /** The blue note under the boxes. */
  note: string;
  confirmLabel: string;
  submitting: boolean;
  /** Wrong PIN → inline under the boxes; anything else → the kit banner. */
  error?: { kind: 'pin' | 'other'; message: string } | null;
  onSubmit: (pin: string) => void;
}

const PIN_LENGTH = 4;
const SWIPE_DISMISS_PX = 90;
const SWIPE_DISMISS_VELOCITY = 0.11;

function PinBox({ slot }: { slot: SlotProps }) {
  const filled = slot.char != null && slot.char !== '';
  return (
    <div
      className={cn(
        'relative flex h-[54px] w-[46px] shrink-0 items-center justify-center rounded-[6px] border bg-wds-surface transition-colors duration-150',
        slot.isActive ? 'border-wds-primary shadow-wds-ring' : 'border-wds-border-strong',
      )}
    >
      {filled ? <span className="size-2.5 rounded-full bg-wds-text-ink" aria-hidden /> : null}
      {slot.hasFakeCaret ? <span className="h-[22px] w-0.5 animate-caret-blink bg-wds-primary" aria-hidden /> : null}
    </div>
  );
}

function MobilePinSheet({ open, onOpenChange, title, subtitle, note, confirmLabel, submitting, error, onSubmit }: PinSheetProps) {
  const [pin, setPin] = React.useState('');
  const [dragY, setDragY] = React.useState(0);
  const drag = React.useRef<{ startY: number; startT: number; id: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // No PIN yet → this same sheet becomes the "Set your PIN" step, then signs
  // with the PIN just set (Pre-Demo Fixes, Paper artboard 5a).
  const pinStatus = usePinStatus(open);
  const needsPin = pinStatus.hasPin === false;
  const checkingPin = pinStatus.hasPin === null && pinStatus.loading;

  React.useEffect(() => {
    if (open) {
      setPin('');
      setDragY(0);
    }
  }, [open]);
  // A rejected PIN clears the boxes so the next attempt starts clean.
  React.useEffect(() => {
    if (error) setPin('');
  }, [error]);

  // The input is disabled while signing, which drops focus — take it back so a retry can be typed straight away.
  React.useEffect(() => {
    if (open && !submitting) inputRef.current?.focus();
  }, [open, submitting]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || submitting) return; // ignore a second finger mid-drag
    drag.current = { startY: e.clientY, startT: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const delta = e.clientY - drag.current.startY;
    // Friction upward instead of a hard stop.
    setDragY(delta < 0 ? delta / 8 : delta);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const delta = e.clientY - drag.current.startY;
    const velocity = Math.abs(delta) / Math.max(1, performance.now() - drag.current.startT);
    drag.current = null;
    if (delta >= SWIPE_DISMISS_PX || (delta > 20 && velocity > SWIPE_DISMISS_VELOCITY)) onOpenChange(false);
    else setDragY(0);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-wds-scrim data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          style={{ transform: dragY ? `translateY(${Math.max(dragY, -12)}px)` : undefined, transition: drag.current ? 'none' : undefined }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] flex-col gap-[18px] rounded-t-[14px] bg-wds-surface px-[18px] pb-[26px] pt-[22px] outline-none',
            'data-[state=open]:duration-[250ms] data-[state=closed]:duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom motion-reduce:data-[state=closed]:slide-out-to-bottom-0 motion-reduce:data-[state=open]:slide-in-from-bottom-0',
          )}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="-mt-3 flex touch-none justify-center py-3"
            aria-hidden
          >
            <div className="h-1 w-9 rounded-[2px] bg-wds-border-strong" />
          </div>
          <div className="-mt-4 flex flex-col gap-1">
            <DialogPrimitive.Title className="font-wds-sans text-[18px]/[22px] font-semibold text-wds-text-ink">
              {needsPin ? 'Set your signing PIN' : title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="font-wds-sans text-[13px]/[18px] text-wds-text-copy-muted">
              {needsPin
                ? "You haven't set a PIN yet. Choose 4 digits — you'll use them to sign this and everything else. Only you should know it."
                : subtitle}
            </DialogPrimitive.Description>
          </div>

          {needsPin ? (
            <SetPinForm
              layout="stacked"
              submitLabel="Set PIN & continue"
              onCancel={() => onOpenChange(false)}
              onDone={(newPin) => {
                pinStatus.markSet();
                onSubmit(newPin);
              }}
            />
          ) : (
            <>

              {error?.kind === 'other' ? <FormErrorBanner title={error.message} description="Nothing was signed. Your counts are kept — try again." /> : null}

              <div className="flex flex-col items-center gap-2">
                <OTPInput
                  ref={inputRef}
                  maxLength={PIN_LENGTH}
                  value={pin}
                  onChange={setPin}
                  autoFocus
                  disabled={submitting}
                  inputMode="numeric"
                  aria-label="PIN"
                  aria-invalid={error?.kind === 'pin' || undefined}
                  containerClassName="flex justify-center gap-3 py-2 has-[:disabled]:opacity-60"
                  render={({ slots }) => (
                    <>
                      {slots.map((slot, i) => (
                        <PinBox key={i} slot={slot} />
                      ))}
                    </>
                  )}
                />
                {error?.kind === 'pin' ? (
                  <p role="alert" className="font-wds-sans text-wds-caption text-wds-error-fg">
                    {error.message}
                  </p>
                ) : null}
              </div>

              <div className="flex items-start gap-[9px] rounded-[4px] border border-wds-info-border bg-wds-info-bg px-3.5 py-[11px]">
                <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-wds-info-fg" aria-hidden />
                <p className="min-w-0 grow basis-0 font-wds-sans text-[12px]/[17px] text-wds-info-fg">{note}</p>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                  className="flex grow basis-0 touch-manipulation items-center justify-center rounded-[4px] border border-wds-border-strong p-3.5 font-wds-sans text-[14px]/[18px] text-wds-text-copy-muted outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onSubmit(pin)}
                  disabled={pin.length !== PIN_LENGTH || submitting || checkingPin}
                  className={cn(
                    'flex grow-[2] basis-0 touch-manipulation items-center justify-center rounded-[4px] p-3.5 font-wds-sans text-[14px]/[18px] font-medium outline-none transition-[transform,background-color,filter] duration-150 ease-out focus-visible:shadow-wds-ring',
                    pin.length !== PIN_LENGTH || submitting || checkingPin
                      ? 'cursor-not-allowed bg-wds-neutral-300 text-wds-neutral-600'
                      : 'bg-wds-gradient-primary text-wds-primary-fg shadow-wds-sheen hover:brightness-110 motion-safe:active:scale-[0.98]',
                  )}
                >
                  {submitting ? 'Signing…' : confirmLabel}
                </button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function PinSheet(props: PinSheetProps) {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  if (!hydrated) return null;
  if (!isDesktop) return <MobilePinSheet {...props} />;
  return (
    <SignSheetDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.title}
      subtitle={props.subtitle}
      helperText={props.note}
      confirmLabel={props.confirmLabel}
      onSubmit={props.onSubmit}
      submitting={props.submitting}
      error={props.error?.message}
    />
  );
}
