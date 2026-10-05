'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui2/input-otp';
import { DEMO_PIN } from '../mock/fixtures';

export interface PinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  /** What is being signed, shown above the PIN boxes so the signer can confirm it. */
  summary?: { title: string; detail: string };
  confirmLabel: string;
  /** Resolves when the action succeeded; throws to show the message under the boxes (the boxes clear and take focus again). */
  onSubmit: (pin: string) => Promise<void>;
}

const PIN_LENGTH = 4;

/**
 * PIN dialog for the mock. Same look as the shared Sign Sheet (Paper `D61-0`), but it checks the PIN against the mock engine,
 * never the real PIN service: mock screens never call the real API. The demo PIN is shown as a hint so a wrong-PIN state can be
 * demoed on purpose.
 */
export function PinDialog({ open, onOpenChange, title, subtitle, summary, confirmLabel, onSubmit }: PinDialogProps) {
  const [pin, setPin] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const field = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setPin('');
      setError(null);
    }
  }, [open]);

  const submit = async (value: string): Promise<void> => {
    if (value.length !== PIN_LENGTH || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
      setPin('');
      // Hand focus back so the retry can be typed straight away.
      setTimeout(() => field.current?.querySelector('input')?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (!submitting ? onOpenChange(o) : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[60] w-[380px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2',
            'flex flex-col overflow-hidden rounded-wds-lg border border-wds-border bg-wds-surface shadow-wds-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <div className="flex flex-col gap-wds-1 px-wds-5 pt-wds-5">
            <DialogPrimitive.Title className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{subtitle}</DialogPrimitive.Description>
          </div>
          {summary ? (
            <div className="mx-wds-5 mt-wds-4 flex flex-col gap-wds-0.5 rounded-wds-sm border border-wds-border bg-wds-surface-sunken px-wds-3.5 py-wds-2.5">
              <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{summary.title}</span>
              <span className="font-wds-mono text-wds-caption text-wds-text-copy-muted">{summary.detail}</span>
            </div>
          ) : null}
          <div className="flex flex-col gap-wds-2 p-wds-5">
            <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Enter your PIN</label>
            <div ref={field}>
              <InputOTP
                maxLength={PIN_LENGTH}
                value={pin}
                onChange={setPin}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void submit(pin);
                  }
                }}
                autoFocus
                disabled={submitting}
                aria-invalid={error ? true : undefined}
              >
                <InputOTPGroup>
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error ? (
              <p role="alert" className="font-wds-sans text-wds-caption text-wds-error-fg">
                {error}
              </p>
            ) : (
              <p className="font-wds-sans text-[11px] leading-[15px] text-wds-text-faint">Demo: the PIN is {DEMO_PIN}.</p>
            )}
          </div>
          <div className="flex gap-wds-2 px-wds-5 pb-wds-5 pt-wds-1">
            <Button variant="secondary" className="grow" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button className="grow" onClick={() => void submit(pin)} disabled={pin.length !== PIN_LENGTH || submitting}>
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
