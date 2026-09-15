'use client';

import * as React from 'react';

import { DrawerShell } from '../drawer-shell';
import { ItemFormFields, type ItemFormType, type ItemFormValues } from '../item-form';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useItem, useItemFormOptions, useSaveItem } from '../../hooks/use-item-form';
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
const LABEL_TO_DEPARTMENT: Record<string, DepartmentTag> = Object.fromEntries(
  Object.entries(DEPARTMENT_LABEL).map(([tag, label]) => [label, tag as DepartmentTag])
) as Record<string, DepartmentTag>;

const EMPTY_VALUES: ItemFormValues = {
  name: '',
  type: 'raw',
  category: '',
  preferredSupplier: undefined,
  buyUnit: '',
  usageUnit: '',
  conversion: '',
  packSize: '',
  whereItMayExist: 'Central Store only',
  restockLevel: '',
};

/** Parses the free-text "Where it may exist" field back into department tags (comma-separated department names). */
function parseDepartmentTags(text: string): DepartmentTag[] {
  if (!text || text === 'Central Store only') return [];
  return text
    .replace(/^Central Store\s*·\s*/, '')
    .split(',')
    .map((s) => s.trim())
    .map((label) => LABEL_TO_DEPARTMENT[label])
    .filter((tag): tag is DepartmentTag => Boolean(tag));
}

function formatDepartmentTags(tags: DepartmentTag[]): string {
  if (tags.length === 0) return 'Central Store only';
  return tags.map((t) => DEPARTMENT_LABEL[t]).join(', ');
}

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
  const { categories, suppliers } = useItemFormOptions();
  const { item } = useItem(open ? itemId : null);
  const { save, saving, error } = useSaveItem();
  const [values, setValues] = React.useState<ItemFormValues>(EMPTY_VALUES);
  const [warning, setWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (item) {
      setValues({
        name: item.name,
        type: CONTRACT_TYPE_TO_ITEM_FORM[item.type],
        category: item.category?.name ?? '',
        preferredSupplier: item.preferredSupplier?.name,
        buyUnit: item.buyUnit,
        usageUnit: item.usageUnit,
        conversion: item.conversionFactor ? `1 ${item.buyUnit} = ${item.conversionFactor} ${item.usageUnit}` : '',
        packSize: item.packSize ? `${item.packSize} ${item.usageUnit}` : '',
        whereItMayExist: formatDepartmentTags(item.departmentTags),
        restockLevel: '',
      });
    } else {
      setValues(EMPTY_VALUES);
    }
    setWarning(null);
  }, [open, item]);

  const categoryOptions = categories.filter((c) => !c.retiredAt).map((c) => c.name);
  const supplierOptions = suppliers.map((s) => s.name);

  const handleValuesChange = (next: ItemFormValues) => {
    // "Where it may exist" resets to the type-appropriate default when Type changes,
    // matching the Item Form composite's own conditional-field behavior.
    if (next.type !== values.type) {
      next = {
        ...next,
        whereItMayExist: next.type === 'raw' ? 'Central Store only' : next.whereItMayExist || 'Central Store only',
      };
    }
    setValues(next);
  };

  const handleSave = async () => {
    const category = categories.find((c) => c.name === values.category);
    const supplier = suppliers.find((s) => s.name === values.preferredSupplier);
    const conversionMatch = values.conversion.match(/=\s*([\d.]+)/);
    const packSizeMatch = values.packSize.match(/^([\d.]+)/);

    const input: CreateItemInput = {
      name: values.name,
      type: ITEM_FORM_TYPE_TO_CONTRACT[values.type],
      categoryId: category?.id ?? null,
      categoryName: category ? null : values.category || null,
      preferredSupplierId: supplier?.id ?? null,
      buyUnit: values.buyUnit,
      usageUnit: values.usageUnit,
      conversionFactor: conversionMatch ? conversionMatch[1] : null,
      packSize: packSizeMatch ? packSizeMatch[1] : null,
      departmentTags: parseDepartmentTags(values.whereItMayExist),
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
          />
          {warning ? (
            <p className="mt-4 font-wds-sans text-wds-caption text-wds-warning-fg">{warning}</p>
          ) : null}
          {error ? <p className="mt-4 font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
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
      </div>
    );
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      primaryLabel={item ? 'Save changes' : 'Create item'}
      onPrimaryAction={handleSave}
      primaryDisabled={saving}
    >
      <ItemFormFields
        variant="desktop"
        values={values}
        onChange={handleValuesChange}
        categoryOptions={categoryOptions}
        supplierOptions={supplierOptions}
      />
      {warning ? <p className="font-wds-sans text-wds-caption text-wds-warning-fg">{warning}</p> : null}
      {error ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
    </DrawerShell>
  );
}
