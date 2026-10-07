'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { OTPInput, type SlotProps } from 'input-otp';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui2/input-otp';
import { usePinStatus } from '@/hooks/usePinStatus';
import { SetPinForm } from './set-pin-form';

/**
 * Sign Sheet — PIN re-authentication for signing a Goods Receipt, plus the
 * read-only rendered signature shown afterward. Genuinely new this milestone
 * (04-components.md Milestone Two #2); no equivalent existed in the codebase.
 * Reference: page 4-0 (Store Manager) — D61-0 (Fulfil & dispatch,
 * mid-signature) for the PIN dialog, GEO-0 (dispatched/signed) for the
 * rendered-signature block. Not cloned onto Milestone Two's own page (C-0);
 * the New Goods Receipt (sign & save) and signed detail screens reuse this
 * exact pattern per the S0 session brief.
 */
export interface SignSheetDocumentSummary {
  title: string;
  detail: string;
}

export interface SignSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  helperText: string;
  /** Optional context card (e.g. "Goods Receipt — Samrat Ltd" / "2 lines · KES 10,860") shown above the PIN input, so the signer can confirm what they're about to lock in. */
  documentSummary?: SignSheetDocumentSummary;
  confirmLabel?: string;
  cancelLabel?: string;
  onSubmit: (pin: string) => void;
  submitting?: boolean;
  error?: string;
  /**
   * How the sheet is drawn. `dialog` (default) is the Milestone Two sheet above. `wide` and `sheet` are the Counting redesign's
   * (Paper steps 6, 11 and 14): `wide` is a 560 px square-cornered dialog for the desktop, `sheet` a bottom sheet on the phone
   * column. Both use the same PIN-status check and the same first-use "Set your signing PIN" step as `dialog`; only the paint and
   * the content slot differ. `helperText` and `documentSummary` are ignored in these two.
   */
  layout?: 'dialog' | 'wide' | 'sheet';
  /** Counting layouts only: the summary the signer confirms (rows, boxes, notes), drawn between the heading and the PIN. */
  children?: React.ReactNode;
  /** Counting layouts only: the small caps label over the boxes. */
  pinLabel?: string;
  /** Counting layouts only: an extra reason the confirm button must stay disabled (a cause still to pick), shown as its tooltip. */
  confirmBlockedReason?: string;
  /** `wide` layout only: the width in px when Paper draws it other than 560 (step 14 draws 580). */
  wideWidth?: number;
}

const PIN_LENGTH = 4;

export function SignSheetDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  helperText,
  documentSummary,
  confirmLabel = 'Sign & save',
  cancelLabel = 'Cancel',
  onSubmit,
  submitting = false,
  error,
  layout = 'dialog',
  children,
  pinLabel = 'Enter your PIN',
  confirmBlockedReason,
  wideWidth,
}: SignSheetDialogProps) {
  const [pin, setPin] = React.useState('');
  // Everyone who signs needs a PIN. If this signer has none yet, the sheet
  // becomes a "Set your PIN" step first, then signs with the PIN just set
  // (Pre-Demo Fixes — one shared fix, every signing site inherits it).
  const pinStatus = usePinStatus(open);
  const needsPin = pinStatus.hasPin === false;
  const checkingPin = pinStatus.hasPin === null && pinStatus.loading;

  const pinFieldRef = React.useRef<HTMLDivElement>(null);
  const wasSubmitting = React.useRef(false);

  React.useEffect(() => {
    if (open) setPin('');
  }, [open]);

  // A rejected PIN clears the boxes and hands focus back, so the retry can be typed straight away.
  // Keyed on the end of a submit (not on `error`): a second wrong PIN produces the same message.
  React.useEffect(() => {
    if (wasSubmitting.current && !submitting && error) {
      setPin('');
      pinFieldRef.current?.querySelector('input')?.focus();
    }
    wasSubmitting.current = submitting;
  }, [submitting, error]);

  const canSubmit = pin.length === PIN_LENGTH && !submitting && !checkingPin;

  if (layout !== 'dialog') {
    return (
      <CountingSignLayout
        layout={layout}
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        subtitle={subtitle}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        pinLabel={pinLabel}
        pin={pin}
        setPin={setPin}
        pinFieldRef={pinFieldRef}
        needsPin={needsPin}
        checkingPin={checkingPin}
        submitting={submitting}
        error={error}
        canSubmit={canSubmit && !confirmBlockedReason}
        blockedReason={confirmBlockedReason}
        wideWidth={wideWidth}
        onSubmit={onSubmit}
        onPinSet={(newPin) => {
          pinStatus.markSet();
          onSubmit(newPin);
        }}
      >
        {children}
      </CountingSignLayout>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2',
            needsPin ? 'w-[464px]' : 'w-[380px]',
            'flex flex-col overflow-hidden rounded-wds-lg border border-wds-border bg-wds-surface shadow-wds-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <div className="flex flex-col gap-wds-1 px-wds-5 pt-wds-5">
            <DialogPrimitive.Title className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">
              {needsPin ? 'Set your signing PIN' : title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
              {needsPin ? "You haven't set a PIN yet. Choose 4 digits, then we'll continue to sign." : subtitle}
            </DialogPrimitive.Description>
          </div>

          {needsPin ? (
            <SetPinForm
              className="p-wds-5"
              submitLabel="Set PIN & continue"
              onCancel={() => onOpenChange(false)}
              onDone={(newPin) => {
                pinStatus.markSet();
                onSubmit(newPin);
              }}
            />
          ) : null}

          {!needsPin && documentSummary ? (
            <div className="mx-wds-5 mt-wds-4 flex flex-col gap-wds-0.5 rounded-wds-sm border border-wds-border bg-wds-surface-sunken px-wds-3.5 py-wds-2.5">
              <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{documentSummary.title}</span>
              <span className="font-wds-mono text-wds-caption text-wds-text-copy-muted">{documentSummary.detail}</span>
            </div>
          ) : null}

          {!needsPin ? (
            <>
              <div className="flex flex-col gap-wds-2 p-wds-5">
                <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">
                  Enter your PIN
                </label>
                <div ref={pinFieldRef}>
                  <InputOTP
                    maxLength={PIN_LENGTH}
                    value={pin}
                    onChange={setPin}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canSubmit) {
                        e.preventDefault();
                        onSubmit(pin);
                      }
                    }}
                    autoFocus
                    disabled={submitting}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {error ? (
                  <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p>
                ) : (
                  // 11px/15px — one px taller than wds-helper (11px/14px); Paper
                  // (DC8-0) draws this specific helper line 1px looser. Not worth
                  // a new token for a single 1px variant; kept as an arbitrary
                  // value matched via get_computed_styles.
                  <p className="font-wds-sans text-[11px] leading-[15px] text-wds-text-faint">{helperText}</p>
                )}
              </div>

              <div className="flex gap-wds-2 px-wds-5 pb-wds-5 pt-wds-4">
                <Button
                  variant="secondary"
                  className="grow"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  {cancelLabel}
                </Button>
                <Button
                  variant="primary"
                  className="grow"
                  onClick={() => onSubmit(pin)}
                  disabled={!canSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Signing…
                    </>
                  ) : (
                    confirmLabel
                  )}
                </Button>
              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface SignedBySignatureProps {
  label?: string;
  name: string;
  roleLine: string;
  className?: string;
}

/**
 * The read-only rendered signature shown once a receipt (or dispatch, per
 * GEO-0's precedent) is signed — "DISPATCHED & SIGNED BY" mono label, name
 * in font-wds-signature (Alex Brush), divider, then role + verified
 * timestamp. Milestone Two callers pass label="RECEIVED & SIGNED BY".
 */
export function SignedBySignature({ label = 'Signed by', name, roleLine, className }: SignedBySignatureProps) {
  return (
    <div className={cn('flex flex-col gap-wds-1.25', className)}>
      <div className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-copy-muted">
        {label}
      </div>
      <div className="font-wds-signature text-[30px] leading-8 text-wds-text-ink">{name}</div>
      <div className="mt-0.5 h-px w-[220px] shrink-0 bg-wds-border-strong" />
      <div className="font-wds-sans text-wds-field-label text-wds-text-copy-muted">{roleLine}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------------------------------------------
 * Counting redesign layouts (Paper steps 6, 11, 14). Same PIN rules and the same first-use "Set your signing PIN" step as the
 * dialog above; only the paint differs: square corners, a hairline border, four equal boxes with a dot per digit and a caret, and
 * a shake when the PIN is wrong. `sheet` is the phone bottom sheet (1WXL-0), `wide` the 560 px desktop dialog (1Y2K-0).
 * ------------------------------------------------------------------------------------------------------------------------------- */

const SHAKE_KEYFRAMES = '@keyframes scw-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}@keyframes scw-caret{0%,100%{opacity:1}50%{opacity:0}}';

function PaperPinBox({ slot, tall, invalid }: { slot: SlotProps; tall: boolean; invalid: boolean }) {
  const filled = slot.char != null && slot.char !== '';
  return (
    <div
      className={cn(
        'relative flex grow basis-0 items-center justify-center bg-wds-surface transition-[border-color] duration-150',
        tall ? 'h-14' : 'h-13',
        slot.isActive ? 'border-[1.5px] border-wds-selected-edge' : invalid ? 'border border-wds-error-fg' : 'border border-wds-border-strong',
      )}
    >
      {filled ? <span className="size-2.5 rounded-[5px] bg-wds-text-ink" aria-hidden /> : null}
      {slot.hasFakeCaret ? <span className={cn('w-0.5 bg-wds-selected-edge motion-safe:animate-[scw-caret_1.1s_steps(1)_infinite]', tall ? 'h-6' : 'h-[22px]')} aria-hidden /> : null}
    </div>
  );
}

interface CountingSignLayoutProps {
  layout: 'wide' | 'sheet';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  confirmLabel: string;
  cancelLabel: string;
  pinLabel: string;
  pin: string;
  setPin: (pin: string) => void;
  pinFieldRef: React.RefObject<HTMLDivElement>;
  needsPin: boolean;
  checkingPin: boolean;
  submitting: boolean;
  error?: string;
  canSubmit: boolean;
  blockedReason?: string;
  wideWidth?: number;
  onSubmit: (pin: string) => void;
  onPinSet: (pin: string) => void;
  children?: React.ReactNode;
}

function CountingSignLayout({
  layout,
  open,
  onOpenChange,
  title,
  subtitle,
  confirmLabel,
  cancelLabel,
  pinLabel,
  pin,
  setPin,
  pinFieldRef,
  needsPin,
  checkingPin,
  submitting,
  error,
  canSubmit,
  blockedReason,
  wideWidth,
  onSubmit,
  onPinSet,
  children,
}: CountingSignLayoutProps) {
  const sheet = layout === 'sheet';
  const [shaking, setShaking] = React.useState(false);

  // A rejected PIN shakes the boxes once (not at all under reduced motion: the class is `motion-safe`).
  React.useEffect(() => {
    if (!error || submitting) return;
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), 360);
    return () => window.clearTimeout(t);
  }, [error, submitting]);

  const confirmClass = cn(
    'flex items-center justify-center font-wds-sans font-semibold outline-none transition-[filter,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring',
    sheet ? 'h-12 w-full text-[15px] leading-5' : 'h-10 px-5 text-[14px] leading-5',
    canSubmit
      ? 'bg-wds-gradient-primary text-wds-primary-fg hover:brightness-110 active:brightness-95 motion-safe:active:scale-[0.99]'
      : 'cursor-not-allowed bg-wds-neutral-100 text-wds-text-muted',
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}>
      <DialogPrimitive.Portal>
        <style>{SHAKE_KEYFRAMES}</style>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none',
            sheet ? 'bg-[color-mix(in_oklab,var(--wds-neutral-950)_52%,transparent)]' : 'bg-wds-scrim',
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={!sheet && wideWidth ? { width: wideWidth } : undefined}
          className={cn(
            'fixed z-50 flex flex-col bg-wds-surface outline-none motion-reduce:animate-none',
            sheet
              ? 'inset-x-0 bottom-0 mx-auto max-h-[92vh] w-full max-w-[480px] gap-4 overflow-y-auto px-5 pb-6 pt-2.5 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200'
              : 'left-1/2 top-1/2 max-h-[calc(100vh-32px)] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 gap-[18px] overflow-y-auto border border-wds-border-strong px-7 py-6 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          {sheet ? <div className="h-1 w-9 shrink-0 self-center bg-wds-border-strong" aria-hidden /> : null}
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className={cn('font-wds-sans font-semibold text-wds-text-ink', 'text-[20px] leading-[26px]')}>
              {needsPin ? 'Set your signing PIN' : title}
            </DialogPrimitive.Title>
            <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
              {needsPin ? "You haven't set a PIN yet. Choose 4 digits, then we'll continue to sign." : subtitle}
            </p>
          </div>

          {needsPin ? (
            <SetPinForm
              className="py-1"
              layout={sheet ? 'stacked' : 'inline'}
              submitLabel="Set PIN & continue"
              onCancel={() => onOpenChange(false)}
              onDone={onPinSet}
            />
          ) : (
            <>
              {children}
              <div className="flex flex-col gap-2">
                <label className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{pinLabel}</label>
                <div ref={pinFieldRef} className={cn(shaking && 'motion-safe:animate-[scw-shake_320ms_ease-in-out]')}>
                  <OTPInput
                    maxLength={PIN_LENGTH}
                    value={pin}
                    onChange={setPin}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    disabled={submitting}
                    aria-label={pinLabel}
                    containerClassName="flex gap-2.5 has-[:disabled]:opacity-60"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canSubmit) {
                        e.preventDefault();
                        onSubmit(pin);
                      }
                    }}
                    render={({ slots }) => (
                      <>
                        {slots.map((slot, i) => (
                          <PaperPinBox key={i} slot={slot} tall={sheet} invalid={Boolean(error) && !submitting} />
                        ))}
                      </>
                    )}
                  />
                </div>
                <p role="alert" aria-live="assertive" className={cn('font-wds-sans text-[12px] leading-4 text-wds-error-fg', !error && 'sr-only')}>
                  {error ?? ''}
                </p>
              </div>
              <div className={cn('flex', sheet ? 'flex-col' : 'justify-end gap-2.5')}>
                {sheet ? null : (
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    disabled={submitting}
                    className="flex h-10 items-center justify-center border border-wds-border-strong bg-wds-surface px-5 font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink outline-none transition-[background-color,transform,box-shadow] duration-100 hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100 disabled:opacity-50 motion-safe:active:scale-[0.99]"
                  >
                    {cancelLabel}
                  </button>
                )}
                <button type="button" onClick={() => onSubmit(pin)} disabled={!canSubmit} title={blockedReason} className={confirmClass}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Signing…
                    </>
                  ) : (
                    confirmLabel
                  )}
                </button>
              </div>
              {checkingPin ? <span className="sr-only">Checking your signing PIN</span> : null}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
