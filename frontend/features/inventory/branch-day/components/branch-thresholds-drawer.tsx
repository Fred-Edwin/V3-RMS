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
import { FormErrorBanner, STOCK_DRAWER_MOTION, StockErrorCard, StockMobileHeader, formatKes, formatNairobiDayMonth, useReturnFocus } from '@/features/inventory';
import { saveBranchThresholds, useBranchThresholds } from '../hooks/use-branch-day';

/**
 * Thresholds — Branch Manager (Milestone Six Session 3, plan §1.9). Desktop
 * `1IR9-0` (E3) · mobile `1J2L-0` (E4) · save error `1III-0` (E5). Two values
 * the manager owns: when a gap needs a reason, and when an overnight variance
 * alerts them. The company-wide Director amount is shown read-only. Changes
 * apply going forward — a closed day keeps the thresholds it was closed with.
 */
const MAX_KES = 1_000_000;
/** The worked example the design draws — recalculated live against the typed value. */
const EXAMPLE = { qty: 7, unit: 'pcs', item: 'beef patty', unitCost: 180 };

const parseKes = (raw: string): number | null => (/^\d+$/.test(raw) && Number(raw) <= MAX_KES ? Number(raw) : null);

function useBranchThresholdsForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const { thresholds, status, reload } = useBranchThresholds(open);
  const addToast = useWdsToastStore((s) => s.addToast);
  const [reason, setReason] = React.useState('');
  const [overnight, setOvernight] = React.useState('');
  const [seeded, setSeeded] = React.useState<{ reason: string; overnight: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(false);
  const [touched, setTouched] = React.useState({ reason: false, overnight: false });

  React.useEffect(() => {
    if (!open) {
      setSeeded(null);
      setSaveError(false);
      setTouched({ reason: false, overnight: false });
      return;
    }
    if (thresholds && status === 'ready' && seeded === null) {
      const next = { reason: String(thresholds.reasonRequiredKes), overnight: String(thresholds.overnightAlertKes ?? 0) };
      setReason(next.reason);
      setOvernight(next.overnight);
      setSeeded(next);
    }
  }, [open, thresholds, status, seeded]);

  const parsedReason = parseKes(reason.trim());
  const parsedOvernight = parseKes(overnight.trim());
  const dirty = seeded !== null && (reason.trim() !== seeded.reason || overnight.trim() !== seeded.overnight);

  const save = async (): Promise<void> => {
    if (parsedReason === null || parsedOvernight === null || !dirty || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveBranchThresholds({ reasonRequiredKes: parsedReason, overnightAlertKes: parsedOvernight });
      addToast({ variant: 'success', title: 'Thresholds saved', description: `Reason required from ${formatKes(parsedReason)} — applies from the next count.` });
      onSaved?.();
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return {
    thresholds,
    status,
    reload,
    reason,
    setReason,
    overnight,
    setOvernight,
    parsedReason,
    parsedOvernight,
    invalidReason: touched.reason && parsedReason === null,
    invalidOvernight: touched.overnight && parsedOvernight === null,
    touchReason: () => setTouched((t) => ({ ...t, reason: true })),
    touchOvernight: () => setTouched((t) => ({ ...t, overnight: true })),
    dirty,
    saving,
    saveError,
    save,
  };
}

type Form = ReturnType<typeof useBranchThresholdsForm>;

function KesField({ label, value, onChange, onBlur, invalid, mobile, help, focusMarker }: { label: string; value: string; onChange: (v: string) => void; onBlur: () => void; invalid: boolean; mobile: boolean; help: string; focusMarker?: boolean }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-wds-mono text-[11px]/[14px] uppercase tracking-[0.04em] text-wds-text-copy-muted">
        {label}
      </label>
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border bg-wds-surface transition-[border-color,box-shadow] duration-150 focus-within:border-wds-primary focus-within:shadow-wds-ring',
          invalid ? 'border-wds-error-fg' : 'border-wds-border-strong',
          mobile ? 'h-11 rounded-[4px] px-3' : 'h-[34px] w-[180px] rounded-wds-sm px-2.5',
        )}
      >
        <span className={cn('font-wds-mono text-wds-text-faint', mobile ? 'text-[14px]/[18px]' : 'text-[13px]/4')}>KES</span>
        <input
          id={id}
          data-thresholds-input={focusMarker || undefined}
          inputMode="numeric"
          autoComplete="off"
          value={value === '' ? '' : Number(value).toLocaleString('en-US')}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-help`}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={onBlur}
          className={cn('min-w-0 grow bg-transparent font-wds-mono text-wds-text-ink outline-none', mobile ? 'text-[16px]/5' : 'text-[15px]/[18px]')}
        />
      </div>
      {invalid ? (
        <p role="alert" className="font-wds-sans text-wds-caption text-wds-error-fg">
          Enter a whole amount from 0 to {MAX_KES.toLocaleString('en-US')}.
        </p>
      ) : null}
      <p id={`${id}-help`} className={cn('font-wds-sans text-wds-text-copy-muted', mobile ? 'text-[13px]/[18px]' : 'text-[12px]/4')}>
        {help}
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
        A −{EXAMPLE.qty} {EXAMPLE.unit} {EXAMPLE.item} gap at KES {EXAMPLE.unitCost}/pc = {formatKes(value)} → {threshold === null ? 'reason required from the amount above.' : required ? 'reason required.' : 'no reason needed.'}
      </p>
    </div>
  );
}

function Body({ form, mobile }: { form: Form; mobile: boolean }) {
  const t = form.thresholds;
  if (form.status === 'loading') {
    return (
      <div className="flex flex-col gap-5" role="status" aria-live="polite">
        <span className="sr-only">Loading thresholds</span>
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-2" aria-hidden>
            <Skeleton className="h-3 w-[180px]" />
            <Skeleton className={cn('h-[34px]', mobile ? 'w-full' : 'w-[180px]')} />
          </div>
        ))}
      </div>
    );
  }
  if (form.status === 'error') return <StockErrorCard title="Couldn't load thresholds" description="Check your connection and try again." onRetry={form.reload} />;
  return (
    <div className="flex flex-col gap-5">
      {form.saveError ? <FormErrorBanner title="Couldn't save thresholds" description="Nothing changed — the previous values still apply. Try again." /> : null}
      <KesField
        label="Reason required from"
        value={form.reason}
        onChange={form.setReason}
        onBlur={form.touchReason}
        invalid={form.invalidReason}
        mobile={mobile}
        focusMarker
        help="A gap line worth this much or more can't be closed without a reason. Higher than the Central Store's because branch gaps include what was sold and used. 0 means every gap needs one."
      />
      <WorkedExample threshold={form.parsedReason} mobile={mobile} />
      <KesField
        label="Overnight variance alerts me from"
        value={form.overnight}
        onChange={form.setOvernight}
        onBlur={form.touchOvernight}
        invalid={form.invalidOvernight}
        mobile={mobile}
        help="If a department's morning opening differs from last night's close by this much or more on any line, you get a push notification."
      />
      <div className="flex flex-col gap-1.5">
        <span className="font-wds-mono text-[11px]/[14px] uppercase tracking-[0.04em] text-wds-text-copy-muted">Director alerts from</span>
        <div className={cn('flex shrink-0 items-center bg-wds-neutral-50', mobile ? 'h-11 rounded-[4px] px-3' : 'h-[34px] rounded-wds-sm px-2.5')}>
          <span className={cn('font-wds-sans text-wds-text-copy-muted', mobile ? 'text-[14px]/[18px]' : 'text-[13px]/4')}>{t ? formatKes(t.directorAlertKes) : '—'} · set by the Director</span>
        </div>
      </div>
      <p className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">{t?.updatedBy && t.updatedAt ? `Last changed by ${t.updatedBy.name} · ${formatNairobiDayMonth(t.updatedAt)}` : 'Using the defaults — not changed yet'}</p>
    </div>
  );
}

export function BranchThresholdsDrawer({ open, onOpenChange, variant, branchName, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; variant: 'desktop' | 'mobile'; branchName: string; onSaved?: () => void }) {
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const form = useBranchThresholdsForm({ open, onClose: close, onSaved });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const returnFocus = useReturnFocus();

  const requestClose = React.useCallback(() => {
    if (form.saving) return;
    if (form.dirty) setConfirmOpen(true);
    else close();
  }, [form.saving, form.dirty, close]);

  const canSave = form.dirty && form.parsedReason !== null && form.parsedOvernight !== null && !form.saving && form.status === 'ready';
  const saveLabel = form.saving ? 'Saving…' : 'Save thresholds';
  const confirm = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Discard your threshold changes?"
      description="Nothing has been saved yet. The current thresholds will stay in force."
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
          <StockMobileHeader title="Thresholds" subtitle={`${branchName} · applies from the next count`} onBack={requestClose} trailingLabel="Done" onTrailing={() => (canSave ? void form.save() : requestClose())} />
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-5">
            <Body form={form} mobile />
          </div>
          <div className="border-t border-wds-border px-4 pb-6 pt-3.5">
            <Button className="h-11 w-full !rounded-[4px] text-[15px]/[18px]" onClick={() => void form.save()} disabled={!canSave} aria-busy={form.saving}>
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
              {branchName} branch. When a department gap needs a reason, and when an overnight variance alerts you. Changes apply from the next count — signed days keep the thresholds they were closed with.
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <Body form={form} mobile={false} />
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
