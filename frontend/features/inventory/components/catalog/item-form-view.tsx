'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Combobox, type ComboboxOption } from '@/components/ui2/combobox';
import type { Category, DepartmentTag, InventoryItemDetail, InventoryItemListRow, InventoryItemType } from '../../types';
import { useSaveItem } from '../../hooks/use-item-form';
import { COMMON_UNITS, DEPARTMENT_ORDER, ITEM_TYPE_EXPLAINER, ITEM_TYPE_LABEL, ITEM_TYPE_ORDER } from '../../lib/item-labels';
import { formatHowWeBuy, trimDecimal } from '../../lib/item-format';
import {
  EMPTY_FORM_VALUES,
  buildEditPlan,
  hasErrors,
  holdsApplies,
  isBought,
  itemToFormValues,
  toCreateInput,
  usesDepartments,
  validateItemForm,
  type ItemEditPlan,
  type ItemFormErrors,
  type ItemFormValues,
} from '../../lib/item-form-model';
import { DEPARTMENT_LABEL } from '../stock/stock-format';
import {
  DangerLink,
  DrawerError,
  DrawerFrame,
  FieldLabel,
  PrimaryFooterButton,
  SecondaryFooterButton,
  fieldClass,
} from './drawer-parts';

/** What the catalog needs to know about a just-created item. */
export interface CreatedItem {
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
}

export interface ItemFormViewProps {
  /** `null` = add a new item; otherwise edit this one, filled in. */
  item: InventoryItemDetail | null;
  categories: Category[];
  /** A similar existing item, found as the name is typed (add only). */
  similar: InventoryItemListRow | null;
  onNameChange: (name: string) => void;
  /** Add drawer: Cancel. Edit: back to the item page. */
  onCancel: () => void;
  onCreated: (created: CreatedItem) => void;
  /** An edit with nothing risky in it: saved straight away. */
  onSaved: () => void;
  /** An edit that changes the pack, units or type: show the review first. */
  onReview: (plan: ItemEditPlan) => void;
  /** Footer link on an existing item. */
  onRetire: () => void;
  onRestore: () => void;
  restoreBusy: boolean;
  restoreError: string | null;
  onOpenSimilar: (itemId: string) => void;
}

const unitOptions = (current: string): ComboboxOption[] => {
  const units = current && !COMMON_UNITS.includes(current) ? [current, ...COMMON_UNITS] : [...COMMON_UNITS];
  return units.map((u) => ({ value: u, label: u }));
};

const typeChipBase =
  'flex h-9 grow basis-0 items-center justify-center whitespace-nowrap border font-wds-sans text-[13px] leading-4 transition-[background-color,border-color,transform] duration-150 rounded-wds-sm focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]';

const departmentChip =
  'inline-flex h-[30px] items-center whitespace-nowrap px-3 font-wds-sans text-[13px] leading-4 transition-[background-color,border-color,transform] duration-150 rounded-wds-sm focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]';

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
      {children}
    </span>
  );
}

/**
 * Add an item (Paper steps 02–03) and Edit item (step 08): one form, three
 * type chips with one-line explainers, fields that change with the type, the
 * pack and conversion as one entry. Prepped hides the buying fields; Raw
 * ingredient hides Used by. A similar name warns inside the drawer.
 *
 * Usual price is not here: the item create call takes no price yet (it is
 * entered under Add who sells it).
 */
export function ItemFormView({
  item,
  categories,
  similar,
  onNameChange,
  onCancel,
  onCreated,
  onSaved,
  onReview,
  onRetire,
  onRestore,
  restoreBusy,
  restoreError,
  onOpenSimilar,
}: ItemFormViewProps) {
  const editing = item !== null;
  const { save, saving, error, clearError } = useSaveItem();
  const [values, setValues] = React.useState<ItemFormValues>(() => (item ? itemToFormValues(item) : EMPTY_FORM_VALUES));
  const [errors, setErrors] = React.useState<ItemFormErrors>({});
  const [serverWarning, setServerWarning] = React.useState<string | null>(null);

  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (error) clearError();
  };

  const setName = (name: string) => {
    set('name', name);
    if (!editing) onNameChange(name);
  };

  const setType = (type: InventoryItemType) => {
    setValues((prev) => ({ ...prev, type, departmentTags: usesDepartments(type) ? prev.departmentTags : [] }));
    if (error) clearError();
  };

  const plan = item ? buildEditPlan(item, values) : null;
  const dirty = plan ? Object.keys(plan.input).length > 0 : true;
  const risky = plan !== null && plan.risky.length > 0;

  const categoryOptions: ComboboxOption[] = categories.map((c) => ({ value: c.id, label: c.name }));
  const categoryLabel = values.categoryIsNew ? values.category : (categoryOptions.find((o) => o.value === values.category)?.label ?? '');

  const bought = isBought(values.type);
  const showHolds = holdsApplies(values);
  const usage = values.usageUnit.trim();

  const submit = async () => {
    const found = validateItemForm(values);
    setErrors(found);
    if (hasErrors(found)) return;

    if (!item) {
      const result = await save(toCreateInput(values));
      if (!result) return;
      onCreated({ itemId: result.itemId, itemName: result.itemName, itemType: result.itemType });
      return;
    }
    const editPlan = buildEditPlan(item, values);
    if (editPlan.risky.length > 0) {
      onReview(editPlan);
      return;
    }
    if (Object.keys(editPlan.input).length === 0) {
      onCancel();
      return;
    }
    const result = await save(editPlan.input, item.id);
    if (!result) return;
    if (result.warnings.length > 0) setServerWarning(result.warnings[0].message);
    onSaved();
  };

  const retired = item?.retiredAt != null;

  const footer = (
    <>
      {editing ? (
        retired ? (
          <button
            type="button"
            onClick={onRestore}
            disabled={restoreBusy}
            className="rounded-wds-sm font-wds-sans text-[14px] leading-[18px] text-wds-espresso-700 hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring disabled:opacity-60"
          >
            Restore item
          </button>
        ) : (
          <DangerLink onClick={onRetire}>Retire item</DangerLink>
        )
      ) : (
        <span className="min-w-0 grow font-wds-sans text-[12px] leading-4 text-wds-text-secondary sm:w-[200px] sm:shrink-0 sm:grow-0">
          {similar ? 'Names look alike; this is allowed.' : 'Add who sells it after you save.'}
        </span>
      )}
      <div className="flex shrink-0 gap-2.5">
        <SecondaryFooterButton onClick={onCancel}>Cancel</SecondaryFooterButton>
        <PrimaryFooterButton onClick={submit} disabled={saving || (editing && !dirty)}>
          {editing ? (risky ? 'Review change' : 'Save changes') : 'Create item'}
        </PrimaryFooterButton>
      </div>
    </>
  );

  const typeNote = editing
    ? values.type === 'RAW_INGREDIENT'
      ? 'A raw ingredient goes only into Prep, so there is no “Used by” here. Changing the type is blocked while a department holds stock.'
      : `${ITEM_TYPE_LABEL[values.type]}: ${ITEM_TYPE_EXPLAINER[values.type]} Changing the type is blocked while a department holds stock.`
    : null;

  const holdsWas = item && itemToFormValues(item).holds;

  return (
    <DrawerFrame
      eyebrow={editing ? 'Edit item' : 'New item'}
      title={editing ? item.name : 'Add an item'}
      footer={footer}
    >
      {error ? <DrawerError>{error}</DrawerError> : null}
      {restoreError ? <DrawerError>{restoreError}</DrawerError> : null}
      {serverWarning ? <DrawerError>{serverWarning}</DrawerError> : null}

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="item-name">Name</FieldLabel>
        <input
          id="item-name"
          name="name"
          autoFocus={!editing}
          autoComplete="off"
          value={values.name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          className={cn(fieldClass, 'h-10 text-[14px]')}
        />
        {errors.name ? <FieldError>{errors.name}</FieldError> : null}
      </div>

      {similar && !editing ? (
        <div role="status" className="flex gap-2.5 border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
          <span aria-hidden className="mt-[5px] size-1.5 shrink-0 rounded-[3px] bg-wds-warning-fg" />
          <div className="flex flex-col gap-1">
            <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-warning-fg">A similar item exists: {similar.name}</span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-ink">
              {[similar.category?.name, formatHowWeBuy(similar)].filter(Boolean).join(' · ')}. If {values.name.trim() || 'this'} is a different product, carry on. If not,{' '}
              <button
                type="button"
                onClick={() => onOpenSimilar(similar.id)}
                className="rounded-wds-sm font-medium underline underline-offset-2 hover:text-wds-warning-fg focus-visible:outline-none focus-visible:shadow-wds-ring"
              >
                open {similar.name}
              </button>{' '}
              instead.
            </span>
          </div>
        </div>
      ) : null}

      <div role="group" aria-labelledby="item-type-label" className="flex flex-col gap-2">
        <span id="item-type-label">
          <FieldLabel>What is it?</FieldLabel>
        </span>
        <div className="flex gap-2">
          {ITEM_TYPE_ORDER.map((type) => {
            const selected = values.type === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() => setType(type)}
                className={cn(
                  typeChipBase,
                  selected
                    ? 'border-[1.5px] border-wds-selected-edge bg-wds-espresso-50 font-semibold text-wds-text-ink'
                    : 'border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50'
                )}
              >
                {ITEM_TYPE_LABEL[type]}
              </button>
            );
          })}
        </div>
        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {typeNote ?? (
            <>
              {ITEM_TYPE_ORDER.map((type) => (
                <React.Fragment key={type}>
                  {ITEM_TYPE_LABEL[type]}: {ITEM_TYPE_EXPLAINER[type]}
                  <br />
                </React.Fragment>
              ))}
              The fields below change with your choice.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">HOW YOU BUY IT AND USE IT</span>
        <div className="flex gap-2.5">
          {bought ? (
            <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">I buy it by the</span>
              <Combobox
                chevron
                value={values.buyUnit}
                onValueChange={(v) => set('buyUnit', v)}
                options={unitOptions(values.buyUnit)}
                onCreate={(name) => set('buyUnit', name)}
                createLabel={(q) => `Add “${q}”`}
                placeholder="bag"
                aria-label="I buy it by the"
                name="buyUnit"
                className="h-[38px] text-[14px]"
              />
              {errors.buyUnit ? <FieldError>{errors.buyUnit}</FieldError> : null}
            </div>
          ) : null}
          {showHolds ? (
            <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">One holds</span>
              <div className="relative">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="One holds"
                  name="holds"
                  value={values.holds}
                  onChange={(e) => set('holds', e.target.value)}
                  aria-invalid={errors.holds ? true : undefined}
                  placeholder="50"
                  className={cn(fieldClass, 'font-wds-mono', editing && holdsWas && holdsWas !== values.holds.trim() && 'pr-14')}
                />
                {editing && holdsWas && holdsWas !== values.holds.trim() ? (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-wds-mono text-[11px] leading-[14px] text-wds-text-muted">was {holdsWas}</span>
                ) : null}
              </div>
              {errors.holds ? <FieldError>{errors.holds}</FieldError> : null}
            </div>
          ) : null}
          <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{bought ? 'And I use it in' : 'I use it in'}</span>
            <Combobox
              chevron
              value={values.usageUnit}
              onValueChange={(v) => set('usageUnit', v)}
              options={unitOptions(values.usageUnit)}
              onCreate={(name) => set('usageUnit', name)}
              createLabel={(q) => `Add “${q}”`}
              placeholder="kg"
              aria-label={bought ? 'And I use it in' : 'I use it in'}
              name="usageUnit"
              className="h-[38px] text-[14px]"
            />
            {errors.usageUnit ? <FieldError>{errors.usageUnit}</FieldError> : null}
          </div>
        </div>
        {bought && usage !== '' && values.buyUnit.trim() !== '' ? (
          <div
            aria-live="polite"
            className={cn(
              'flex items-center gap-2 border px-3 py-2.5',
              risky ? 'border-wds-warning-border bg-wds-warning-bg' : 'border-wds-border bg-wds-neutral-50'
            )}
          >
            <span className="shrink-0 font-wds-mono text-[13px] leading-4 text-wds-text-ink">
              {showHolds
                ? `1 ${values.buyUnit.trim()} = ${values.holds.trim() ? trimDecimal(values.holds.trim()) : '__'} ${usage}`
                : `1 ${values.buyUnit.trim()}`}
            </span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              {risky
                ? 'Changing the pack asks for a summary next.'
                : showHolds
                  ? `Receiving counts ${values.buyUnit.trim()}s; stock is kept in ${usage}.`
                  : `Receiving and stock both count ${usage}.`}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Category</FieldLabel>
        <Combobox
          chevron
          value={categoryLabel}
          onValueChange={(v) => setValues((prev) => ({ ...prev, category: v, categoryIsNew: false }))}
          options={categoryOptions}
          onCreate={(name) => setValues((prev) => ({ ...prev, category: name, categoryIsNew: true }))}
          createLabel={(q) => `Add “${q}” as a new category`}
          placeholder="Choose a category"
          aria-label="Category"
          name="category"
          className="h-[38px] text-[14px]"
        />
      </div>

      {usesDepartments(values.type) ? (
        <div role="group" aria-labelledby="item-used-by-label" className="flex flex-col gap-2">
          <span id="item-used-by-label">
            <FieldLabel>Used by departments</FieldLabel>
          </span>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENT_ORDER.map((tag: DepartmentTag) => {
              const selected = values.departmentTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      departmentTags: prev.departmentTags.includes(tag) ? prev.departmentTags.filter((t) => t !== tag) : [...prev.departmentTags, tag],
                    }))
                  }
                  className={cn(
                    departmentChip,
                    selected
                      ? 'border-[1.5px] border-wds-selected-edge bg-wds-espresso-50 font-medium text-wds-text-ink'
                      : 'border border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50'
                  )}
                >
                  {DEPARTMENT_LABEL[tag]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="item-restock-level" hint={editing ? undefined : 'optional'}>
          Central Store restock level
        </FieldLabel>
        <div className="flex items-center gap-2.5">
          <div className="relative w-[150px] shrink-0">
            <input
              id="item-restock-level"
              name="restockLevel"
              inputMode="decimal"
              autoComplete="off"
              value={values.restockLevel}
              onChange={(e) => set('restockLevel', e.target.value)}
              aria-invalid={errors.restockLevel ? true : undefined}
              placeholder="100"
              className={cn(fieldClass, 'font-wds-mono', usage && 'pr-10')}
            />
            {usage ? (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{usage}</span>
            ) : null}
          </div>
        </div>
        {errors.restockLevel ? <FieldError>{errors.restockLevel}</FieldError> : null}
      </div>
    </DrawerFrame>
  );
}
