'use client';

import * as React from 'react';

import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { cn } from '@/lib/cn';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { CountSettings, SettingsPreview } from '../../_shared/types/counting-contract';

/**
 * Count settings (Paper step 25 `21T8-0` for the Manager, step 45 `24TJ-0` for the Director): "Worth up to KES" and "And at most %
 * of expected" (both must hold), what that does to the last 7 days, the repeat-shortfall switch, and the Director alert amount. The
 * server's `can` flags decide which part is editable: the range and the switch for the person who sets them, the alert amount for
 * the person who sets that; the rest is shown read only. Applies from the next signed count; counts already signed keep theirs.
 * Closing with unsaved changes asks first.
 */
export function CountSettingsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const settings = useLoader(open ? 'count-settings' : null, () => countingApi.settings(), COUNTING_STATES_COPY.countSettings.error);
  const data = settings.data;
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : undefined)}>
      {/* The body decides whether a close needs confirming, so closing is requested through `onRequestClose`. */}
      {open ? <Body data={data} status={settings.status} onReload={() => void settings.reload()} onClose={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

const numeric = /^\d*\.?\d*$/;

function Body({ data, status, onReload, onClose }: { data: CountSettings | null; status: string; onReload: () => void; onClose: () => void }) {
  const [rangeKes, setRangeKes] = React.useState('');
  const [rangePercent, setRangePercent] = React.useState('');
  const [flag, setFlag] = React.useState(true);
  const [alertKes, setAlertKes] = React.useState('');
  const [preview, setPreview] = React.useState<SettingsPreview | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    setRangeKes(String(data.rangeKes));
    setRangePercent(data.rangePercent);
    setFlag(data.flagRepeatShortfalls);
    setAlertKes(String(data.directorAlertKes));
  }, [data]);

  const editRange = Boolean(data?.can.editRange);
  const editAlert = Boolean(data?.can.editDirectorAlert);
  const dirty = Boolean(data) && (rangeKes !== String(data?.rangeKes) || rangePercent !== data?.rangePercent || flag !== data?.flagRepeatShortfalls || alertKes !== String(data?.directorAlertKes));
  const kesBad = rangeKes.trim() === '' || Number(rangeKes) < 0;
  const pctBad = rangePercent.trim() === '' || Number(rangePercent) < 0 || Number(rangePercent) > 100;
  const alertBad = alertKes.trim() === '' || Number(alertKes) <= 0;
  const invalid = (editRange && (kesBad || pctBad)) || (editAlert && alertBad);

  // "How this plays out": the server recomputes the last 7 days of signed counts with the numbers typed, 300 ms after the last key.
  React.useEffect(() => {
    if (!data || invalid) return;
    const t = window.setTimeout(() => {
      countingApi.settingsPreview({ rangeKes: Number(rangeKes), rangePercent, directorAlertKes: Number(alertKes) }).then(setPreview, () => setPreview(null));
    }, 300);
    return () => window.clearTimeout(t);
  }, [data, invalid, rangeKes, rangePercent, alertKes]);

  const requestClose = (): void => {
    if (dirty && !saving) setConfirmLeave(true);
    else onClose();
  };

  const save = async (): Promise<void> => {
    if (saving || invalid || !data) return;
    setSaving(true);
    setFailure(null);
    try {
      if (editRange && (rangeKes !== String(data.rangeKes) || rangePercent !== data.rangePercent || flag !== data.flagRepeatShortfalls)) {
        await countingApi.updateSettings({ rangeKes: Number(rangeKes), rangePercent, flagRepeatShortfalls: flag });
      }
      if (editAlert && alertKes !== String(data.directorAlertKes)) await countingApi.updateDirectorAlert(Number(alertKes));
      useWdsToastStore.getState().addToast({ variant: 'success', title: editAlert && !editRange ? 'Alert amount saved' : 'Settings saved', description: 'Applies from the next signed count.' });
      onClose();
    } catch (err) {
      setFailure(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.countSettings.error));
      setSaving(false);
    }
  };

  const directorOnly = editAlert && !editRange;
  const labelCls = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary';
  const field = (readOnly: boolean, bad: boolean) =>
    cn(
      'flex h-11 items-center justify-between px-3 transition-[border-color,box-shadow] duration-100',
      readOnly ? 'border border-wds-border bg-wds-neutral-50' : bad ? 'border-[1.5px] border-wds-error-fg' : 'border border-wds-border-strong bg-wds-surface focus-within:border-[1.5px] focus-within:border-wds-selected-edge focus-within:shadow-wds-ring',
    );

  return (
    <>
      <SheetContent side="right" className="w-[480px] gap-0 border-l border-wds-border-strong" onEscapeKeyDown={(e) => { e.preventDefault(); requestClose(); }} onInteractOutside={(e) => { e.preventDefault(); requestClose(); }}>
        <SheetHeader className="border-b-0 px-7 pb-4 pt-6">
          <SheetTitle className="text-[20px] leading-[26px]">Count settings</SheetTitle>
          <SheetDescription className="text-[13px] leading-4 text-wds-text-secondary">
            {directorOnly ? "What counts as within range is the Store Manager's. The alert amount is yours." : 'What counts as within range'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-7" aria-busy={status === 'loading'}>
          {status === 'error' ? (
            <FormErrorBanner title="Could not load the settings" description={COUNTING_STATES_COPY.countSettings.error} />
          ) : !data ? (
            <div aria-hidden className="flex flex-col gap-5">
              <Skeleton className="h-[72px] w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <>
              {failure ? <FormErrorBanner title="Could not save" description={failure} /> : null}
              <div className={cn('flex flex-col gap-2', directorOnly && 'pt-1')}>
                <h3 className={labelCls}>{editRange ? 'A difference is within range when both are true' : 'Within range · set by the Store Manager'}</h3>
                <div className="flex gap-3">
                  <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
                    <label htmlFor="range-kes" className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                      Worth up to
                    </label>
                    <div className={field(!editRange, editRange && kesBad && Boolean(touched.kes))}>
                      <input
                        id="range-kes"
                        inputMode="decimal"
                        readOnly={!editRange}
                        value={rangeKes}
                        aria-invalid={editRange && kesBad}
                        onChange={(e) => numeric.test(e.target.value) && setRangeKes(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, kes: true }))}
                        className={cn('min-w-0 grow bg-transparent font-wds-mono text-[16px] leading-5 outline-none', editRange ? 'text-wds-text-ink' : 'text-wds-text-secondary')}
                      />
                      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">KES</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
                    <label htmlFor="range-pct" className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                      And at most
                    </label>
                    <div className={field(!editRange, editRange && pctBad && Boolean(touched.pct))}>
                      <input
                        id="range-pct"
                        inputMode="decimal"
                        readOnly={!editRange}
                        value={rangePercent}
                        aria-invalid={editRange && pctBad}
                        onChange={(e) => numeric.test(e.target.value) && setRangePercent(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, pct: true }))}
                        className={cn('min-w-0 grow bg-transparent font-wds-mono text-[16px] leading-5 outline-none', editRange ? 'text-wds-text-ink' : 'text-wds-text-secondary')}
                      />
                      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">% of expected</span>
                    </div>
                  </div>
                </div>
                {editRange && ((touched.kes && kesBad) || (touched.pct && pctBad)) ? (
                  <p role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
                    {kesBad ? 'Enter an amount of 0 or more.' : 'Enter a percentage from 0 to 100.'}
                  </p>
                ) : null}
              </div>

              {editRange ? (
                <div className="flex flex-col gap-2 border border-wds-border bg-wds-neutral-50 px-4 py-3.5" aria-live="polite">
                  <h3 className={labelCls}>How this plays out, last 7 days</h3>
                  <div className="flex justify-between font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                    <span>Within range</span>
                    <span className="font-wds-mono">{preview ? `${preview.range.withinRange} lines` : '–'}</span>
                  </div>
                  <div className="flex justify-between font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                    <span>Outside the range</span>
                    <span className="font-wds-mono text-wds-error-fg">{preview ? `${preview.range.outsideRange} lines` : '–'}</span>
                  </div>
                  {preview?.range.hint ? <p className="font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{preview.range.hint}</p> : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <h3 className={labelCls}>Repeat shortfalls{editRange ? '' : ' · set by the Store Manager'}</h3>
                <div className={cn('flex items-center gap-3 px-3.5 py-3', editRange ? 'border border-wds-border-strong' : 'border border-wds-border bg-wds-neutral-50')}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={flag}
                    aria-label="Flag a repeat shortfall"
                    disabled={!editRange}
                    onClick={() => setFlag((f) => !f)}
                    className={cn(
                      'relative h-5 w-[34px] shrink-0 rounded-[10px] outline-none transition-colors duration-150 focus-visible:shadow-wds-ring disabled:cursor-not-allowed motion-reduce:transition-none',
                      flag ? 'bg-[var(--wds-primary-btn-end)]' : 'bg-wds-neutral-300',
                      !editRange && 'opacity-60',
                    )}
                  >
                    <span className={cn('absolute top-0.5 size-4 rounded-[8px] bg-wds-surface transition-[left] duration-150 motion-reduce:transition-none', flag ? 'left-[16px]' : 'left-0.5')} />
                  </button>
                  <span className="grow font-wds-sans text-[13px] leading-4 text-wds-text-ink">Flag an item short in 3 counts in a row, even inside the range</span>
                </div>
              </div>

              {editAlert ? (
                <div className="flex flex-col gap-2 border-t border-wds-border pt-5">
                  <h3 className={cn(labelCls, 'text-wds-warning-fg')}>Director alert · set by you</h3>
                  <div className={field(false, alertBad && Boolean(touched.alert))}>
                    <input
                      id="alert-kes"
                      aria-label="Director alert amount in KES"
                      inputMode="numeric"
                      value={alertKes === '' ? '' : Number(alertKes).toLocaleString('en-KE')}
                      aria-invalid={alertBad}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, '');
                        setAlertKes(raw);
                      }}
                      onBlur={() => setTouched((t) => ({ ...t, alert: true }))}
                      className="min-w-0 grow bg-transparent font-wds-mono text-[16px] leading-5 text-wds-text-ink outline-none"
                    />
                    <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">KES</span>
                  </div>
                  {touched.alert && alertBad ? (
                    <p role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
                      Enter an amount above 0.
                    </p>
                  ) : null}
                  <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">You are told when a signed count is short by more than this in one count. Raising it means fewer alerts. Counts already signed keep the alert they had.</p>
                  <div className="flex flex-col gap-1 border border-wds-border bg-wds-neutral-50 px-3.5 py-3" aria-live="polite">
                    <span className={labelCls}>Last 7 days</span>
                    <span className="font-wds-sans text-[13px] leading-[19px] text-wds-text-ink">{preview?.alert.hint ?? '…'}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <h3 className={labelCls}>Director alert · set by the Director</h3>
                  <div className="flex h-11 items-center justify-between border border-wds-border bg-wds-neutral-50 px-3">
                    <span className="font-wds-mono text-[15px] leading-5 text-wds-text-secondary">KES {data.directorAlertKes.toLocaleString('en-KE')}</span>
                    <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">read only</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-wds-border px-7 pb-6 pt-4">
          <button type="button" onClick={requestClose} className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge outline-none hover:underline focus-visible:shadow-wds-ring">
            Cancel
          </button>
          {data && (editRange || editAlert) ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || invalid || !dirty}
              title={invalid ? 'Fix the highlighted number first' : !dirty ? 'Nothing has changed' : undefined}
              className="flex h-10 items-center bg-wds-gradient-primary px-5 font-wds-sans text-[14px] font-semibold leading-5 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.99]"
            >
              {saving ? 'Saving…' : directorOnly ? 'Save alert amount' : 'Save settings'}
            </button>
          ) : status === 'error' ? (
            <button type="button" onClick={onReload} className="font-wds-sans text-[13px] font-medium text-wds-selected-edge underline">
              Try again
            </button>
          ) : null}
        </div>
      </SheetContent>
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Discard your changes?"
        description="You changed these settings but have not saved them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive={false}
        onConfirm={() => {
          setConfirmLeave(false);
          onClose();
        }}
      />
    </>
  );
}
