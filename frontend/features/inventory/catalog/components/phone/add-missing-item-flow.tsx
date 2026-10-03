'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { useAction } from '../../../_shared/hooks/use-async';
import { PhoneErrorNote, PhoneFieldLabel, PhoneHeader, PhonePrimaryButton, PhoneSuccessNote } from '../../../_shared/components/phone-parts';
import { createItem } from '../../../services';
import { matchItems, MISSING_ITEM_TYPES, missingItemErrors, packPreview, pluralUnit, tidyName, toMissingItemInput, type MissingItemDraft, type MissingItemField } from '../../lib/missing-item';
import type { InventoryItem } from '../../../types';

/**
 * The attendant adds a missing item — Paper chapter 6, steps 24–26. Opens over the delivery when the search finds nothing:
 * not found → name it and say how it comes → count what arrived. No prices and no stock figures anywhere (§29.4); the item
 * lands under "Needs setup" for the Store Manager.
 */
export interface AddMissingItemFlowProps {
  /** Items the search runs over (already without costs for an attendant). */
  items: readonly InventoryItem[];
  /** "Samrat Supermarket Ltd" */
  supplierName: string;
  /** Text typed in the search box when the flow opens. */
  initialQuery?: string;
  onClose: () => void;
  /** An existing or new item and how many arrived: the delivery gets the line, the flow closes. */
  onDone: (item: InventoryItem, quantity: string) => void;
}

type Step = { kind: 'search' } | { kind: 'form' } | { kind: 'count'; item: InventoryItem };

const field =
  'flex h-11 w-full items-center border bg-wds-surface px-3 font-wds-sans text-[15px] leading-5 text-wds-text-ink outline-none transition-colors duration-150 ease-out placeholder:text-wds-text-faint focus-visible:border-wds-primary focus-visible:shadow-wds-ring';

const todayLabel = (): string => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function AddMissingItemFlow({ items, supplierName, initialQuery = '', onClose, onDone }: AddMissingItemFlowProps) {
  const userName = useAuthStore((s) => s.user?.name);
  const [step, setStep] = React.useState<Step>({ kind: 'search' });
  const [query, setQuery] = React.useState(initialQuery);
  const [draft, setDraft] = React.useState<MissingItemDraft>({ name: '', type: 'STOCKED', packUnit: '', holds: '', usageUnit: '' });
  const [touched, setTouched] = React.useState(false);
  const create = useAction(createItem, 'Could not add the item. Check the connection and try again.');
  const subtitle = `${supplierName || 'This delivery'} · ${todayLabel()}`;

  const matches = React.useMemo(() => matchItems(items, query), [items, query]);
  const trimmed = query.trim();
  const exact = matches.some((m) => m.name.toLowerCase() === trimmed.toLowerCase());

  const startForm = () => {
    setDraft((d) => ({ ...d, name: tidyName(query) }));
    setTouched(false);
    create.clear();
    setStep({ kind: 'form' });
  };

  const errors = missingItemErrors(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const set = <K extends keyof MissingItemDraft>(key: K, value: MissingItemDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const showError = (key: MissingItemField): string | undefined => (touched ? errors[key] : undefined);

  const submit = async () => {
    setTouched(true);
    if (hasErrors) return;
    const result = await create.run(toMissingItemInput(draft));
    if (result) setStep({ kind: 'count', item: result.item });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-wds-canvas" role="dialog" aria-modal="true" aria-label="Add to delivery">
      {step.kind === 'search' ? (
        <>
          <PhoneHeader title="Add to delivery" subtitle={subtitle} leading="back" onLeading={onClose} />
          <div className="flex flex-col gap-[18px] px-4 py-5">
            <input
              autoFocus
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for an item"
              aria-label="Search for an item"
              className={cn(field, 'h-12 border-[1.5px] border-wds-primary text-[16px]')}
            />
            {matches.length > 0 ? (
              <ul className="flex flex-col border border-wds-border bg-wds-surface">
                {matches.map((item) => (
                  <li key={item.id} className="border-b border-wds-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setStep({ kind: 'count', item })}
                      className="flex min-h-12 w-full flex-col items-start justify-center gap-0.5 px-3.5 py-2 text-left outline-none transition-colors duration-150 ease-out hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
                    >
                      <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{item.name}</span>
                      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">comes in {pluralUnit(item.buyUnit)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {trimmed !== '' && !exact ? (
              <>
                {matches.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 border border-dashed border-wds-border-strong px-4 py-[26px]">
                    <p className="text-center font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">No item called &quot;{trimmed}&quot;</p>
                    <p className="max-w-[300px] text-center font-wds-sans text-[13px] leading-[18px] text-wds-text-copy-muted">
                      Check the spelling, or add it now so you can finish this delivery.
                    </p>
                  </div>
                ) : null}
                <PhonePrimaryButton onClick={startForm}>Add &quot;{tidyName(trimmed)}&quot; as a new item</PhonePrimaryButton>
                <p className="text-center font-wds-sans text-[12px] leading-[17px] text-wds-text-copy-muted">
                  You do not need approval. The Store Manager sees it under Needs setup and adds the category, price and supplier.
                </p>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {step.kind === 'form' ? (
        <>
          <PhoneHeader title="New item" subtitle="Three quick things. No prices or stock." leading="back" onLeading={() => setStep({ kind: 'search' })} />
          <form
            className="flex grow flex-col gap-4 px-4 py-[18px]"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {create.failure ? <PhoneErrorNote>{create.failure.message}</PhoneErrorNote> : null}
            <div className="flex flex-col gap-1.5">
              <PhoneFieldLabel htmlFor="missing-name">Name</PhoneFieldLabel>
              <input
                id="missing-name"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                aria-invalid={Boolean(showError('name'))}
                className={cn(field, 'border-[1.5px]', showError('name') ? 'border-wds-error-fg' : 'border-wds-primary')}
              />
              {showError('name') ? <p className="font-wds-sans text-[12px] text-wds-error-fg">{showError('name')}</p> : null}
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-ink">What is it?</legend>
              {MISSING_ITEM_TYPES.map((option) => {
                const on = draft.type === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2 transition-colors duration-150 ease-out focus-within:shadow-wds-ring',
                      on ? 'border-[1.5px] border-wds-primary bg-wds-espresso-50' : 'border border-wds-border-strong bg-wds-surface'
                    )}
                  >
                    <input type="radio" name="missing-type" value={option.value} checked={on} onChange={() => set('type', option.value)} className="sr-only" />
                    <span
                      aria-hidden="true"
                      className={cn('size-4 shrink-0 rounded-full bg-wds-surface', on ? 'border-[5px] border-wds-primary' : 'border-[1.5px] border-wds-border-strong')}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className={cn('font-wds-sans text-[14px] leading-[18px] text-wds-text-ink', on && 'font-medium')}>{option.label}</span>
                      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">{option.explainer}</span>
                    </span>
                  </label>
                );
              })}
              <p className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">Prepped items come from a Prep run, so they are not offered here.</p>
            </fieldset>

            <div className="flex flex-col gap-2">
              <PhoneFieldLabel>How it arrives</PhoneFieldLabel>
              <div className="flex gap-2.5">
                <div className="flex grow basis-0 flex-col gap-[5px]">
                  <label htmlFor="missing-pack" className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">It comes in a</label>
                  <input
                    id="missing-pack"
                    value={draft.packUnit}
                    onChange={(e) => set('packUnit', e.target.value)}
                    placeholder="tin"
                    aria-invalid={Boolean(showError('packUnit'))}
                    className={cn(field, 'border', showError('packUnit') ? 'border-wds-error-fg' : 'border-wds-border-strong')}
                  />
                </div>
                <div className="flex grow basis-0 flex-col gap-[5px]">
                  <label htmlFor="missing-holds" className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">One holds</label>
                  <div className={cn(field, 'gap-1.5 border focus-within:border-wds-primary focus-within:shadow-wds-ring', showError('holds') ? 'border-wds-error-fg' : 'border-wds-border-strong')}>
                    <input
                      id="missing-holds"
                      inputMode="decimal"
                      value={draft.holds}
                      onChange={(e) => set('holds', e.target.value)}
                      placeholder="400"
                      aria-invalid={Boolean(showError('holds'))}
                      className="w-full min-w-0 bg-transparent font-wds-mono text-[15px] outline-none placeholder:text-wds-text-faint"
                    />
                    <input
                      aria-label="Unit it is counted in"
                              value={draft.usageUnit}
                      onChange={(e) => set('usageUnit', e.target.value)}
                      placeholder="g"
                      className="w-12 shrink-0 bg-transparent font-wds-sans text-[13px] text-wds-text-copy-muted outline-none placeholder:text-wds-text-faint"
                    />
                  </div>
                </div>
              </div>
              {(['packUnit', 'holds', 'usageUnit'] as const).map((key) =>
                showError(key) ? (
                  <p key={key} className="font-wds-sans text-[12px] text-wds-error-fg">
                    {showError(key)}
                  </p>
                ) : null
              )}
              <div className="border border-wds-border bg-wds-neutral-50 px-3 py-2.5">
                <p className="min-h-4 font-wds-mono text-[13px] leading-4 text-wds-text-ink">{packPreview(draft) || '1 … = …'}</p>
              </div>
            </div>

            <div className="grow" />
            <PhonePrimaryButton type="submit" disabled={create.saving}>
              {create.saving ? 'Adding…' : 'Add item'}
            </PhonePrimaryButton>
            <p className="text-center font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">Logged as added by {userName ?? 'you'}.</p>
          </form>
        </>
      ) : null}

      {step.kind === 'count' ? <CountView item={step.item} subtitle={subtitle} justAdded={!items.some((i) => i.id === step.item.id)} onDone={onDone} onClose={onClose} /> : null}
    </div>
  );
}

function CountView({
  item,
  subtitle,
  justAdded,
  onDone,
  onClose,
}: {
  item: InventoryItem;
  subtitle: string;
  justAdded: boolean;
  onDone: (item: InventoryItem, quantity: string) => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = React.useState(1);
  const unit = pluralUnit(item.buyUnit);
  const step = 'flex h-14 w-16 shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[24px] leading-[30px] text-wds-text-ink outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97] disabled:opacity-40';
  return (
    <>
      <PhoneHeader title="Add to delivery" subtitle={subtitle} leading="back" onLeading={onClose} />
      <div className="flex grow flex-col gap-4 px-4 py-[18px]">
        {justAdded ? (
          <PhoneSuccessNote title={`${item.name} added`}>The Store Manager will see it under Needs setup. Carry on with the delivery.</PhoneSuccessNote>
        ) : null}
        <div className="flex flex-col gap-2">
          <PhoneFieldLabel>How many did you receive?</PhoneFieldLabel>
          <div className="flex flex-col gap-3 border border-wds-border bg-wds-surface p-4">
            <div className="flex flex-col gap-0.5">
              <p className="font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{item.name}</p>
              <p className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">
                {unit}
                {item.conversionFactor ? ` · 1 ${item.buyUnit} = ${Number.parseFloat(item.conversionFactor)} ${item.usageUnit}` : ''}
              </p>
            </div>
            <div className="flex items-center" aria-label={`Quantity of ${item.name}`} role="group">
              <button type="button" className={step} onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="One fewer">
                −
              </button>
              <div className="flex h-14 grow items-center justify-center gap-1.5 border-y border-wds-border-strong bg-wds-surface" role="status">
                <span className="font-wds-sans text-[26px] font-semibold leading-8 text-wds-text-ink">{quantity}</span>
                <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-copy-muted">{quantity === 1 ? item.buyUnit : unit}</span>
              </div>
              <button type="button" className={step} onClick={() => setQuantity((q) => q + 1)} aria-label="One more">
                +
              </button>
            </div>
          </div>
        </div>
        <p className="font-wds-sans text-[12px] leading-[17px] text-wds-text-copy-muted">You count what arrived. Prices and stock figures are not shown to attendants.</p>
        <div className="grow" />
        <PhonePrimaryButton onClick={() => onDone(item, String(quantity))}>Add to delivery</PhonePrimaryButton>
      </div>
    </>
  );
}
