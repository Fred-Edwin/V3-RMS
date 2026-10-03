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

import { SupplierFormFields, type SupplierFormValues } from '@/features/inventory/components/supplier-form';
import {
  RestockLevelGrid,
  RestockLevelHelperNote,
  type RestockLevelRow,
} from '@/features/inventory/components/restock-level-grid';

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
