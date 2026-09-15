'use client';

import * as React from 'react';

import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui2/sheet';
import { Button } from '@/components/ui2/button';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { SupplierFormFields, type PaymentTerms, type SupplierFormValues } from '../supplier-form';
import { useSaveSupplier, useSupplier, useSupplierFormOptions } from '../../hooks/use-supplier-form';
import type { CreateSupplierInput, SupplierPaymentTerms, UpdateSupplierInput } from '../../types';

const FORM_TERMS_TO_CONTRACT: Record<PaymentTerms, SupplierPaymentTerms> = {
  invoice: 'INVOICE_TO_FOLLOW',
  'pay-now': 'PAY_NOW',
};
const CONTRACT_TERMS_TO_FORM: Record<SupplierPaymentTerms, PaymentTerms> = {
  INVOICE_TO_FOLLOW: 'invoice',
  PAY_NOW: 'pay-now',
};

const EMPTY_VALUES: SupplierFormValues = {
  name: '',
  contactPerson: '',
  category: '',
  phone: '',
  email: '',
  location: '',
  paymentTerms: 'invoice',
};

export interface SupplierFormDrawerProps {
  supplierId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  variant: 'desktop' | 'mobile';
}

/**
 * New/edit supplier — screen 4. Reference: `SX5-0` (desktop drawer, 460px) /
 * `TLW-0` (mobile full-screen). `UpdateSupplierInput` only ever carries the
 * fields the user actually touched — `defaultPaymentTerms` is included on
 * a PATCH only if the toggle was changed, matching the 2026-09-15 contract
 * amendment (omitting it must never reset it).
 */
export function SupplierFormDrawer({ supplierId, open, onOpenChange, onSaved, variant }: SupplierFormDrawerProps) {
  const { categories } = useSupplierFormOptions();
  const { supplier } = useSupplier(open ? supplierId : null);
  const { save, saving, error } = useSaveSupplier();
  const [values, setValues] = React.useState<SupplierFormValues>(EMPTY_VALUES);
  const [touchedPaymentTerms, setTouchedPaymentTerms] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (supplier) {
      setValues({
        name: supplier.name,
        contactPerson: supplier.contactName ?? '',
        category: supplier.category?.name ?? '',
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        location: supplier.location ?? '',
        paymentTerms: CONTRACT_TERMS_TO_FORM[supplier.defaultPaymentTerms],
      });
    } else {
      setValues(EMPTY_VALUES);
    }
    setTouchedPaymentTerms(false);
  }, [open, supplier]);

  const categoryOptions = categories.map((c) => c.name);

  const handleChange = (next: SupplierFormValues) => {
    if (next.paymentTerms !== values.paymentTerms) setTouchedPaymentTerms(true);
    setValues(next);
  };

  const handleSave = async () => {
    const category = categories.find((c) => c.name === values.category);

    if (!supplier) {
      const input: CreateSupplierInput = {
        name: values.name,
        contactName: values.contactPerson || null,
        categoryId: category?.id ?? null,
        phone: values.phone || null,
        email: values.email || null,
        location: values.location || null,
        defaultPaymentTerms: FORM_TERMS_TO_CONTRACT[values.paymentTerms],
      };
      const saved = await save(input);
      if (!saved) return;
    } else {
      const input: UpdateSupplierInput = {
        name: values.name,
        contactName: values.contactPerson || null,
        categoryId: category?.id ?? null,
        phone: values.phone || null,
        email: values.email || null,
        location: values.location || null,
        // Only send defaultPaymentTerms if the toggle was actually touched —
        // omitting it must never reset the supplier's real terms.
        ...(touchedPaymentTerms ? { defaultPaymentTerms: FORM_TERMS_TO_CONTRACT[values.paymentTerms] } : {}),
      };
      const saved = await save(input, supplier.id);
      if (!saved) return;
    }

    onSaved();
    onOpenChange(false);
  };

  if (!open) return null;

  const title = supplier ? 'Edit supplier' : 'New supplier';
  const description = supplier
    ? `${supplier.name} · created ${new Date(supplier.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : 'Add a supplier to Central Store procurement';

  if (variant === 'mobile') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader
          title={title}
          subtitle={description}
          trailingAction="Cancel"
          onBack={() => onOpenChange(false)}
          onTrailingAction={() => onOpenChange(false)}
        />
        <div className="flex-1 overflow-y-auto p-4">
          <SupplierFormFields variant="mobile" values={values} onChange={handleChange} categoryOptions={categoryOptions} />
          {error ? <p className="mt-4 font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
        </div>
        <div className="border-t border-wds-border p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-wds-md bg-wds-gradient-primary font-wds-sans text-wds-body font-medium text-wds-primary-fg disabled:opacity-60"
          >
            {supplier ? 'Save changes' : 'Create supplier'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[460px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-wds-4 overflow-y-auto px-wds-6 py-wds-5">
          <SupplierFormFields variant="desktop" values={values} onChange={handleChange} categoryOptions={categoryOptions} />
          {error ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
        </div>
        <SheetFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {supplier ? 'Save changes' : 'Create supplier'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
