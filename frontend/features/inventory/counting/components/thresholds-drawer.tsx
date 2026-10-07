'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui2/sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useThresholds } from '../hooks/use-counts';
import { saveThresholds } from '../services/count-api-service';
import { FormErrorBanner, StockErrorCard } from '../../_shared/components/stock-states';
import { StockMobileHeader } from '../../_shared/components/stock-mobile-header';
import { STOCK_DRAWER_MOTION, useReturnFocus } from '../../waste/components/log-waste-drawer';
import { formatKes, formatNairobiDayMonth } from '../../_shared/components/stock-format';

/**
 * Thresholds — Store Manager (Milestone Six Session 2, plan §1.9).
 * Desktop drawer `1I9H-0` · mobile `1IY4-0` · save error `1III-0`. The
 * Central Store reason threshold is the only editable value; the company-wide
 * Director amount is shown read-only ("set by the Director"). Changes apply
 * going forward — every signed count line keeps the threshold it was judged
 * against.
 */

const MAX_KES = 1_000_000;
/** The worked example the design draws — recalculated live against the typed value. */
const EXAMPLE = { qty: 9, unit: 'kg', item: 'chicken', unitCost: 90 };

function parseKes(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n <= MAX_KES ? n : null;
}

interface ThresholdsFormProps {
  variant: 'desktop' | 'mobile';
  open: boolean;
  onClose: () => void;
  onSaved?: (reasonRequiredKes: number) => void;
}

function useThresholdsForm({ open, onClose, onSaved }: Pick<ThresholdsFormProps, 'open' | 'onClose' | 'onSaved'>) {
  const { thresholds, status, reload } = useThresholds(open);
  const addToast = useWdsToastStore((s) => s.addToast);
  const [value, setValue] = React.useState('');
  const [seededFrom, setSeededFrom] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  // Seed the field from the server value each time the drawer opens with fresh data.
  React.useEffect(() => {
    if (!open) {
      setSeededFrom(null);
      setSaveError(false);
      setTouched(false);
      return;
    }
    if (thresholds && status === 'ready' && seededFrom === null) {
      setValue(String(thresholds.reasonRequiredKes));
      setSeededFrom(String(thresholds.reasonRequiredKes));
    }
  }, [open, thresholds, status, seededFrom]);

  const parsed = parseKes(value.trim());
  const dirty = seededFrom !== null && value.trim() !== seededFrom;
  const invalid = touched && parsed === null;

  const save = async (): Promise<void> => {
    if (parsed === null || !dirty || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveThresholds(parsed);
      addToast({
        variant: 'success',
        title: 'Thresholds saved',
        description: `Reason required from ${formatKes(parsed)} — applies from the next count.`,
      });
      onSaved?.(parsed);
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return { thresholds, status, reload, value, setValue, dirty, invalid, parsed, saving, saveError, save, touch: () => setTouched(true) };
}

function KesField({ form, mobile }: { form: ReturnType<typeof useThresholdsForm>; mobile: boolean }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-wds-mono text-[11px]/[14px] tracking-[0.04em] text-wds-text-copy-muted">
        REASON REQUIRED FROM
      </label>
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border bg-wds-surface transition-[border-color,box-shadow] duration-150 focus-within:border-wds-primary focus-within:shadow-wds-ring',
          form.invalid ? 'border-wds-error-fg' : 'border-wds-border-strong',
          mobile ? 'h-11 rounded-[4px] px-3' : 'h-[34px] w-[180px] rounded-wds-sm px-2.5',
        )}
      >
        <span className={cn('font-wds-mono text-wds-text-faint', mobile ? 'text-[14px]/[18px]' : 'text-[13px]/4')}>KES</span>
        <input
          id={id}
          data-thresholds-input
          inputMode="numeric"
          autoComplete="off"
          value={form.value}
          disabled={form.status !== 'ready'}
          aria-invalid={form.invalid || undefined}
          aria-describedby={`${id}-help`}
          onChange={(e) => form.setValue(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={form.touch}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void form.save();
            }
          }}
          className={cn('min-w-0 grow bg-transparent font-wds-mono text-wds-text-ink outline-none', mobile ? 'text-[16px]/5' : 'text-[15px]/[18px]')}
        />
      </div>
      {form.invalid ? (
        <p role="alert" className="font-wds-sans text-wds-caption text-wds-error-fg">
          Enter a whole amount from 0 to {MAX_KES.toLocaleString('en-US')}.
        </p>
      ) : null}
      <p id={`${id}-help`} className={cn('font-wds-sans text-wds-text-copy-muted', mobile ? 'text-[13px]/[18px]' : 'text-[12px]/4')}>
        A count line whose variance is worth this much or more can&apos;t be accepted without a reason. 0 means every variance needs one.
      </p>
    </div>
  );
}

function WorkedExample({ threshold, mobile }: { threshold: number | null; mobile: boolean }) {
  const value = EXAMPLE.qty * EXAMPLE.unitCost;
  const required = threshold !== null && value >= threshold;
  return (
    <div className={cn('flex gap-2 rounded-[4px] bg-wds-neutral-50', mobile ? 'p-3' : 'px-3 py-2.5')}>
      <span className={cn('shrink-0 rounded-full bg-wds-neutral-400', mobile ? 'mt-[7px] size-[5px]' : 'mt-[5px] size-1.5')} aria-hidden />
      <p className={cn('font-wds-sans text-wds-text-copy-muted', mobile ? 'text-[13px]/[18px]' : 'text-[12px]/4')} aria-live="polite">
        A −{EXAMPLE.qty} {EXAMPLE.unit} {EXAMPLE.item} variance at KES {EXAMPLE.unitCost}/{EXAMPLE.unit} = {formatKes(value)} →{' '}
        {threshold === null ? 'reason required from the amount above.' : required ? 'reason required.' : 'no reason needed.'}
      </p>
    </div>
  );
}

function DirectorReadOnly({ amount, mobile }: { amount: number | null; mobile: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-wds-mono text-[11px]/[14px] tracking-[0.04em] text-wds-text-copy-muted">DIRECTOR ALERTS FROM</span>
      <div className={cn('flex shrink-0 items-center bg-wds-neutral-50', mobile ? 'h-11 rounded-[4px] px-3' : 'h-[34px] rounded-wds-sm px-2.5')}>
        <span className={cn('font-wds-sans text-wds-text-copy-muted', mobile ? 'text-[14px]/[18px]' : 'text-[13px]/4')}>
          {amount === null ? '—' : formatKes(amount)} · set by the Director
        </span>
      </div>
    </div>
  );
}

function ThresholdsBody({ form, mobile }: { form: ReturnType<typeof useThresholdsForm>; mobile: boolean }) {
  const t = form.thresholds;
  if (form.status === 'loading') {
    return (
      <div className="flex flex-col gap-5" role="status" aria-live="polite">
        <span className="sr-only">Loading thresholds</span>
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-3 w-[140px]" />
          <Skeleton className={cn('h-[34px]', mobile ? 'w-full' : 'w-[180px]')} />
        </div>
      </div>
    );
  }
  if (form.status === 'error') {
    return <StockErrorCard title="Couldn't load thresholds" description="Check your connection and try again." onRetry={form.reload} />;
  }
  return (
    <div className="flex flex-col gap-5">
      {form.saveError ? (
        <FormErrorBanner
          title="Couldn't save thresholds"
          description="Nothing changed — the previous values still apply. Your edit is still here; press Save again."
        />
      ) : null}
      <KesField form={form} mobile={mobile} />
      <WorkedExample threshold={form.parsed} mobile={mobile} />
      <DirectorReadOnly amount={t?.directorAlertKes ?? null} mobile={mobile} />
      <p className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
        {t?.updatedBy && t.updatedAt
          ? `Last changed by ${t.updatedBy.name} · ${formatNairobiDayMonth(t.updatedAt)}`
          : 'Using the default — not changed yet'}
      </p>
    </div>
  );
}

export function ThresholdsDrawer({
  open,
  onOpenChange,
  variant,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'desktop' | 'mobile';
  onSaved?: (reasonRequiredKes: number) => void;
}) {
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const form = useThresholdsForm({ open, onClose: close, onSaved });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const returnFocus = useReturnFocus();

  const requestClose = React.useCallback(() => {
    if (form.saving) return;
    if (form.dirty) setConfirmOpen(true);
    else close();
  }, [form.saving, form.dirty, close]);

  const canSave = form.dirty && form.parsed !== null && !form.saving && form.status === 'ready';
  const saveLabel = form.saving ? 'Saving…' : 'Save thresholds';
  const confirm = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Discard your threshold change?"
      description="Nothing has been saved yet. The current threshold will stay in force."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => {
        setConfirmOpen(false);
        close();
      }}
    />
  );

  if (variant === 'mobile') {
    if (!open) return null;
    return (
      <>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thresholds"
          onKeyDown={(e) => {
            if (e.key === 'Escape') requestClose();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-wds-canvas motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-[250ms] motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          <MobileStatusBar className="bg-wds-sidebar-top" />
          <StockMobileHeader
            title="Thresholds"
            subtitle="When a count variance needs a reason — applies from the next count"
            onBack={requestClose}
            trailingLabel="Done"
            onTrailing={() => (canSave ? void form.save() : requestClose())}
          />
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-5">
            <ThresholdsBody form={form} mobile />
          </div>
          <div className="border-t border-wds-border p-4">
            <Button className="h-11 w-full" onClick={() => void form.save()} disabled={!canSave} aria-busy={form.saving}>
              {saveLabel}
            </Button>
          </div>
        </div>
        {confirm}
      </>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <SheetContent
          className={cn('flex w-[440px] flex-col gap-0 p-0 [&>button:first-of-type]:hidden', STOCK_DRAWER_MOTION)}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onCloseAutoFocus={returnFocus.restore}
          onOpenAutoFocus={(e) => {
            returnFocus.capture();
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>('[data-thresholds-input]')?.focus();
          }}
        >
          <div className="flex shrink-0 flex-col gap-0.5 border-b border-wds-border px-6 pb-4 pt-5">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">Thresholds</SheetTitle>
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
            <SheetDescription className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
              When a Central Store count variance needs a reason. Changes apply from the next count — signed records keep the threshold they were judged against.
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <ThresholdsBody form={form} mobile={false} />
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-wds-border px-6 py-4">
            <Button variant="secondary" onClick={requestClose} disabled={form.saving}>
              Cancel
            </Button>
            <Button onClick={() => void form.save()} disabled={!canSave} aria-busy={form.saving}>
              {saveLabel}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {confirm}
    </>
  );
}
