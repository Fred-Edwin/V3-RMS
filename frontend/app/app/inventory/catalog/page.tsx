'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Search, Trash2, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ExcelTable,
  FormField,
  IconButton,
  IconTile,
  Input,
  PageHeader,
  PageLayout,
  Select,
  Toggle,
  type ExcelColumn,
  type SelectOption,
} from '@/components/ui';
import { itemTypeLabel, resolveItemIcon } from '@/components/inventory/item-type-icon';
import {
  createInventoryItem,
  deactivateInventoryItem,
  listInventoryItems,
  listSuppliers,
  updateInventoryItem,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import type {
  CreateInventoryItemInput,
  DepartmentTag,
  InventoryItem,
  InventoryItemType,
  Supplier,
} from '@/types/inventory';

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'RAW', label: 'Raw Ingredient' },
  { value: 'PREPPED', label: 'Prepped' },
  { value: 'PASS_THROUGH', label: 'Pass-Through' },
];

const DEPARTMENT_TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

const departmentLabel: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

type FormState = {
  name: string;
  type: InventoryItemType;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string;
  reorderLevel: string;
  departmentTags: DepartmentTag[];
  defaultSupplierId: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: '',
  type: 'RAW',
  buyUnit: '',
  usageUnit: '',
  conversionFactor: '1',
  reorderLevel: '0',
  departmentTags: [],
  defaultSupplierId: '',
  isActive: true,
};

const toFormState = (item: InventoryItem): FormState => ({
  name: item.name,
  type: item.type,
  buyUnit: item.buyUnit,
  usageUnit: item.usageUnit,
  conversionFactor: item.conversionFactor,
  reorderLevel: item.reorderLevel,
  departmentTags: item.departmentTags,
  defaultSupplierId: '',
  isActive: item.isActive,
});

const formatKes = (value: string | number): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `Ksh ${Number.isFinite(n) ? n.toLocaleString('en-KE', { maximumFractionDigits: 2 }) : '0'}`;
};

interface ItemRow extends Record<string, unknown> {
  item: InventoryItem;
}

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER (dual desktop
// sidebar + CSS-hidden mobile shell) — each branch below checks its own
// shell context so only the visible copy ever fetches/renders.
export default function ItemCatalogPage(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <ItemCatalogPageInner />;
  return <ItemCatalogMobile />;
}

function ItemCatalogPageInner(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [panelItem, setPanelItem] = useState<InventoryItem | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const [deactivateTarget, setDeactivateTarget] = useState<InventoryItem | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [itemResult, supplierResult] = await Promise.all([
        listInventoryItems(accessToken, {}),
        listSuppliers(accessToken, true),
      ]);
      setItems(itemResult);
      setSuppliers(supplierResult);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<ItemRow[]>(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => showInactive || item.isActive)
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ item }));
  }, [items, search, showInactive]);

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setPanelItem('new');
  };

  const openEdit = (item: InventoryItem) => {
    setForm(toFormState(item));
    setErrors({});
    setPanelItem(item);
  };

  const closePanel = () => {
    setPanelItem(null);
  };

  const toggleDepartmentTag = (tag: DepartmentTag) => {
    setForm((f) => ({
      ...f,
      departmentTags: f.departmentTags.includes(tag)
        ? f.departmentTags.filter((t) => t !== tag)
        : [...f.departmentTags, tag],
    }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.buyUnit.trim()) next.buyUnit = 'Buy unit is required';
    if (!form.usageUnit.trim()) next.usageUnit = 'Usage unit is required';
    if (!/^\d{1,8}(\.\d{1,4})?$/.test(form.conversionFactor) || parseFloat(form.conversionFactor) <= 0) {
      next.conversionFactor = 'Must be a positive decimal';
    }
    if (!/^\d{1,8}(\.\d{1,4})?$/.test(form.reorderLevel) || parseFloat(form.reorderLevel) < 0) {
      next.reorderLevel = 'Must be zero or a positive decimal';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!accessToken || !validate()) return;
    setIsSaving(true);
    try {
      if (panelItem === 'new') {
        const input: CreateInventoryItemInput = {
          name: form.name.trim(),
          type: form.type,
          buyUnit: form.buyUnit.trim(),
          usageUnit: form.usageUnit.trim(),
          conversionFactor: form.conversionFactor,
          reorderLevel: form.reorderLevel,
          departmentTags: form.departmentTags,
          ...(form.defaultSupplierId ? { defaultSupplierId: form.defaultSupplierId } : {}),
        };
        await createInventoryItem(input, accessToken);
        toast({ variant: 'success', title: 'Item added', message: `${form.name.trim()} was added to the catalog.` });
      } else if (panelItem) {
        await updateInventoryItem(
          panelItem.id,
          {
            name: form.name.trim(),
            type: form.type,
            buyUnit: form.buyUnit.trim(),
            usageUnit: form.usageUnit.trim(),
            conversionFactor: form.conversionFactor,
            reorderLevel: form.reorderLevel,
            departmentTags: form.departmentTags,
            isActive: form.isActive,
          },
          accessToken,
        );
        toast({ variant: 'success', title: 'Item updated', message: `${form.name.trim()} was updated.` });
      }
      closePanel();
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to save item', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!accessToken || !deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await deactivateInventoryItem(deactivateTarget.id, accessToken);
      toast({ variant: 'success', title: 'Item deactivated', message: `${deactivateTarget.name} was removed from active use.` });
      setDeactivateTarget(null);
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to deactivate item', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsDeactivating(false);
    }
  };

  const columns: ExcelColumn<ItemRow>[] = [
    {
      key: 'name',
      label: 'Item',
      render: (row) => (
        <button type="button" onClick={() => openEdit(row.item)} className="flex items-center gap-2.5 text-left hover:underline">
          <IconTile icon={resolveItemIcon(row.item.name, row.item.type)} size="sm" />
          <span className="font-medium text-office-ink">{row.item.name}</span>
        </button>
      ),
    },
    { key: 'type', label: 'Type', render: (row) => <Badge tone="neutral">{itemTypeLabel[row.item.type]}</Badge> },
    { key: 'buyUnit', label: 'Buy Unit', render: (row) => row.item.buyUnit },
    { key: 'usageUnit', label: 'Usage Unit', render: (row) => row.item.usageUnit },
    { key: 'conversionFactor', label: 'Conversion', numeric: true, render: (row) => row.item.conversionFactor },
    { key: 'reorderLevel', label: 'Reorder Level', numeric: true, render: (row) => `${row.item.reorderLevel} ${row.item.usageUnit}` },
    { key: 'currentCost', label: 'Current Cost', numeric: true, render: (row) => formatKes(row.item.currentCost) },
    {
      key: 'departmentTags',
      label: 'Departments',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.item.departmentTags.length === 0 ? (
            <span className="text-stone-400">—</span>
          ) : (
            row.item.departmentTags.map((tag) => (
              <Badge key={tag} tone="neutral">{departmentLabel[tag]}</Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (row.item.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <IconButton
          icon={<Trash2 size={15} />}
          label="Deactivate item"
          variant="ghost"
          size="sm"
          onClick={() => setDeactivateTarget(row.item)}
          disabled={!row.item.isActive}
        />
      ),
    },
  ];

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Item Catalog"
        subtitle={`${items.filter((i) => i.isActive).length} active items`}
        action={<Button leftIcon={<Plus size={18} />} onClick={openCreate}>Add Item</Button>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-label-md text-stone-600">
            <Toggle checked={showInactive} onChange={setShowInactive} />
            Show inactive items
          </label>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="pl-9" />
          </div>
        </div>

        <ExcelTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.item.id}
          isLoading={isLoading}
          headerTone="navy"
          emptyState={
            <div className="px-4 py-10 text-center text-body-sm text-stone-500">
              {items.length === 0 ? 'No items in the catalog yet — add your first item.' : 'No items match your search.'}
            </div>
          }
        />
      </Card>

      {panelItem && (
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(28,25,23,0.4)]" onClick={closePanel}>
          <div
            className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl animate-fade-up motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <h2 className="text-heading-md font-semibold text-stone-900">
                {panelItem === 'new' ? 'Add Item' : `Edit ${panelItem.name}`}
              </h2>
              <IconButton icon={<X size={18} />} label="Close" variant="ghost" size="sm" onClick={closePanel} />
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <FormField label="Name" htmlFor="item-name" required errorMessage={errors.name}>
                <Input id="item-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Arabica Coffee Beans" />
              </FormField>

              <FormField label="Type" htmlFor="item-type" required>
                <Select
                  id="item-type"
                  options={TYPE_OPTIONS}
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as InventoryItemType }))}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Buy Unit" htmlFor="buy-unit" required errorMessage={errors.buyUnit} helperText="e.g. kg, bag">
                  <Input id="buy-unit" value={form.buyUnit} onChange={(e) => setForm((f) => ({ ...f, buyUnit: e.target.value }))} />
                </FormField>
                <FormField label="Usage Unit" htmlFor="usage-unit" required errorMessage={errors.usageUnit} helperText="e.g. g, ml">
                  <Input id="usage-unit" value={form.usageUnit} onChange={(e) => setForm((f) => ({ ...f, usageUnit: e.target.value }))} />
                </FormField>
              </div>

              <FormField
                label="Conversion Factor"
                htmlFor="conversion-factor"
                required
                errorMessage={errors.conversionFactor}
                helperText={`1 ${form.buyUnit || 'buy unit'} = this many ${form.usageUnit || 'usage units'}`}
              >
                <Input id="conversion-factor" inputMode="decimal" value={form.conversionFactor} onChange={(e) => setForm((f) => ({ ...f, conversionFactor: e.target.value }))} />
              </FormField>

              <FormField label="Reorder Level" htmlFor="reorder-level" required errorMessage={errors.reorderLevel} helperText={`In ${form.usageUnit || 'usage units'} — triggers a low-stock flag at or below this`}>
                <Input id="reorder-level" inputMode="decimal" value={form.reorderLevel} onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
              </FormField>

              <FormField label="Department Tags" htmlFor="department-tags">
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENT_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleDepartmentTag(tag)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-label-md font-medium transition-colors',
                        form.departmentTags.includes(tag)
                          ? 'border-espresso bg-espresso text-crema'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100',
                      )}
                    >
                      {departmentLabel[tag]}
                    </button>
                  ))}
                </div>
              </FormField>

              {panelItem === 'new' && suppliers.length > 0 && (
                <FormField label="Default Supplier" htmlFor="default-supplier" helperText="Optional — can be assigned later from the Suppliers screen">
                  <Select
                    id="default-supplier"
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    placeholder="No default supplier"
                    value={form.defaultSupplierId}
                    onChange={(e) => setForm((f) => ({ ...f, defaultSupplierId: e.target.value }))}
                  />
                </FormField>
              )}

              {panelItem !== 'new' && (
                <FormField label="Current Cost" htmlFor="current-cost" helperText="Read-only — derived automatically from received purchases">
                  <Input id="current-cost" value={formatKes(panelItem.currentCost)} disabled />
                </FormField>
              )}

              {panelItem !== 'new' && (
                <label className="flex items-center gap-2 text-label-md text-stone-700">
                  <Toggle checked={form.isActive} onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} />
                  Active
                </label>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-stone-100 px-6 py-4">
              <Button variant="secondary" onClick={closePanel}>Cancel</Button>
              <Button onClick={handleSave} isLoading={isSaving}>{panelItem === 'new' ? 'Add Item' : 'Save Changes'}</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate item?"
        description={`${deactivateTarget?.name ?? 'This item'} will no longer appear in active catalog lists. Historical records are kept.`}
        confirmLabel="Deactivate"
        isLoading={isDeactivating}
      />
    </PageLayout>
  );
}

// ─── Manager mobile ─────────────────────────────────────────────────────────
// §8.1 row 2 mobile: "List view, tap item → full-screen edit form, one field
// group per step (identity → units → department tags → default supplier)
// rather than one long form, since small-screen long forms are error-prone."

type CatalogStep = 'identity' | 'units' | 'departments' | 'supplier';
const STEPS: { key: CatalogStep; label: string }[] = [
  { key: 'identity', label: 'Identity' },
  { key: 'units', label: 'Units' },
  { key: 'departments', label: 'Departments' },
  { key: 'supplier', label: 'Supplier' },
];

function ItemCatalogMobile(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editingItem, setEditingItem] = useState<InventoryItem | 'new' | null>(null);
  const [step, setStep] = useState<CatalogStep>('identity');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [itemResult, supplierResult] = await Promise.all([
        listInventoryItems(accessToken, { isActive: true }),
        listSuppliers(accessToken, true),
      ]);
      setItems(itemResult);
      setSuppliers(supplierResult);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => !q || item.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setStep('identity');
    setEditingItem('new');
  };

  const openEdit = (item: InventoryItem) => {
    setForm(toFormState(item));
    setErrors({});
    setStep('identity');
    setEditingItem(item);
  };

  const closeForm = () => setEditingItem(null);

  const toggleDepartmentTag = (tag: DepartmentTag) => {
    setForm((f) => ({
      ...f,
      departmentTags: f.departmentTags.includes(tag) ? f.departmentTags.filter((t) => t !== tag) : [...f.departmentTags, tag],
    }));
  };

  const validateIdentityAndUnits = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.buyUnit.trim()) next.buyUnit = 'Buy unit is required';
    if (!form.usageUnit.trim()) next.usageUnit = 'Usage unit is required';
    if (!/^\d{1,8}(\.\d{1,4})?$/.test(form.conversionFactor) || parseFloat(form.conversionFactor) <= 0) {
      next.conversionFactor = 'Must be a positive decimal';
    }
    if (!/^\d{1,8}(\.\d{1,4})?$/.test(form.reorderLevel) || parseFloat(form.reorderLevel) < 0) {
      next.reorderLevel = 'Must be zero or a positive decimal';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const goNext = () => {
    if (step === 'identity' && !form.name.trim()) {
      setErrors((e) => ({ ...e, name: 'Name is required' }));
      return;
    }
    if (step === 'units' && !validateIdentityAndUnits()) return;
    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].key);
  };
  const goBack = () => setStep(STEPS[Math.max(stepIndex - 1, 0)].key);

  const handleSave = async () => {
    if (!accessToken || !editingItem || !validateIdentityAndUnits()) return;
    setIsSaving(true);
    try {
      if (editingItem === 'new') {
        const input: CreateInventoryItemInput = {
          name: form.name.trim(),
          type: form.type,
          buyUnit: form.buyUnit.trim(),
          usageUnit: form.usageUnit.trim(),
          conversionFactor: form.conversionFactor,
          reorderLevel: form.reorderLevel,
          departmentTags: form.departmentTags,
          ...(form.defaultSupplierId ? { defaultSupplierId: form.defaultSupplierId } : {}),
        };
        await createInventoryItem(input, accessToken);
        toast({ variant: 'success', title: 'Item added', message: `${form.name.trim()} was added to the catalog.` });
      } else {
        await updateInventoryItem(
          editingItem.id,
          {
            name: form.name.trim(),
            type: form.type,
            buyUnit: form.buyUnit.trim(),
            usageUnit: form.usageUnit.trim(),
            conversionFactor: form.conversionFactor,
            reorderLevel: form.reorderLevel,
            departmentTags: form.departmentTags,
            isActive: form.isActive,
          },
          accessToken,
        );
        toast({ variant: 'success', title: 'Item updated', message: `${form.name.trim()} was updated.` });
      }
      closeForm();
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to save item', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (editingItem) {
    const isLastStep = step === 'supplier';
    return (
      <div className="min-h-full bg-crema pb-24">
        <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
          <button type="button" onClick={closeForm} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
            <ArrowLeft size={16} /> Item Catalog
          </button>
          <p className="font-display text-heading-md font-medium">{editingItem === 'new' ? 'Add Item' : `Edit ${editingItem.name}`}</p>
          <div className="mt-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s.key} className={cn('h-1.5 flex-1 rounded-full', i <= stepIndex ? 'bg-amber' : 'bg-crema/15')} />
            ))}
          </div>
          <p className="mt-1.5 text-label-sm text-crema/60">Step {stepIndex + 1} of {STEPS.length} · {STEPS[stepIndex].label}</p>
        </div>

        <div className="px-4 py-4">
          {step === 'identity' && (
            <div className="space-y-4">
              <FormField label="Name" htmlFor="m-item-name" required errorMessage={errors.name}>
                <Input id="m-item-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Arabica Coffee Beans" />
              </FormField>
              <FormField label="Type" htmlFor="m-item-type" required>
                <Select id="m-item-type" options={TYPE_OPTIONS} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as InventoryItemType }))} />
              </FormField>
              {editingItem !== 'new' && (
                <label className="flex items-center gap-2 text-label-md text-stone-700">
                  <Toggle checked={form.isActive} onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} />
                  Active
                </label>
              )}
            </div>
          )}

          {step === 'units' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Buy Unit" htmlFor="m-buy-unit" required errorMessage={errors.buyUnit} helperText="e.g. kg, bag">
                  <Input id="m-buy-unit" value={form.buyUnit} onChange={(e) => setForm((f) => ({ ...f, buyUnit: e.target.value }))} />
                </FormField>
                <FormField label="Usage Unit" htmlFor="m-usage-unit" required errorMessage={errors.usageUnit} helperText="e.g. g, ml">
                  <Input id="m-usage-unit" value={form.usageUnit} onChange={(e) => setForm((f) => ({ ...f, usageUnit: e.target.value }))} />
                </FormField>
              </div>
              <FormField
                label="Conversion Factor"
                htmlFor="m-conversion-factor"
                required
                errorMessage={errors.conversionFactor}
                helperText={`1 ${form.buyUnit || 'buy unit'} = this many ${form.usageUnit || 'usage units'}`}
              >
                <Input id="m-conversion-factor" inputMode="decimal" value={form.conversionFactor} onChange={(e) => setForm((f) => ({ ...f, conversionFactor: e.target.value }))} />
              </FormField>
              <FormField label="Reorder Level" htmlFor="m-reorder-level" required errorMessage={errors.reorderLevel} helperText={`In ${form.usageUnit || 'usage units'}`}>
                <Input id="m-reorder-level" inputMode="decimal" value={form.reorderLevel} onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
              </FormField>
              {editingItem !== 'new' && (
                <FormField label="Current Cost" htmlFor="m-current-cost" helperText="Read-only — derived automatically from received purchases">
                  <Input id="m-current-cost" value={formatKes(editingItem.currentCost)} disabled />
                </FormField>
              )}
            </div>
          )}

          {step === 'departments' && (
            <div>
              <p className="mb-3 text-body-sm text-stone-500">Which departments requisition this item?</p>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleDepartmentTag(tag)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-label-md font-medium transition-colors',
                      form.departmentTags.includes(tag) ? 'border-espresso bg-espresso text-crema' : 'border-stone-200 bg-white text-stone-600',
                    )}
                  >
                    {departmentLabel[tag]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'supplier' && (
            <div>
              {editingItem === 'new' ? (
                <FormField label="Default Supplier" htmlFor="m-default-supplier" helperText="Optional — can be assigned later from the Suppliers screen">
                  <Select
                    id="m-default-supplier"
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    placeholder="No default supplier"
                    value={form.defaultSupplierId}
                    onChange={(e) => setForm((f) => ({ ...f, defaultSupplierId: e.target.value }))}
                  />
                </FormField>
              ) : (
                <p className="text-body-sm text-stone-500">Default supplier is managed from the Suppliers screen.</p>
              )}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 flex gap-3 border-t border-stone-200 bg-white px-4 py-3">
          {stepIndex > 0 && (
            <button type="button" onClick={goBack} className="h-12 flex-1 rounded-md border border-stone-200 text-label-lg font-semibold text-stone-700">
              Back
            </button>
          )}
          {!isLastStep ? (
            <button type="button" onClick={goNext} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso">
              Next <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : editingItem === 'new' ? 'Add Item' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-crema pb-24">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <p className="font-display text-heading-lg font-medium">Item Catalog</p>
        <p className="text-label-md text-crema/70">{items.length} active items</p>
      </div>

      <div className="px-4 py-4">
        <div className="relative mb-4">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name…"
            className="h-11 w-full rounded-md border border-stone-200 bg-white pl-9 pr-3 text-body-md text-stone-900 placeholder:text-stone-400 focus:border-espresso focus:outline-none"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<Search size={40} />}
            heading={items.length === 0 ? 'No items yet' : 'No items match your search'}
            body={items.length === 0 ? 'Add your first item to get started.' : 'Try a different search term.'}
          />
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Card key={item.id} onClick={() => openEdit(item)} className="flex items-center gap-3 p-3">
                <IconTile icon={resolveItemIcon(item.name, item.type)} />
                <div className="min-w-0 flex-1">
                  <p className="text-body-md font-semibold leading-snug text-stone-900">{item.name}</p>
                  <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-label-sm text-stone-600">{itemTypeLabel[item.type]}</span>
                </div>
                <span className="shrink-0 text-stone-400">›</span>
              </Card>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openCreate}
        className="fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-amber px-5 text-label-lg font-semibold text-espresso shadow-lg"
      >
        <Plus size={20} />
        Add Item
      </button>
    </div>
  );
}
