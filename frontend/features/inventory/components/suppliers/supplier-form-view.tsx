'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Combobox, type ComboboxOption } from '@/components/ui2/combobox';
import type { Category } from '../../types';
import type { CreateSupplierBody, SupplierDetail, SupplierListRow, SupplierTerms, SupplierType, UpdateSupplierBody } from '../../types/supplier';
import { useAction } from '../../hooks/use-async';
import { useSimilarSuppliers } from '../../hooks/use-similar-suppliers';
import { createSupplierRecord, updateSupplierRecord } from '../../services';
import { SUPPLIER_TYPE_LABEL, SUPPLIER_TYPE_ORDER } from '../../lib/supplier-logic';
import { DrawerError, DrawerFrame, FieldLabel, PrimaryFooterButton, SecondaryFooterButton, fieldClass } from '../catalog/drawer-parts';
import { ChoiceChip } from './supplier-ui';

type DuplicateMatch = { id: string; code: string; name: string };

export interface SupplierFormViewProps {
  /** Present = edit this supplier; absent = a new one (Paper step 15). */
  supplier?: SupplierDetail;
  categories: Category[];
  onCancel: () => void;
  /** Created or saved: the screen opens the new supplier's page, or reloads the open one. */
  onSaved: (supplier: SupplierDetail) => void;
}

const DAYS = /^\d{1,3}$/;

/**
 * New supplier (Paper step 15) and Edit supplier (the same form with the details Paper keeps for the page: trading
 * name, KRA PIN, credit limit, VAT and notes). Category is optional and the address has no map link. A name or phone
 * that looks like an existing supplier is flagged while typing; the server's duplicate answer (409) shows the matches
 * and the button then reads "Create anyway".
 */
export function SupplierFormView({ supplier, categories, onCancel, onSaved }: SupplierFormViewProps) {
  const editing = supplier !== undefined;
  const [name, setName] = React.useState(supplier?.name ?? '');
  const [type, setType] = React.useState<SupplierType>(supplier?.type ?? 'REGULAR');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState(supplier && supplier.address !== '—' ? supplier.address : '');
  const [terms, setTerms] = React.useState<SupplierTerms>(supplier?.defaultPaymentTerms ?? 'INVOICE_TO_FOLLOW');
  const [days, setDays] = React.useState(String(supplier?.paymentDays ?? 14));
  const [categoryId, setCategoryId] = React.useState(supplier?.category?.id ?? '');
  const [tradingName, setTradingName] = React.useState(supplier?.tradingName ?? '');
  const [kraPin, setKraPin] = React.useState(supplier?.kraPin ?? '');
  const [creditLimit, setCreditLimit] = React.useState(supplier?.creditLimit ? String(Number.parseFloat(supplier.creditLimit)) : '');
  const [notes, setNotes] = React.useState(supplier?.notes ?? '');
  const [errors, setErrors] = React.useState<{ name?: string; address?: string; days?: string; creditLimit?: string }>({});
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[] | null>(null);

  const create = useAction(createSupplierRecord, 'Could not create the supplier.');
  const update = useAction(updateSupplierRecord, 'Could not save the supplier.');
  const failure = create.failure ?? update.failure;
  const saving = create.saving || update.saving;
  const similar = useSimilarSuppliers(name, phone, supplier?.id ?? null, !editing || name.trim() !== supplier?.name);

  const categoryOptions: ComboboxOption[] = categories.filter((c) => !c.retiredAt).map((c) => ({ value: c.id, label: c.name }));
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? '';

  const clearProblems = () => {
    create.clear();
    update.clear();
    setDuplicates(null);
  };

  const submit = async () => {
    const found: typeof errors = {};
    if (!name.trim()) found.name = 'Enter the business name.';
    if (!address.trim()) found.address = 'Enter the address.';
    if (terms === 'INVOICE_TO_FOLLOW' && (!DAYS.test(days.trim()) || Number(days) < 1 || Number(days) > 365)) found.days = 'Days to pay: 1 to 365.';
    const credit = creditLimit.replace(/[,\s]/g, '');
    if (editing && credit !== '' && !/^\d{1,10}(\.\d{1,2})?$/.test(credit)) found.creditLimit = 'Enter an amount like 300,000.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const paymentDays = terms === 'INVOICE_TO_FOLLOW' ? Number(days) : undefined;
    const confirmDuplicate = duplicates !== null ? true : undefined;
    let saved: SupplierDetail | null;
    if (editing) {
      const body: UpdateSupplierBody = {
        name: name.trim(),
        type,
        address: address.trim(),
        defaultPaymentTerms: terms,
        paymentDays,
        categoryId: categoryId || null,
        tradingName: tradingName.trim() || null,
        kraPin: kraPin.trim() || null,
        creditLimit: credit === '' ? null : credit,
        notes: notes.trim() || null,
        confirmDuplicate,
      };
      saved = await update.run(supplier.id, body);
    } else {
      const body: CreateSupplierBody = {
        name: name.trim(),
        type,
        address: address.trim(),
        defaultPaymentTerms: terms,
        paymentDays,
        ...(categoryId ? { categoryId } : {}),
        ...(phone.trim() ? { contacts: [{ name: name.trim(), role: 'OTHER' as const, phone: phone.trim(), isPrimary: true }] } : {}),
        confirmDuplicate,
      };
      saved = await create.run(body);
    }
    if (saved) onSaved(saved);
  };

  // A 409 DUPLICATE_SUPPLIER names who matched; the next press of the primary button confirms it.
  React.useEffect(() => {
    if (failure?.code === 'DUPLICATE_SUPPLIER') {
      const details = failure.details as { matches?: DuplicateMatch[] } | null;
      setDuplicates(details?.matches ?? []);
    }
  }, [failure]);

  const matchesShown: Array<Pick<SupplierListRow, 'id' | 'code' | 'name'>> = duplicates && duplicates.length > 0 ? duplicates : (similar ?? []);
  const hint = (() => {
    if (matchesShown.length > 0) {
      return (
        <span role="status" className="flex items-start gap-1.75 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">
          <span aria-hidden className="mt-[5px] size-1.5 shrink-0 rounded-[3px] bg-wds-warning-fg" />
          <span>
            Looks like {matchesShown.slice(0, 2).map((m) => `${m.name} (${m.code})`).join(' and ')}
            {matchesShown.length > 2 ? ` and ${matchesShown.length - 2} more` : ''}. Check before adding it again.
          </span>
        </span>
      );
    }
    if (similar !== null && !editing) {
      return (
        <span role="status" className="flex items-center gap-1.75 font-wds-sans text-[12px] leading-4 text-wds-success-fg">
          <span aria-hidden className="size-1.5 shrink-0 rounded-[3px] bg-wds-success-fg" />
          No supplier with this name or phone yet
        </span>
      );
    }
    return null;
  })();

  return (
    <DrawerFrame
      title={editing ? 'Edit supplier' : 'New supplier'}
      subtitle={editing ? `${supplier.code} · what is here shows on the supplier page.` : 'Only what you need to start buying. Finish the rest whenever you like.'}
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <SecondaryFooterButton onClick={onCancel}>Cancel</SecondaryFooterButton>
          <PrimaryFooterButton onClick={submit} disabled={saving}>
            {editing ? 'Save changes' : duplicates !== null ? 'Create anyway' : 'Create supplier'}
          </PrimaryFooterButton>
        </div>
      }
    >
      {failure && failure.code !== 'DUPLICATE_SUPPLIER' ? <DrawerError>{failure.message}</DrawerError> : null}
      {failure && failure.code === 'DUPLICATE_SUPPLIER' ? (
        <DrawerError>{failure.message} Press “Create anyway” if this really is a different supplier.</DrawerError>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="supplier-name">Business name</FieldLabel>
        <input
          id="supplier-name"
          name="name"
          autoFocus
          autoComplete="off"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((p) => ({ ...p, name: undefined }));
            clearProblems();
          }}
          aria-invalid={errors.name ? true : undefined}
          className={cn(fieldClass, 'h-10 border-[1.5px] border-wds-selected-edge')}
        />
        {errors.name ? (
          <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
            {errors.name}
          </span>
        ) : (
          hint
        )}
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Type</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {SUPPLIER_TYPE_ORDER.map((t) => (
            <ChoiceChip key={t} selected={type === t} onClick={() => setType(t)}>
              {SUPPLIER_TYPE_LABEL[t]}
            </ChoiceChip>
          ))}
        </div>
      </div>

      {editing ? null : (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="supplier-phone">Phone</FieldLabel>
          <input
            id="supplier-phone"
            name="phone"
            type="tel"
            autoComplete="off"
            placeholder="+254 722 000 000"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearProblems();
            }}
            className={cn(fieldClass, 'h-10 font-wds-mono')}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="supplier-address">Address</FieldLabel>
        <input
          id="supplier-address"
          name="address"
          autoComplete="off"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setErrors((p) => ({ ...p, address: undefined }));
          }}
          aria-invalid={errors.address ? true : undefined}
          className={cn(fieldClass, 'h-10')}
        />
        {errors.address ? (
          <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
            {errors.address}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>How we pay them</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <ChoiceChip selected={terms === 'INVOICE_TO_FOLLOW'} onClick={() => setTerms('INVOICE_TO_FOLLOW')}>
            Invoice to follow
          </ChoiceChip>
          <ChoiceChip selected={terms === 'PAY_NOW'} onClick={() => setTerms('PAY_NOW')}>
            Pay now
          </ChoiceChip>
          {terms === 'INVOICE_TO_FOLLOW' ? (
            <span className="ml-2 flex items-center gap-1.5">
              <input
                name="paymentDays"
                inputMode="numeric"
                aria-label="Days to pay"
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  setErrors((p) => ({ ...p, days: undefined }));
                }}
                aria-invalid={errors.days ? true : undefined}
                className={cn(fieldClass, 'h-8 w-12 justify-center px-0 text-center font-wds-mono text-[13px]')}
              />
              <span className="whitespace-nowrap font-wds-sans text-[12px] leading-4 text-wds-text-secondary">days to pay</span>
            </span>
          ) : null}
        </div>
        {errors.days ? (
          <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
            {errors.days}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel hint="optional">Category</FieldLabel>
        <Combobox
          chevron
          value={categoryName}
          onValueChange={(v) => setCategoryId(v)}
          options={categoryOptions}
          placeholder="Choose a category"
          aria-label="Category"
          name="category"
          className="h-10 text-[14px]"
        />
      </div>

      {editing ? (
        <>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="supplier-trading" hint="optional">
              Trading name
            </FieldLabel>
            <input id="supplier-trading" name="tradingName" autoComplete="off" value={tradingName} onChange={(e) => setTradingName(e.target.value)} className={cn(fieldClass, 'h-10')} />
          </div>
          <div className="flex gap-2.5">
            <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
              <FieldLabel htmlFor="supplier-kra" hint="optional">
                KRA PIN
              </FieldLabel>
              <input id="supplier-kra" name="kraPin" autoComplete="off" value={kraPin} onChange={(e) => setKraPin(e.target.value)} className={cn(fieldClass, 'h-10 font-wds-mono')} />
            </div>
            <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
              <FieldLabel htmlFor="supplier-credit" hint="optional">
                Credit limit · KES
              </FieldLabel>
              <input
                id="supplier-credit"
                name="creditLimit"
                inputMode="decimal"
                autoComplete="off"
                value={creditLimit}
                onChange={(e) => {
                  setCreditLimit(e.target.value);
                  setErrors((p) => ({ ...p, creditLimit: undefined }));
                }}
                aria-invalid={errors.creditLimit ? true : undefined}
                className={cn(fieldClass, 'h-10 font-wds-mono')}
              />
              {errors.creditLimit ? (
                <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
                  {errors.creditLimit}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="supplier-notes" hint="optional">
              Notes
            </FieldLabel>
            <textarea
              id="supplier-notes"
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(fieldClass, 'h-auto min-h-[76px] resize-none py-2.5')}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5 border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
          <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Add later, from the supplier page</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            Contact person, bank or M-Pesa details, KRA PIN, what they sell and at what price, and documents. The page keeps a checklist.
          </span>
        </div>
      )}
    </DrawerFrame>
  );
}
