'use client';

import * as React from 'react';

import { DrawerShell } from '../drawer-shell';
import { ItemFormFields, type ItemFormType, type ItemFormValues } from '../item-form';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { useItem, useItemFormOptions, useRetireItem, useSaveItem } from '../../hooks/use-item-form';
import { useCreateSupplierInline } from '../../hooks/use-new-purchase-form';
import type { CreateItemInput, DepartmentTag, InventoryItemType } from '../../types';

const ITEM_FORM_TYPE_TO_CONTRACT: Record<ItemFormType, InventoryItemType> = {
  raw: 'RAW_INGREDIENT',
  prepped: 'PREPPED',
  stocked: 'STOCKED',
};
const CONTRACT_TYPE_TO_ITEM_FORM: Record<InventoryItemType, ItemFormType> = {
  RAW_INGREDIENT: 'raw',
  PREPPED: 'prepped',
  STOCKED: 'stocked',
};

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};
const DEPARTMENT_OPTIONS = (Object.entries(DEPARTMENT_LABEL) as Array<[DepartmentTag, string]>).map(
  ([value, label]) => ({ value, label })
);

const EMPTY_VALUES: ItemFormValues = {
  name: '',
  type: 'raw',
  category: '',
  preferredSupplierId: undefined,
  buyUnit: '',
  usageUnit: '',
  conversion: '',
  packSize: '',
  departmentTags: [],
  restockLevel: '',
};

export interface ItemFormDrawerProps {
  /** `null` = create; a string = edit that item; `open` gates rendering either way. */
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  variant: 'desktop' | 'mobile';
}

/**
 * Item create/edit — screen 2. Reference: `SKV-0` (desktop drawer, 500px) /
 * `TLU-0` (mobile full-screen). Owns form state, the category/supplier
 * option lists, save + the duplicate-name warning (a successful save with a
 * `warnings` array, never a validation failure — plan §5.4 rule 3).
 */
export function ItemFormDrawer({ itemId, open, onOpenChange, onSaved, variant }: ItemFormDrawerProps) {
  const { categories, suppliers, addSupplier } = useItemFormOptions();
  const { item } = useItem(open ? itemId : null);
  const { save, saving, error } = useSaveItem();
  const { create: createSupplierInline } = useCreateSupplierInline();
  const { retire, retiring, error: retireError } = useRetireItem();
  const [values, setValues] = React.useState<ItemFormValues>(EMPTY_VALUES);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [confirmRetireOpen, setConfirmRetireOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (item) {
      setValues({
        name: item.name,
        type: CONTRACT_TYPE_TO_ITEM_FORM[item.type],
        category: item.category?.id ?? '',
        preferredSupplierId: item.preferredSupplier?.id,
        buyUnit: item.buyUnit,
        usageUnit: item.usageUnit,
        conversion: item.conversionFactor ? `1 ${item.buyUnit} = ${item.conversionFactor} ${item.usageUnit}` : '',
        packSize: item.packSize ? `${item.packSize} ${item.usageUnit}` : '',
        departmentTags: item.departmentTags,
        restockLevel: item.centralStoreRestockLevel ?? '',
      });
    } else {
      setValues(EMPTY_VALUES);
    }
    setWarning(null);
  }, [open, item]);

  const categoryOptions = categories.filter((c) => !c.retiredAt).map((c) => ({ value: c.id, label: c.name }));
  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));

  const handleCreateSupplier = async (name: string) => {
    const created = await createSupplierInline({ name });
    if (!created) return;
    addSupplier(created);
    setValues((prev) => ({ ...prev, preferredSupplierId: created.id }));
  };

  const handleValuesChange = (next: ItemFormValues) => {
    // Department scope resets to empty (Central Store only) when Type
    // changes to Raw, matching the Item Form composite's own
    // conditional-field behavior — a raw ingredient can never carry tags.
    if (next.type !== values.type && next.type === 'raw') {
      next = { ...next, departmentTags: [] };
    }
    setValues(next);
  };

  const handleSave = async () => {
    const conversionMatch = values.conversion.match(/=\s*([\d.]+)/);
    const packSizeMatch = values.packSize.match(/^([\d.]+)/);

    const input: CreateItemInput = {
      name: values.name,
      type: ITEM_FORM_TYPE_TO_CONTRACT[values.type],
      categoryId: values.categoryIsNew ? null : values.category || null,
      categoryName: values.categoryIsNew ? values.category : null,
      preferredSupplierId: values.preferredSupplierId ?? null,
      buyUnit: values.buyUnit,
      usageUnit: values.usageUnit,
      conversionFactor: conversionMatch ? conversionMatch[1] : null,
      packSize: packSizeMatch ? packSizeMatch[1] : null,
      departmentTags: values.type === 'raw' ? [] : (values.departmentTags as DepartmentTag[]),
      centralStoreRestockLevel: values.restockLevel || null,
    };

    const result = await save(input, item?.id);
    if (!result) return;
    if (result.warnings.length > 0) {
      setWarning(result.warnings[0].message);
      return;
    }
    onSaved();
    onOpenChange(false);
  };

  const handleRetire = async () => {
    if (!item) return;
    const ok = await retire(item.id);
    if (!ok) return;
    setConfirmRetireOpen(false);
    onSaved();
    onOpenChange(false);
  };

  if (!open) return null;

  const title = item ? 'Edit item' : 'New item';
  const description = item ? `${item.name} · created ${new Date(item.createdAt).toLocaleDateString('en-GB')}` : 'Add an item to the catalog';

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
          <ItemFormFields
            variant="mobile"
            values={values}
            onChange={handleValuesChange}
            categoryOptions={categoryOptions}
            supplierOptions={supplierOptions}
            departmentOptions={DEPARTMENT_OPTIONS}
            onCreateSupplier={handleCreateSupplier}
          />
          {warning ? (
            <p className="mt-4 font-wds-sans text-wds-caption text-wds-warning-fg">{warning}</p>
          ) : null}
          {error ? <p className="mt-4 font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
          {retireError ? <p className="mt-4 font-wds-sans text-wds-caption text-wds-error-fg">{retireError}</p> : null}
          {item ? (
            <button
              type="button"
              onClick={() => setConfirmRetireOpen(true)}
              className="mt-6 font-wds-sans text-wds-caption text-wds-error-fg underline underline-offset-2"
            >
              Archive this item
            </button>
          ) : null}
        </div>
        <div className="border-t border-wds-border p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-wds-md bg-wds-gradient-primary font-wds-sans text-wds-body font-medium text-wds-primary-fg disabled:opacity-60"
          >
            {item ? 'Save changes' : 'Create item'}
          </button>
        </div>
        {item ? (
          <ConfirmDialog
            open={confirmRetireOpen}
            onOpenChange={setConfirmRetireOpen}
            title="Archive this item?"
            description={`"${item.name}" will be hidden from the catalog by default, but its history is kept — you can unarchive it later with "Show archived".`}
            confirmLabel="Archive item"
            confirming={retiring}
            onConfirm={handleRetire}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <DrawerShell
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        primaryLabel={item ? 'Save changes' : 'Create item'}
        onPrimaryAction={handleSave}
        primaryDisabled={saving}
        footerExtra={
          item ? (
            <button
              type="button"
              onClick={() => setConfirmRetireOpen(true)}
              className="self-start font-wds-sans text-wds-caption text-wds-error-fg underline underline-offset-2"
            >
              Archive this item
            </button>
          ) : null
        }
      >
        <ItemFormFields
          variant="desktop"
          values={values}
          onChange={handleValuesChange}
          categoryOptions={categoryOptions}
          supplierOptions={supplierOptions}
          departmentOptions={DEPARTMENT_OPTIONS}
          onCreateSupplier={handleCreateSupplier}
        />
        {warning ? <p className="font-wds-sans text-wds-caption text-wds-warning-fg">{warning}</p> : null}
        {error ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
        {retireError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{retireError}</p> : null}
      </DrawerShell>
      {item ? (
        <ConfirmDialog
          open={confirmRetireOpen}
          onOpenChange={setConfirmRetireOpen}
          title="Archive this item?"
          description={`"${item.name}" will be hidden from the catalog by default, but its history is kept — you can unarchive it later with "Show archived".`}
          confirmLabel="Archive item"
          confirming={retiring}
          onConfirm={handleRetire}
        />
      ) : null}
    </>
  );
}
