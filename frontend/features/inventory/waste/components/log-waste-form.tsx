'use client';

import * as React from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatApiErrorMessage } from '@/types/api';
import { useDebouncedValue, useWasteItemOptions } from '../../stock/hooks/use-stock';
import { createWaste } from '../../stock/services/stock-api-service';
import type { CreateWasteResult, WasteItemOption, WasteReasonValue } from '../types/waste';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { formatKes, formatNumber, formatQty, WASTE_REASON_LABEL } from '../../_shared/components/stock-format';

/**
 * Log waste — Paper `18VZ-0` (Central Store drawer), `1BX0-0` (Central Store
 * mobile, shared by Store Manager + Attendant), `1ACM-0` (Department mobile).
 * One form, two densities. The server resolves the location from the
 * signed-in user; this form never sends one.
 *
 * Blind count: the attendant's item options carry no `onHand` (the server
 * omits it), so the hint degrades to cost only on its own — the component
 * never has an on-hand figure to show for that role.
 *
 * Interactions (§4.3 Log waste): server-searched item combobox with hint,
 * −/+ stepper (no animation — it's spammed), single-select required reason
 * chips, live waste value, submit in-flight "Logging…", error banner at the
 * top of the body with the entry kept (example `1I1M-0`).
 */

const REASONS: WasteReasonValue[] = ['SPOILAGE', 'EXPIRY', 'DAMAGE_IN_STORE', 'PREP_ERROR'];

export interface LogWasteFormState {
  item: WasteItemOption | null;
  quantity: string;
  reason: WasteReasonValue | null;
  note: string;
}

const EMPTY: LogWasteFormState = { item: null, quantity: '1', reason: null, note: '' };

export function isWasteFormDirty(state: LogWasteFormState): boolean {
  return state.item !== null || state.reason !== null || state.note.trim() !== '' || state.quantity !== EMPTY.quantity;
}

function toQtyNumber(q: string): number {
  const n = Number.parseFloat(q);
  return Number.isFinite(n) ? n : 0;
}

/** Hook: owns the form state + submit so the drawer/mobile wrappers can read dirtiness. */
export function useLogWasteForm(onLogged: (result: CreateWasteResult) => void) {
  const [state, setState] = React.useState<LogWasteFormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showValidation, setShowValidation] = React.useState(false);

  const qty = toQtyNumber(state.quantity);
  const errors = {
    item: state.item ? null : 'Pick the item that was wasted.',
    quantity: qty > 0 ? null : 'Enter a quantity above zero.',
    reason: state.reason ? null : 'Pick a reason.',
  };
  const valid = !errors.item && !errors.quantity && !errors.reason;

  const submit = React.useCallback(async () => {
    if (submitting) return;
    setShowValidation(true);
    if (!valid || !state.item || !state.reason) {
      // Focus the first invalid field (after the error text renders).
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[data-waste-form] [aria-invalid="true"]')?.focus();
      });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createWaste({
        inventoryItemId: state.item.itemId,
        quantity: String(qty),
        reason: state.reason,
        ...(state.note.trim() ? { note: state.note.trim() } : {}),
      });
      setState(EMPTY);
      setShowValidation(false);
      onLogged(result);
    } catch (err) {
      // Entry kept; the primary button retries (States kit rule 5).
      setSubmitError(formatApiErrorMessage(err, "Couldn't log waste."));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, valid, state, qty, onLogged]);

  const reset = React.useCallback(() => {
    setState(EMPTY);
    setSubmitError(null);
    setShowValidation(false);
  }, []);

  return {
    state,
    setState,
    submit,
    submitting,
    submitError,
    errors: showValidation ? errors : { item: null, quantity: null, reason: null },
    dirty: isWasteFormDirty(state),
    reset,
  };
}

type FormApi = ReturnType<typeof useLogWasteForm>;

/* ------------------------------------------------------------ item picker */

function ItemPicker({
  value,
  onChange,
  invalid,
  mobile,
  inputId,
  describedBy,
}: {
  value: WasteItemOption | null;
  onChange: (item: WasteItemOption) => void;
  invalid: boolean;
  mobile: boolean;
  inputId: string;
  describedBy: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlighted, setHighlighted] = React.useState(0);
  const debounced = useDebouncedValue(query, 250);
  const { items, status, refreshing } = useWasteItemOptions(debounced, open);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = `${inputId}-listbox`;

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  React.useEffect(() => setHighlighted(0), [debounced]);

  const choose = (item: WasteItemOption) => {
    onChange(item);
    setOpen(false);
    setQuery('');
  };

  const optionId = (i: number) => `${listboxId}-${i}`;

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          'flex items-center gap-2 border bg-wds-surface transition-colors focus-within:border-wds-primary focus-within:shadow-wds-ring',
          mobile ? 'rounded-wds-md px-3.5 py-3' : 'h-10 rounded-wds-sm px-3',
          invalid ? 'border-wds-error-fg' : 'border-wds-border-strong',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-activedescendant={open && items[highlighted] ? optionId(highlighted) : undefined}
          autoComplete="off"
          placeholder={value ? value.name : 'Search an item'}
          value={open ? query : (value?.name ?? '')}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              // Close the list only — don't let Escape close the drawer too.
              e.stopPropagation();
              setOpen(false);
              setQuery('');
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) setOpen(true);
              setHighlighted((h) => Math.min(h + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlighted((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              const item = items[highlighted];
              if (item) choose(item);
            }
          }}
          className={cn(
            'min-w-0 grow bg-transparent font-wds-sans text-wds-text-ink outline-none placeholder:text-wds-text-faint',
            mobile ? 'text-wds-section font-normal' : 'text-wds-body',
            value && !open && 'placeholder:text-wds-text-ink',
          )}
        />
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-wds-text-copy-muted transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
            open && 'rotate-180',
          )}
        />
      </div>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Items"
          aria-busy={status === 'loading' || refreshing}
          className="absolute z-50 mt-1 max-h-64 w-full origin-top overflow-y-auto rounded-wds-md border border-wds-border bg-wds-surface p-1 shadow-wds-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.98] motion-safe:duration-150"
        >
          {status === 'loading' ? (
            <div className="px-2.5 py-2 font-wds-sans text-wds-caption text-wds-text-copy-muted">Loading items…</div>
          ) : status === 'error' ? (
            <div role="alert" className="px-2.5 py-2 font-wds-sans text-wds-caption text-wds-error-fg">
              Couldn&apos;t load items — close and try again.
            </div>
          ) : items.length === 0 ? (
            <div className="px-2.5 py-2 font-wds-sans text-wds-caption text-wds-text-copy-muted">
              No items match &ldquo;{debounced}&rdquo;.
            </div>
          ) : (
            items.map((item, i) => (
              <div
                key={item.itemId}
                id={optionId(i)}
                role="option"
                aria-selected={value?.itemId === item.itemId}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => choose(item)}
                className={cn(
                  'flex cursor-pointer items-baseline justify-between gap-3 rounded-wds-sm px-2.5 py-2',
                  i === highlighted && 'bg-wds-neutral-100',
                )}
              >
                <span className="truncate font-wds-sans text-wds-body-sm text-wds-text-ink">{item.name}</span>
                <span className="shrink-0 font-wds-mono text-wds-mono-sm text-wds-text-copy-muted">
                  {item.onHand !== undefined ? `${formatQty(item.onHand, item.usageUnit)} · ` : ''}
                  {formatKes(item.unitCost)}/{item.usageUnit}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- the form */

function FieldLabel({ htmlFor, id, children, tone = 'muted' }: { htmlFor?: string; id?: string; children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <label
      htmlFor={htmlFor}
      id={id}
      className={cn('font-wds-mono text-wds-field-label uppercase', tone === 'error' ? 'text-wds-error-fg' : 'text-wds-text-copy-muted')}
    >
      {children}
    </label>
  );
}

/** The fields + footer. `locationLabel` feeds the error copy only; the header belongs to the wrapper. */
export function LogWasteFields({ form, variant }: { form: FormApi; variant: 'drawer' | 'mobile' }) {
  const mobile = variant === 'mobile';
  const { state, setState, errors, submitError } = form;
  const ids = React.useId();
  const itemId = `${ids}-item`;
  const hintId = `${ids}-hint`;
  const qtyId = `${ids}-qty`;
  const noteId = `${ids}-note`;
  const reasonLabelId = `${ids}-reason`;

  const hint = state.item
    ? state.item.onHand !== undefined
      ? `On hand ${formatQty(state.item.onHand, state.item.usageUnit)} · current cost ${formatKes(state.item.unitCost)} / ${state.item.usageUnit}`
      : `Current cost ${formatKes(state.item.unitCost)} / ${state.item.usageUnit}`
    : 'Search by name — the entry is valued at the item’s current cost.';

  const step = (delta: number) => {
    // Computed inside the updater so rapid taps each count (a render-time
    // `state` read drops increments when two taps land before a re-render).
    setState((s) => {
      const next = Math.max(0, toQtyNumber(s.quantity) + delta);
      return { ...s, quantity: String(Math.round(next * 100) / 100) };
    });
  };

  const stepButton = (label: string, delta: number, side: 'left' | 'right') => (
    <button
      type="button"
      aria-label={delta < 0 ? 'Decrease quantity' : 'Increase quantity'}
      onClick={() => step(delta)}
      disabled={delta < 0 && toQtyNumber(state.quantity) <= 0}
      className={cn(
        'flex shrink-0 touch-manipulation items-center justify-center outline-none transition-colors duration-150 hover:bg-wds-neutral-100 focus-visible:shadow-wds-ring active:bg-wds-neutral-200 disabled:cursor-not-allowed disabled:opacity-40',
        mobile
          ? cn('px-3.5 py-[11px] font-wds-mono text-wds-section font-normal text-wds-primary', side === 'left' ? 'border-r border-wds-border' : 'border-l border-wds-border')
          : 'size-[34px] rounded-wds-sm border border-wds-border-strong font-wds-sans text-[16px]/5 text-wds-text-copy-muted',
      )}
    >
      {label}
    </button>
  );

  const qtyInput = (
    <input
      id={qtyId}
      inputMode="decimal"
      value={state.quantity}
      aria-invalid={errors.quantity ? true : undefined}
      aria-describedby={errors.quantity ? `${qtyId}-err` : undefined}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        if (/^\d*\.?\d{0,2}$/.test(v)) setState((s) => ({ ...s, quantity: v }));
      }}
      onFocus={(e) => e.target.select()}
      className={cn(
        'min-w-0 grow basis-0 bg-transparent text-center font-wds-mono text-wds-section font-normal text-wds-text-ink tabular-nums outline-none',
        mobile ? 'p-[11px]' : 'h-[34px] rounded-wds-sm border focus:border-wds-primary focus:shadow-wds-ring',
        !mobile && (errors.quantity ? 'border-wds-error-fg' : 'border-wds-border-strong'),
      )}
    />
  );

  const qty = toQtyNumber(state.quantity);
  const value = state.item ? qty * Number.parseFloat(state.item.unitCost) : 0;

  return (
    <>
      <div data-waste-form className={cn('flex flex-col', mobile ? 'gap-[18px] px-4 py-[18px]' : 'gap-[18px]')}>
        {submitError ? (
          <FormErrorBanner
            title="Couldn't log waste — try again"
            description="Nothing was written to the ledger. Your entry is still filled in below."
          />
        ) : null}

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={itemId}>Item</FieldLabel>
          <ItemPicker
            value={state.item}
            onChange={(item) => setState((s) => ({ ...s, item }))}
            invalid={Boolean(errors.item)}
            mobile={mobile}
            inputId={itemId}
            describedBy={hintId}
          />
          <p id={hintId} className={cn('font-wds-sans text-wds-text-faint', mobile ? 'text-wds-field-label' : 'text-wds-caption')}>
            {hint}
          </p>
          {errors.item ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{errors.item}</p> : null}
        </div>

        <div className={cn('flex', mobile ? 'gap-2.5' : 'gap-4')}>
          <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
            <FieldLabel htmlFor={qtyId}>Quantity</FieldLabel>
            {mobile ? (
              <div
                className={cn(
                  'flex items-center overflow-hidden rounded-wds-md border focus-within:border-wds-primary focus-within:shadow-wds-ring',
                  errors.quantity ? 'border-wds-error-fg' : 'border-wds-border-strong',
                )}
              >
                {stepButton('−', -1, 'left')}
                {qtyInput}
                {stepButton('+', 1, 'right')}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {stepButton('−', -1, 'left')}
                {qtyInput}
                {stepButton('+', 1, 'right')}
              </div>
            )}
            {errors.quantity ? (
              <p id={`${qtyId}-err`} className="font-wds-sans text-wds-caption text-wds-error-fg">
                {errors.quantity}
              </p>
            ) : null}
          </div>
          <div className={cn('flex min-w-0 flex-col gap-1.5', mobile ? 'w-24 shrink-0' : 'grow basis-0')}>
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Unit</span>
            <div
              className={cn(
                'flex items-center bg-wds-neutral-50 font-wds-sans',
                mobile
                  ? 'rounded-wds-md border border-wds-border px-3.5 py-[11px] text-wds-body text-wds-text-copy-muted'
                  : 'h-[34px] justify-center rounded-wds-sm text-wds-body-sm text-wds-text-ink',
              )}
            >
              {state.item?.usageUnit ?? '—'}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span id={reasonLabelId} className={cn('text-wds-error-fg', mobile ? 'font-wds-mono text-wds-field-label' : 'font-wds-sans text-wds-caption font-semibold')}>
            REASON — required
          </span>
          <div role="radiogroup" aria-labelledby={reasonLabelId} className="flex flex-wrap gap-2">
            {REASONS.map((reason, i) => {
              const selected = state.reason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  // Roving tabindex: one tab stop for the group, arrows move within it.
                  tabIndex={selected || (!state.reason && i === 0) ? 0 : -1}
                  aria-invalid={errors.reason && i === 0 ? true : undefined}
                  onClick={() => setState((s) => ({ ...s, reason }))}
                  onKeyDown={(e) => {
                    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
                    e.preventDefault();
                    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
                    const next = REASONS[(i + dir + REASONS.length) % REASONS.length]!;
                    setState((s) => ({ ...s, reason: next }));
                    const group = e.currentTarget.parentElement;
                    (group?.children[REASONS.indexOf(next)] as HTMLElement | undefined)?.focus();
                  }}
                  className={cn(
                    'border px-3.5 py-2 font-wds-sans text-wds-body-sm outline-none transition-[background-color,border-color,color,transform] duration-200 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]',
                    mobile ? 'rounded-wds-md' : 'rounded-wds-sm',
                    selected
                      ? 'border-transparent bg-wds-gradient-primary font-medium text-wds-surface'
                      : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-100',
                  )}
                >
                  {WASTE_REASON_LABEL[reason]}
                </button>
              );
            })}
          </div>
          {errors.reason ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{errors.reason}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={noteId}>
            {/* `1BX0-0` / `1ACM-0` keep the suffix lower-case on mobile ("NOTE — optional"). */}
            Note{mobile ? <span className="normal-case"> — optional</span> : ' — optional'}
          </FieldLabel>
          <textarea
            id={noteId}
            value={state.note}
            maxLength={500}
            onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
            placeholder={mobile ? 'What happened? e.g. left out of the chiller overnight.' : 'What happened? e.g. left in the cold room overnight.'}
            className={cn(
              'resize-none border bg-wds-surface font-wds-sans text-wds-body-sm text-wds-text-ink outline-none transition-colors placeholder:text-wds-text-faint focus:border-wds-primary focus:shadow-wds-ring',
              mobile ? 'min-h-16 rounded-wds-md border-wds-border-strong px-3.5 py-3' : 'h-14 rounded-wds-sm border-wds-border px-3 py-2.5',
            )}
          />
        </div>
      </div>

      <WasteFooter form={form} mobile={mobile} value={value} />
    </>
  );
}

function WasteFooter({ form, mobile, value }: { form: FormApi; mobile: boolean; value: number }) {
  return (
    <div
      className={cn(
        'flex flex-col',
        mobile ? 'mt-auto gap-2 border-t border-wds-border bg-wds-surface px-4 pb-5 pt-3.5' : 'mt-auto gap-[18px]',
      )}
    >
      <div className={cn('flex items-center justify-between', !mobile && 'border-t border-wds-border pt-3.5')}>
        <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Waste value</span>
        <span
          key={Math.round(value)}
          aria-live="polite"
          className={cn(
            'font-wds-mono text-wds-text-ink tabular-nums motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-150',
            mobile ? 'text-[16px]/5' : 'text-[18px]/[22px] font-semibold',
          )}
        >
          {formatKes(value)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void form.submit()}
        disabled={form.submitting}
        className={cn(
          'flex items-center justify-center gap-2 bg-wds-gradient-primary font-wds-sans text-wds-primary-fg shadow-wds-sheen outline-none transition-[filter,transform] duration-150 ease-out hover:brightness-110 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70',
          mobile ? 'rounded-wds-md p-3.5 text-wds-section font-medium' : 'rounded-wds-sm p-3 text-wds-body font-semibold',
        )}
      >
        {form.submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Logging…
          </>
        ) : (
          'Log waste'
        )}
      </button>
    </div>
  );
}

export { formatNumber };
