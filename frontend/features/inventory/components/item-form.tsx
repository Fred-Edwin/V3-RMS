import * as React from 'react';

import { cn } from '@/lib/cn';
import { Input } from '@/components/ui2/input';
import { Combobox, type ComboboxOption } from '@/components/ui2/combobox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui2/toggle-group';
import type { ItemFormErrors } from './item-form-validation';

/**
 * Item Form — the field set shared by New/edit item, desktop drawer body
 * (`DrawerShell` children) and mobile full-screen route. Identical fields
 * both places; only the surrounding shell differs. Reference: `SL2-0`
 * (desktop body) / `TV7-0` (mobile).
 *
 * `variant` switches field sizing to match each shell's own convention —
 * confirmed via `get_computed_styles` that mobile fields are genuinely
 * taller/differently-radiused (44px/radius-md) than desktop's (32px/
 * radius-sm), not just a CSS zoom of the same component:
 * desktop `SMA-0`/`SLW-0` vs. mobile `TVA-0`/`TVN-0`. The Type toggle's
 * "raw" segment label also differs by variant — Paper's mobile node
 * (`TV7-0`) draws the short "Raw", not desktop's ("SL2-0") "Raw ingredient" —
 * confirmed by reading each platform's own node rather than assuming one
 * label serves both.
 */
export type ItemFormVariant = 'desktop' | 'mobile';

export type ItemFormType = 'raw' | 'prepped' | 'stocked';

export interface ItemFormValues {
  name: string;
  type: ItemFormType;
  /** Category id, or a not-yet-created name typed via the combobox's "+ Create" row. */
  category: string;
  categoryIsNew?: boolean;
  preferredSupplierId?: string;
  buyUnit: string;
  usageUnit: string;
  /** Numeric text: how many `usageUnit`s in one `buyUnit` (the conversion factor). Empty = none. */
  conversion: string;
  /** Numeric text: how many `usageUnit`s in one pack. Empty = none. */
  packSize: string;
  /** Department tag values (e.g. `KITCHEN`) this item may be stocked in. Empty = Central Store only. */
  departmentTags: string[];
  restockLevel?: string;
}

export interface DepartmentOption {
  value: string;
  label: string;
}

export interface ItemFormFieldsProps {
  variant: ItemFormVariant;
  values: ItemFormValues;
  onChange: (values: ItemFormValues) => void;
  categoryOptions: ComboboxOption[];
  supplierOptions: ComboboxOption[];
  departmentOptions: DepartmentOption[];
  /** Whether typing an unmatched category name offers a "+ Create" row — false while the category list is still loading. */
  allowCreateCategory?: boolean;
  /** Enables the Supplier field's "+ Create" row. Omit to disable inline supplier creation (e.g. while saving). */
  onCreateSupplier?: (name: string) => void;
  /** Inline errors for the numeric conversion / pack-size fields (`getItemFormErrors`). */
  errors?: ItemFormErrors;
  className?: string;
}

function FieldLabel({ children }: { variant: ItemFormVariant; children: React.ReactNode }) {
  return <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">{children}</span>;
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="font-wds-sans text-wds-helper text-wds-error-fg">
      {children}
    </span>
  );
}

function FieldHelper({ children }: { children: React.ReactNode }) {
  return <span className="font-wds-sans text-wds-helper text-wds-text-copy-faint">{children}</span>;
}

/** The non-editable "1 bag = 25 kg" line under a numeric field — a blank shows `___` until a number is typed. */
function ComputedLabel({ prefix, value, unit }: { prefix: string; value: string; unit: string }) {
  const filled = value.trim() !== '';
  return (
    <span className={cn('font-wds-sans text-wds-helper', filled ? 'font-medium text-wds-text-ink' : 'text-wds-text-copy-muted')} aria-live="polite">
      {prefix} {filled ? value.trim() : '___'} {unit}
    </span>
  );
}

export function ItemFormFields({
  variant,
  values,
  onChange,
  categoryOptions,
  supplierOptions,
  departmentOptions,
  allowCreateCategory = true,
  onCreateSupplier,
  errors,
  className,
}: ItemFormFieldsProps) {
  const isMobile = variant === 'mobile';
  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const fieldInputClass = isMobile ? 'h-[44px] rounded-wds-md' : undefined;
  const toggleItemClass = isMobile ? 'h-10 grow basis-0' : undefined;

  return (
    <div className={cn('flex flex-col', isMobile ? 'gap-wds-4.5' : 'gap-wds-4', className)}>
      <div className="flex flex-col gap-wds-1.5">
        <FieldLabel variant={variant}>Name</FieldLabel>
        <Input
          className={fieldInputClass}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Basmati rice"
        />
      </div>

      <div className="flex flex-col gap-wds-1.5">
        <FieldLabel variant={variant}>Type</FieldLabel>
        <ToggleGroup
          type="single"
          value={values.type}
          onValueChange={(v) => v && set('type', v as ItemFormType)}
          className={isMobile ? 'flex w-full' : undefined}
        >
          <ToggleGroupItem value="raw" className={toggleItemClass}>
            {isMobile ? 'Raw' : 'Raw ingredient'}
          </ToggleGroupItem>
          <ToggleGroupItem value="prepped" className={toggleItemClass}>
            Prepped
          </ToggleGroupItem>
          <ToggleGroupItem value="stocked" className={toggleItemClass}>
            Stocked
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-wds-1.5">
        <FieldLabel variant={variant}>Category</FieldLabel>
        <Combobox
          className={fieldInputClass}
          value={
            values.categoryIsNew
              ? values.category
              : (categoryOptions.find((o) => o.value === values.category)?.label ?? '')
          }
          onValueChange={(v) => onChange({ ...values, category: v, categoryIsNew: false })}
          options={categoryOptions}
          placeholder="Select a category"
          aria-label="Category"
          onCreate={
            allowCreateCategory
              ? (name) => onChange({ ...values, category: name, categoryIsNew: true })
              : undefined
          }
        />
        <FieldHelper>Pick from your list, or type a new name to add it. One category per item.</FieldHelper>
      </div>

      <div className="flex flex-col gap-wds-1.5">
        <FieldLabel variant={variant}>Preferred supplier &mdash; optional</FieldLabel>
        <Combobox
          className={fieldInputClass}
          value={supplierOptions.find((o) => o.value === values.preferredSupplierId)?.label ?? ''}
          onValueChange={(v) => set('preferredSupplierId', v)}
          options={supplierOptions}
          placeholder="Select a supplier"
          aria-label="Preferred supplier"
          onCreate={onCreateSupplier}
        />
        <FieldHelper>A default reference only &mdash; you can still receive this item from any supplier later.</FieldHelper>
      </div>

      <div className="flex gap-wds-3">
        <div className="flex flex-1 flex-col gap-wds-1.5">
          <FieldLabel variant={variant}>Buy unit</FieldLabel>
          <Input
            className={fieldInputClass}
            value={values.buyUnit}
            onChange={(e) => set('buyUnit', e.target.value)}
            placeholder="bag"
          />
        </div>
        <div className="flex flex-1 flex-col gap-wds-1.5">
          <FieldLabel variant={variant}>Usage unit</FieldLabel>
          <Input
            className={fieldInputClass}
            value={values.usageUnit}
            onChange={(e) => set('usageUnit', e.target.value)}
            placeholder="kg"
          />
        </div>
      </div>

      <div className="flex gap-wds-3">
        <div className="flex flex-1 flex-col gap-wds-1.5">
          <FieldLabel variant={variant}>Conversion factor</FieldLabel>
          <div className="flex items-center gap-wds-2">
            <Input
              className={fieldInputClass}
              value={values.conversion}
              onChange={(e) => set('conversion', e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 25"
              aria-label="Conversion factor"
              aria-invalid={errors?.conversion ? true : undefined}
            />
            <span className="shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{values.usageUnit.trim()}</span>
          </div>
          {errors?.conversion ? (
            <FieldError>{errors.conversion}</FieldError>
          ) : (
            <ComputedLabel prefix={`1 ${values.buyUnit.trim() || 'buy unit'} =`} value={values.conversion} unit={values.usageUnit.trim() || 'usage unit'} />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-wds-1.5">
          <FieldLabel variant={variant}>Pack size</FieldLabel>
          <div className="flex items-center gap-wds-2">
            <Input
              className={fieldInputClass}
              value={values.packSize}
              onChange={(e) => set('packSize', e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 25"
              aria-label="Pack size"
              aria-invalid={errors?.packSize ? true : undefined}
            />
            <span className="shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{values.usageUnit.trim()}</span>
          </div>
          {errors?.packSize ? (
            <FieldError>{errors.packSize}</FieldError>
          ) : (
            <ComputedLabel prefix="1 pack =" value={values.packSize} unit={values.usageUnit.trim() || 'usage unit'} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-wds-1.5">
        <FieldLabel variant={variant}>Department scope</FieldLabel>
        {values.type === 'raw' ? (
          <div
            className={cn(
              'flex h-8 items-center rounded-wds-sm border border-wds-border bg-wds-surface-sunken px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-copy-muted',
              fieldInputClass
            )}
          >
            Central Store only
          </div>
        ) : (
          <div className="flex flex-wrap gap-wds-1.5">
            {departmentOptions.map((dept) => {
              const checked = values.departmentTags.includes(dept.value);
              return (
                <button
                  key={dept.value}
                  type="button"
                  aria-pressed={checked}
                  onClick={() =>
                    set(
                      'departmentTags',
                      checked
                        ? values.departmentTags.filter((t) => t !== dept.value)
                        : [...values.departmentTags, dept.value]
                    )
                  }
                  className={cn(
                    'rounded-wds-sm border px-wds-2.5 py-1 font-wds-sans text-wds-caption transition-colors',
                    checked
                      ? 'border-wds-primary bg-wds-espresso-50 text-wds-primary'
                      : 'border-wds-border-strong text-wds-text-ink'
                  )}
                >
                  {dept.label}
                </button>
              );
            })}
          </div>
        )}
        <FieldHelper>
          {values.type === 'raw'
            ? "Raw ingredients can't be scoped to a department — they're only issued via requisition as prepped or stocked items."
            : 'Select every department that may stock this item. None selected = Central Store only.'}
        </FieldHelper>
      </div>

      <div className="flex flex-col gap-wds-1.5">
        <FieldLabel variant={variant}>Central Store restock level &mdash; optional</FieldLabel>
        <Input
          className={cn('w-[120px]', fieldInputClass)}
          value={values.restockLevel ?? ''}
          onChange={(e) => set('restockLevel', e.target.value)}
          placeholder="120 kg"
        />
      </div>
    </div>
  );
}
