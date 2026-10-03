'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Combobox, type ComboboxOption } from '@/components/ui2/combobox';
import type { InventoryItemDetail, Supplier } from '../../types';
import { useAddSupplierLine } from '../../hooks/use-item-form';
import { COMMON_UNITS } from '../../lib/item-labels';
import { trimDecimal } from '../../lib/item-format';
import { DrawerError, DrawerFrame, FieldLabel, PrimaryFooterButton, SecondaryFooterButton, fieldClass } from './drawer-parts';

export interface AddSellerViewProps {
  item: InventoryItemDetail;
  suppliers: Supplier[];
  suppliersLoading: boolean;
  suppliersError: string | null;
  onRetrySuppliers: () => void;
  onCancel: () => void;
  onAdded: () => void;
}

const DECIMAL = /^\d{1,8}(\.\d{1,4})?$/;

/**
 * Add who sells it (Paper step 06): the supplier, their name and code for the
 * item, and — only when they sell a different pack — that pack, which gets its
 * own line. A pack already on file is a 409 whose message is shown inline.
 *
 * "Their price" is not here: adding a line takes no price today, the first
 * signed receipt sets it (the item page says so). The preferred switch starts
 * on only when no other supplier is preferred yet.
 */
export function AddSellerView({ item, suppliers, suppliersLoading, suppliersError, onRetrySuppliers, onCancel, onAdded }: AddSellerViewProps) {
  const { add, saving, error, clearError } = useAddSupplierLine();
  const [supplierId, setSupplierId] = React.useState('');
  const [theirName, setTheirName] = React.useState('');
  const [theirCode, setTheirCode] = React.useState('');
  const [samePack, setSamePack] = React.useState(true);
  const [buyUnit, setBuyUnit] = React.useState('');
  const [packSize, setPackSize] = React.useState('');
  const [preferred, setPreferred] = React.useState(!item.suppliers.some((s) => s.isPreferred));
  const [errors, setErrors] = React.useState<{ supplier?: string; buyUnit?: string; packSize?: string }>({});

  const supplier = suppliers.find((s) => s.id === supplierId);
  const options: ComboboxOption[] = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const itemPack = item.conversionFactor ?? item.packSize;
  const usualPack = itemPack ? `1 ${item.buyUnit} = ${trimDecimal(itemPack)} ${item.usageUnit}` : `1 ${item.buyUnit}`;
  const sellerName = supplier?.name ?? 'the supplier';

  const unitOptions: ComboboxOption[] = (buyUnit && !COMMON_UNITS.includes(buyUnit) ? [buyUnit, ...COMMON_UNITS] : [...COMMON_UNITS]).map((u) => ({ value: u, label: u }));

  const submit = async () => {
    const found: typeof errors = {};
    if (!supplierId) found.supplier = 'Pick a supplier.';
    if (!samePack) {
      if (!buyUnit.trim()) found.buyUnit = 'Choose how they sell it.';
      if (!DECIMAL.test(packSize.trim()) || Number.parseFloat(packSize) <= 0) found.packSize = `How many ${item.usageUnit} does one hold?`;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Same pack as usual: name the item's own pack explicitly, so a receipt that names it matches this line.
    const pack = samePack ? { buyUnit: item.buyUnit, packSize: itemPack } : { buyUnit: buyUnit.trim(), packSize: packSize.trim() };
    const ok = await add(supplierId, {
      inventoryItemId: item.id,
      supplierItemName: theirName.trim() || null,
      supplierItemCode: theirCode.trim() || null,
      ...pack,
      isPreferred: preferred,
    });
    if (ok) onAdded();
  };

  return (
    <DrawerFrame
      eyebrow={item.name}
      title="Add who sells it"
      subtitle="Pick a supplier and how they write it on their invoice."
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <SecondaryFooterButton onClick={onCancel}>Cancel</SecondaryFooterButton>
          <PrimaryFooterButton onClick={submit} disabled={saving}>
            Save
          </PrimaryFooterButton>
        </div>
      }
    >
      {error ? <DrawerError>{error}</DrawerError> : null}
      {suppliersError ? (
        <DrawerError>
          {suppliersError}{' '}
          <button type="button" onClick={onRetrySuppliers} className="font-medium underline underline-offset-2">
            Try again
          </button>
        </DrawerError>
      ) : null}

      <div className="flex flex-col gap-2">
        <FieldLabel>Supplier</FieldLabel>
        <Combobox
          chevron
          value={supplier?.name ?? ''}
          onValueChange={(v) => {
            setSupplierId(v);
            setErrors((prev) => ({ ...prev, supplier: undefined }));
            clearError();
          }}
          options={options}
          placeholder={suppliersLoading ? 'Loading suppliers…' : 'Choose a supplier'}
          aria-label="Supplier"
          name="supplier"
          className="h-[38px] text-[14px]"
        />
        {errors.supplier ? (
          <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
            {errors.supplier}
          </span>
        ) : (
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Not in the list? Add a new supplier from the Suppliers page.</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2.5">
          <div className="flex min-w-0 grow basis-0 flex-col gap-2">
            <FieldLabel htmlFor="their-name" hint="optional">
              Their name for it
            </FieldLabel>
            <input id="their-name" name="theirName" value={theirName} onChange={(e) => setTheirName(e.target.value)} autoComplete="off" className={fieldClass} />
          </div>
          <div className="flex w-[130px] shrink-0 flex-col gap-2">
            <FieldLabel htmlFor="their-code" hint="optional">
              Their code
            </FieldLabel>
            <input id="their-code" name="theirCode" value={theirCode} onChange={(e) => setTheirCode(e.target.value)} autoComplete="off" placeholder="as printed" className={cn(fieldClass, 'font-wds-mono')} />
          </div>
        </div>
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          How {sellerName} writes it on their invoice. Our name for the item never changes.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>How they sell it</FieldLabel>
        <label className="flex cursor-pointer items-start gap-2.5 border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
          <input
            type="checkbox"
            checked={samePack}
            onChange={(e) => {
              setSamePack(e.target.checked);
              clearError();
            }}
            className="mt-0.5 size-4 shrink-0 accent-[var(--wds-primary)]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Same pack as usual: {usualPack}</span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              Untick only if {sellerName} sells a different pack, for example 2 {item.usageUnit} packets. Receiving then counts in their pack.
            </span>
          </span>
        </label>
        {!samePack ? (
          <div className="flex gap-2.5">
            <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">They sell it by the</span>
              <Combobox
                chevron
                value={buyUnit}
                onValueChange={(v) => setBuyUnit(v)}
                options={unitOptions}
                onCreate={(name) => setBuyUnit(name)}
                createLabel={(q) => `Add “${q}”`}
                placeholder="packet"
                aria-label="They sell it by the"
                name="buyUnit"
                className="h-[38px] text-[14px]"
              />
              {errors.buyUnit ? (
                <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
                  {errors.buyUnit}
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">One holds ({item.usageUnit})</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                aria-label={`One holds, in ${item.usageUnit}`}
                name="packSize"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                aria-invalid={errors.packSize ? true : undefined}
                placeholder="2"
                className={cn(fieldClass, 'font-wds-mono')}
              />
              {errors.packSize ? (
                <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
                  {errors.packSize}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4 border border-wds-border px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          <span id="preferred-label" className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
            Preferred supplier for {item.name}
          </span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">New orders start with this supplier.</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={preferred}
          aria-labelledby="preferred-label"
          onClick={() => setPreferred((p) => !p)}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-wds-ring',
            preferred ? 'bg-wds-selected-edge' : 'bg-wds-neutral-300'
          )}
        >
          <span className={cn('absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out', preferred && 'translate-x-4')} />
        </button>
      </div>

      <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        After this, the first signed receipt sets the price, and every signed receipt updates it.
      </p>
    </DrawerFrame>
  );
}
