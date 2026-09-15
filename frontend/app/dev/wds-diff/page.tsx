/**
 * Isolated, zero-chrome render of one Milestone One composite, for the
 * automated pixel-diff capture process (04-components.md "Pixel-diff
 * verification"). Not for browsing — visit with ?target=<name>.
 *
 * Temporary verification-pass tool. Delete after the diff run is done,
 * per the established pattern (04-components.md's prior composite entries).
 */
'use client';

import * as React from 'react';

import { Input } from '@/components/ui2/input';
import { MobileHubHeader, MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { KpiStrip, KpiRow } from '@/features/inventory/components/kpi-strip';
import { DrawerShell } from '@/features/inventory/components/drawer-shell';
import {
  ItemCatalogToolbar,
  ItemCatalogTable,
  ItemCatalogList,
  type ItemCatalogRow,
} from '@/features/inventory/components/item-catalog-table';
import { ItemFormFields, type ItemFormValues } from '@/features/inventory/components/item-form';
import { CategoryManagerList, type CategoryRow } from '@/features/inventory/components/category-manager-list';
import { SupplierFormFields, type SupplierFormValues } from '@/features/inventory/components/supplier-form';
import {
  RestockLevelGrid,
  RestockLevelHelperNote,
  type RestockLevelRow,
} from '@/features/inventory/components/restock-level-grid';

const demoCatalogRows: ItemCatalogRow[] = [
  { id: 'rice', name: 'Rice', type: 'raw', category: 'Dry goods', units: 'bag → kg · ÷25', pack: '25 kg', departmentScope: 'Central Store only' },
  { id: 'coffee', name: 'Coffee beans', type: 'stocked', category: 'Beverages', units: 'kg · no conversion', pack: '1 kg', departmentScope: 'Central Store · Barista' },
  { id: 'chicken', name: 'Chicken stock', type: 'prepped', category: 'Prepped bases', units: 'litres · no conversion', pack: '—', departmentScope: 'Central Store · Kitchen' },
  { id: 'milk', name: 'Milk', type: 'stocked', category: 'Dairy', units: 'crate → L · ÷12', pack: '12 L', departmentScope: 'Central Store · Kitchen, Barista' },
  { id: 'oil', name: 'Cooking oil', type: 'stocked', category: 'Dry goods', units: 'jerrican → L · ÷20', pack: '20 L', departmentScope: 'Central Store · Kitchen' },
  { id: 'vanilla', name: 'Vanilla syrup (retired)', type: 'stocked', category: 'Beverages', units: 'bottle → ml · ÷750', pack: '750 ml', departmentScope: 'Retired 04 Aug · history kept', retired: true },
];

const demoCategories: CategoryRow[] = [
  { id: 'dairy', name: 'Dairy', itemCount: 14 },
  { id: 'dry-goods', name: 'Dry goods', itemCount: 38 },
  { id: 'produce', name: 'Produce', itemCount: 22 },
  { id: 'beverages', name: 'Beverages', itemCount: 19 },
  { id: 'cleaning', name: 'Cleaning', itemCount: 11 },
  { id: 'seasonal', name: 'Seasonal (retired)', itemCount: 0, retired: true },
];

export default function WdsDiffPage() {
  const [target, setTarget] = React.useState<string | null>(null);
  React.useEffect(() => {
    setTarget(new URLSearchParams(window.location.search).get('target'));
  }, []);

  const [drawerShellOpen, setDrawerShellOpen] = React.useState(true);
  const [supplierFormValues, setSupplierFormValues] = React.useState<SupplierFormValues>({
    name: 'Samrat Ltd',
    contactPerson: 'Rajesh Samrat',
    category: 'Dairy',
    phone: '+254 722 118 340',
    email: 'orders@samrat.co.ke',
    location: 'Nyeri town',
    paymentTerms: 'invoice',
  });
  const [restockRows, setRestockRows] = React.useState<RestockLevelRow[]>([
    { id: 'coffee', name: 'Coffee beans', unit: 'kg', onHand: 12, restockLevel: 30 },
    { id: 'milk', name: 'Milk', unit: 'litres', onHand: 128, restockLevel: 80 },
  ]);
  const setRestockLevel = (id: string, value: string) =>
    setRestockRows((rows) => rows.map((r) => (r.id === id ? { ...r, restockLevel: Number(value) || 0 } : r)));
  const [itemFormValues, setItemFormValues] = React.useState<ItemFormValues>({
    name: 'Basmati rice',
    type: 'raw',
    category: 'Dry goods',
    preferredSupplier: undefined,
    buyUnit: 'bag',
    usageUnit: 'kg',
    conversion: '1 bag = 25 kg',
    packSize: '25 kg',
    whereItMayExist: 'Central Store only',
    restockLevel: '',
  });

  if (!target) return null;

  return (
    <>
      <style>{`html,body{overflow:hidden!important;margin:0!important;}`}</style>
      {renderTarget(target)}
    </>
  );

  function renderTarget(target: string) {
  switch (target) {
    case 'mobile-hub-header':
      return (
        <div className="w-[390px]">
          <MobileHubHeader title="Item catalog" subtitle="148 items · raw, prepped, stocked" userInitials="JM" />
        </div>
      );

    case 'mobile-task-header-cancel':
      return (
        <div className="w-[390px]">
          <MobileTaskHeader title="New item" subtitle="Type decides where the item can exist." trailingAction="Cancel" />
        </div>
      );

    case 'mobile-task-header-done':
      return (
        <div className="w-[390px]">
          <MobileTaskHeader
            title="Restock levels"
            subtitle="Central Store items only. Store restock level drives the store low-stock signal."
            trailingAction="Done"
          />
        </div>
      );

    case 'mobile-status-bar':
      return (
        <div className="w-[390px]">
          <MobileStatusBar />
        </div>
      );

    case 'kpi-strip-desktop':
      return (
        <div className="w-[1100px]">
          <KpiStrip
            cells={[
              { key: 'tracked', label: 'SKUs tracked', value: '248', detail: 'across 6 categories' },
              {
                key: 'value',
                label: 'Stock value',
                value: 'KES 1.84M',
                trend: { tone: 'success', label: '+4.2% vs last count' },
              },
              { key: 'reorder', label: 'Below reorder', value: '12', tone: 'accent', detail: '4 critical' },
              {
                key: 'expiring',
                label: 'Expiring ≤7d',
                value: '3',
                tone: 'warning',
                detail: 'KES 21,400 at risk',
              },
            ]}
          />
        </div>
      );

    case 'kpi-strip-mobile':
      return (
        <div className="w-[358px]">
          <KpiRow
            cells={[
              { key: 'tracked', label: 'Tracked', value: '148' },
              { key: 'scope', label: 'Needs scope', value: '3', tone: 'error' },
              { key: 'retired', label: 'Retired', value: '6' },
            ]}
          />
        </div>
      );

    case 'drawer-shell':
      return (
        <DrawerShell
          open={drawerShellOpen}
          onOpenChange={setDrawerShellOpen}
          title="New item"
          description="Type decides where the item can exist. Retiring later keeps all history."
          primaryLabel="Create item"
        >
          <div className="flex flex-col gap-wds-1.5">
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-muted">Name</span>
            <Input placeholder="Basmati rice" />
          </div>
        </DrawerShell>
      );

    case 'item-catalog-table-desktop':
      return (
        <div className="w-[1140px]">
          <ItemCatalogToolbar itemCount={148} className="rounded-t-wds-md border border-b-0 border-wds-border" />
          <ItemCatalogTable rows={demoCatalogRows} />
        </div>
      );

    case 'item-catalog-table-mobile':
      return (
        <div className="w-[358px]">
          <ItemCatalogList rows={demoCatalogRows.filter((r) => r.id !== 'oil')} />
        </div>
      );

    case 'item-form-desktop':
      return (
        <div className="w-[500px] bg-wds-surface py-[20px] px-wds-6">
          <ItemFormFields
            variant="desktop"
            values={itemFormValues}
            onChange={setItemFormValues}
            categoryOptions={['Dry goods', 'Dairy', 'Beverages', 'Prepped bases']}
            supplierOptions={['Samrat Ltd', 'Nyeri Dairy Co-op']}
          />
        </div>
      );

    case 'item-form-mobile':
      return (
        <div className="w-[390px] bg-wds-surface p-wds-4">
          <ItemFormFields
            variant="mobile"
            values={itemFormValues}
            onChange={setItemFormValues}
            categoryOptions={['Dry goods', 'Dairy', 'Beverages', 'Prepped bases']}
            supplierOptions={['Samrat Ltd', 'Nyeri Dairy Co-op']}
          />
        </div>
      );

    case 'category-manager-desktop':
      return (
        <div className="w-[420px] bg-wds-surface py-wds-4 px-wds-6">
          <CategoryManagerList variant="desktop" categories={demoCategories} />
        </div>
      );

    case 'category-manager-mobile':
      return (
        <div className="w-[390px] bg-wds-surface p-wds-4">
          <CategoryManagerList variant="mobile" categories={demoCategories} />
        </div>
      );

    case 'supplier-form-desktop':
      return (
        <div className="w-[459px] bg-wds-surface py-[20px] px-wds-6">
          <SupplierFormFields
            variant="desktop"
            values={supplierFormValues}
            onChange={setSupplierFormValues}
            categoryOptions={['Dairy', 'Dry goods', 'Produce', 'Beverages']}
          />
        </div>
      );

    case 'supplier-form-mobile':
      return (
        <div className="w-[390px] bg-wds-surface p-wds-4">
          <SupplierFormFields
            variant="mobile"
            values={supplierFormValues}
            onChange={setSupplierFormValues}
            categoryOptions={['Dairy', 'Dry goods', 'Produce', 'Beverages']}
          />
        </div>
      );

    case 'restock-grid-desktop':
      return (
        <div className="flex w-[440px] flex-col gap-wds-4 bg-wds-surface py-[20px] px-wds-6">
          <RestockLevelGrid variant="desktop" rows={restockRows} onRestockLevelChange={setRestockLevel} />
          <RestockLevelHelperNote variant="desktop">
            Raising Coffee beans restock level to 30 kg flags it low right away (12 on hand). Department
            restock levels are set by each department head, not here.
          </RestockLevelHelperNote>
        </div>
      );

    case 'restock-grid-mobile':
      return (
        <div className="flex w-[390px] flex-col gap-wds-4 bg-wds-surface p-wds-4">
          <RestockLevelGrid variant="mobile" rows={restockRows} onRestockLevelChange={setRestockLevel} />
          <RestockLevelHelperNote variant="mobile">
            Raising Coffee beans restock level to 30 kg flags it low right away (12 on hand).
          </RestockLevelHelperNote>
        </div>
      );

    default:
      return <div>Unknown target: {target}</div>;
  }
  }
}
