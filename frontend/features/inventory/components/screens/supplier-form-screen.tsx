'use client';

import * as React from 'react';

import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui2/sheet';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { SupplierFormFields, type PaymentTerms, type SupplierFormValues } from '../supplier-form';
import { SupplierDetailSkeletonDesktop, SupplierDetailSkeletonMobile } from '../skeletons';
import { useRetireSupplier, useSaveSupplier, useSupplier, useSupplierFormOptions } from '../../hooks/use-supplier-form';
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
  const { supplier, status: supplierStatus } = useSupplier(open ? supplierId : null);
  const isLoadingSupplier = supplierId != null && supplierStatus === 'loading';
  const { save, saving, error } = useSaveSupplier();
  const { retire, retiring, error: retireError, blockedBy, clearBlock } = useRetireSupplier();
  const [values, setValues] = React.useState<SupplierFormValues>(EMPTY_VALUES);
  const [touchedPaymentTerms, setTouchedPaymentTerms] = React.useState(false);
  const [confirmRetireOpen, setConfirmRetireOpen] = React.useState(false);

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

  const handleRetire = async () => {
    if (!supplier) return;
    const ok = await retire(supplier.id);
    // On failure (plain error or a 409 that populates `blockedBy`), keep the
    // dialog open — `retireDialog` below re-renders as the "blocked" variant
    // once `blockedBy` is set, or shows `retireError` inline otherwise.
    if (!ok) return;
    setConfirmRetireOpen(false);
    onSaved();
    onOpenChange(false);
  };

  const openRetireDialog = () => {
    clearBlock();
    setConfirmRetireOpen(true);
  };

  const retireDialog = supplier ? (
    blockedBy ? (
      <ConfirmDialog
        open={confirmRetireOpen}
        onOpenChange={setConfirmRetireOpen}
        title="Can't archive this supplier yet"
        description={`"${supplier.name}" is still the preferred supplier for ${blockedBy.items.length} live item${blockedBy.items.length === 1 ? '' : 's'}: ${blockedBy.items.map((i) => i.name).join(', ')}. Reassign or archive those items first, then archive this supplier.`}
        confirmLabel="Got it"
        destructive={false}
        onConfirm={() => setConfirmRetireOpen(false)}
      />
    ) : (
      <ConfirmDialog
        open={confirmRetireOpen}
        onOpenChange={setConfirmRetireOpen}
        title="Archive this supplier?"
        description={`"${supplier.name}" will be hidden from supplier pickers, but its history is kept — you can unarchive it later.`}
        confirmLabel="Archive supplier"
        confirming={retiring}
        onConfirm={handleRetire}
      />
    )
  ) : null;

  if (!open) return null;

  // Base on `supplierId` (known synchronously), not `supplier` (only set once
  // the fetch resolves) — otherwise editing an existing supplier briefly
  // shows "New supplier" / "Create supplier" copy while it's still loading.
  const isEditing = supplierId != null;
  const title = isEditing ? 'Edit supplier' : 'New supplier';
  const description = supplier
    ? `${supplier.name} · created ${new Date(supplier.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : isEditing
      ? ' '
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
          {isLoadingSupplier ? (
            <SupplierDetailSkeletonMobile />
          ) : (
            <>
              <SupplierFormFields variant="mobile" values={values} onChange={handleChange} categoryOptions={categoryOptions} />
              {error ? <p className="mt-4 font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
              {retireError ? <p className="mt-4 font-wds-sans text-wds-caption text-wds-error-fg">{retireError}</p> : null}
              {supplier ? (
                <button
                  type="button"
                  onClick={openRetireDialog}
                  className="mt-6 font-wds-sans text-wds-caption text-wds-error-fg underline underline-offset-2"
                >
                  Archive this supplier
                </button>
              ) : null}
            </>
          )}
        </div>
        <div className="border-t border-wds-border p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isLoadingSupplier}
            className="flex h-11 w-full items-center justify-center rounded-wds-md bg-wds-gradient-primary font-wds-sans text-wds-body font-medium text-wds-primary-fg disabled:opacity-60"
          >
            {isEditing ? 'Save changes' : 'Create supplier'}
          </button>
        </div>
        {retireDialog}
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
          {isLoadingSupplier ? (
            <SupplierDetailSkeletonDesktop />
          ) : (
            <>
              <SupplierFormFields variant="desktop" values={values} onChange={handleChange} categoryOptions={categoryOptions} />
              {error ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
              {retireError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{retireError}</p> : null}
              {supplier ? (
                <button
                  type="button"
                  onClick={openRetireDialog}
                  className="self-start font-wds-sans text-wds-caption text-wds-error-fg underline underline-offset-2"
                >
                  Archive this supplier
                </button>
              ) : null}
            </>
          )}
        </div>
        <SheetFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoadingSupplier}>
            {isEditing ? 'Save changes' : 'Create supplier'}
          </Button>
        </SheetFooter>
      </SheetContent>
      {retireDialog}
    </Sheet>
  );
}
