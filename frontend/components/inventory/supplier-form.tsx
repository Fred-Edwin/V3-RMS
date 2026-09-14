import * as React from 'react';

import { cn } from '@/lib/cn';
import { Input } from '@/components/ui2/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui2/toggle-group';

/**
 * Supplier Form — the field set for New/edit supplier, desktop drawer body
 * (460px drawer, distinct from Item Form's 500px and Category Manager's
 * 420px — confirmed via `get_computed_styles` on `SX6-0`, not assumed)
 * + mobile full-screen route. Reference: `6TF-0`/`SX5-0` (desktop) / `TLW-0`
 * (mobile, "4m · New/edit supplier").
 */
export type PaymentTerms = 'invoice' | 'pay-now';

export interface SupplierFormValues {
  name: string;
  contactPerson: string;
  category: string;
  phone: string;
  email: string;
  paymentTerms: PaymentTerms;
}

export interface SupplierFormFieldsProps {
  variant: 'desktop' | 'mobile';
  values: SupplierFormValues;
  onChange: (values: SupplierFormValues) => void;
  categoryOptions: string[];
  className?: string;
}

function FieldLabel({ variant, children }: { variant: 'desktop' | 'mobile'; children: React.ReactNode }) {
  return variant === 'desktop' ? (
    <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-muted">{children}</span>
  ) : (
    <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{children}</span>
  );
}

/**
 * Desktop's payment-terms toggle is a genuinely different selected style
 * from the standard `ToggleGroup` primitive's espresso-700-fill convention
 * — Paper draws it as an espresso-50 tint + primary-colored text
 * (`get_computed_styles` on `SXI-0`/`SXJ-0`), not the gradient fill.
 * Mobile's version (`TZ6-0`/`TZ7-0`) DOES use the standard gradient-fill
 * selected state — confirmed as a real platform difference, not
 * normalized to one shared style.
 */
function DesktopPaymentTermsToggle({
  value,
  onChange,
}: {
  value: PaymentTerms;
  onChange: (value: PaymentTerms) => void;
}) {
  const options: { value: PaymentTerms; label: string }[] = [
    { value: 'invoice', label: 'Invoice to follow' },
    { value: 'pay-now', label: 'Pay now' },
  ];
  return (
    <div className="flex overflow-hidden rounded-wds-sm border border-wds-border-strong">
      {options.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex h-8 grow basis-0 items-center justify-center font-wds-sans text-wds-caption',
              selected ? 'bg-wds-espresso-50 font-medium text-wds-primary' : 'bg-wds-surface text-wds-text-muted',
              i > 0 && 'border-l border-wds-border-strong'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SupplierFormFields({ variant, values, onChange, categoryOptions, className }: SupplierFormFieldsProps) {
  const isMobile = variant === 'mobile';
  const set = <K extends keyof SupplierFormValues>(key: K, value: SupplierFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const fieldInputClass = isMobile ? 'h-[44px] rounded-wds-md' : undefined;
  const toggleItemClass = isMobile ? 'h-11 grow basis-0' : undefined;

  return (
    <div className={cn('flex flex-col gap-wds-4', className)}>
      <div className="flex flex-col gap-wds-1.5">
        <FieldLabel variant={variant}>Supplier name</FieldLabel>
        <Input className={fieldInputClass} value={values.name} onChange={(e) => set('name', e.target.value)} />
      </div>

      <div className="flex gap-wds-3">
        <div className="flex flex-1 flex-col gap-wds-1.5">
          <FieldLabel variant={variant}>Contact person</FieldLabel>
          <Input
            className={fieldInputClass}
            value={values.contactPerson}
            onChange={(e) => set('contactPerson', e.target.value)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-wds-1.5">
          <FieldLabel variant={variant}>Category</FieldLabel>
          <Select value={values.category} onValueChange={(v) => set('category', v)}>
            <SelectTrigger className={fieldInputClass}>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-wds-3">
        <div className="flex flex-1 flex-col gap-wds-1.5">
          <FieldLabel variant={variant}>Phone</FieldLabel>
          <Input className={fieldInputClass} value={values.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="flex flex-1 flex-col gap-wds-1.5">
          <FieldLabel variant={variant}>Email</FieldLabel>
          <Input
            className={fieldInputClass}
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-wds-2">
        <FieldLabel variant={variant}>Default payment terms</FieldLabel>
        {isMobile ? (
          <ToggleGroup
            type="single"
            value={values.paymentTerms}
            onValueChange={(v) => v && set('paymentTerms', v as PaymentTerms)}
            className="flex w-full"
          >
            <ToggleGroupItem value="invoice" className={toggleItemClass}>
              Invoice to follow
            </ToggleGroupItem>
            <ToggleGroupItem value="pay-now" className={toggleItemClass}>
              Pay now
            </ToggleGroupItem>
          </ToggleGroup>
        ) : (
          <DesktopPaymentTermsToggle value={values.paymentTerms} onChange={(v) => set('paymentTerms', v)} />
        )}
        <span className="font-wds-sans text-wds-helper text-wds-text-faint">
          Pre-fills the payment toggle on every goods receipt from this supplier.
        </span>
      </div>
    </div>
  );
}
