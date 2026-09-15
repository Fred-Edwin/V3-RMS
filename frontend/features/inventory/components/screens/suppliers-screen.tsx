'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui2/table';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { InventoryDesktopShell } from '../inventory-shell';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '../shell-states';
import { SupplierFormDrawer } from './supplier-form-screen';
import { useSuppliers } from '../../hooks/use-suppliers';

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  INVOICE_TO_FOLLOW: 'Invoice to follow',
  PAY_NOW: 'Pay now',
};

/**
 * Suppliers — the minimal host list the New/edit supplier drawer opens
 * from. Milestone One's contract only returns the supplier profile
 * (`05-plan.md` §5.3: "AP/invoice/payment panels ... are a later
 * milestone"), so this list stays profile-only — name, category, contact,
 * payment terms — not the fuller AP-aware landing Paper's `SX5-0`
 * background implies. That richer page belongs to Supplier AP's own
 * milestone.
 */
export function SuppliersScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const role = useAuthStore((s) => s.role);
  const [search, setSearch] = React.useState('');
  const [drawerSupplierId, setDrawerSupplierId] = React.useState<string | null | undefined>(undefined);

  const { suppliers, status, error, reload } = useSuppliers(search || undefined);

  const canRead = role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR';
  const canWrite = role === 'STORE_MANAGER';

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wds-canvas">
        <LoadingState />
      </div>
    );
  }

  if (!canRead) {
    const denied = <PermissionDeniedState description="Suppliers is visible to Store Managers, the Accountant, and Directors only." />;
    return isDesktop ? (
      <InventoryDesktopShell activeKey="suppliers" breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }}>
        <div className="flex flex-1 items-center justify-center">{denied}</div>
      </InventoryDesktopShell>
    ) : (
      <div className="flex min-h-screen flex-col items-center justify-center bg-wds-canvas p-4">{denied}</div>
    );
  }

  const body = (() => {
    if (status === 'loading' || status === 'idle') {
      return (
        <div className="flex flex-1 items-center justify-center">
          <LoadingState />
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load suppliers" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      );
    }
    if (suppliers.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState title="Nothing here yet" description="No suppliers on file. Add your first supplier to get started." />
        </div>
      );
    }
    if (isDesktop) {
      return (
        <div className="overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
          <Table>
            <TableHeader>
              <TableRow className="h-[30px]">
                <TableHead>Name</TableHead>
                <TableHead className="w-[140px]">Category</TableHead>
                <TableHead className="w-[180px]">Contact</TableHead>
                <TableHead className="w-[160px]">Payment terms</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id} className={s.retiredAt ? 'opacity-55' : undefined}>
                  <TableCell className="font-medium text-wds-text-ink">{s.name}</TableCell>
                  <TableCell className="text-wds-caption text-wds-text-ink">{s.category?.name ?? '—'}</TableCell>
                  <TableCell className="text-wds-caption text-wds-text-copy-muted">{s.contactName ?? '—'}</TableCell>
                  <TableCell className="text-wds-caption text-wds-text-copy-muted">
                    {PAYMENT_TERMS_LABEL[s.defaultPaymentTerms]}
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => setDrawerSupplierId(s.id)}
                        className="font-wds-sans text-wds-caption font-medium text-wds-primary"
                      >
                        Edit
                      </button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }
    return (
      <div className="flex flex-col rounded-wds-md border border-wds-border bg-wds-surface">
        {suppliers.map((s) => (
          <button
            type="button"
            key={s.id}
            onClick={() => canWrite && setDrawerSupplierId(s.id)}
            className={`flex flex-col gap-1 border-b border-wds-border p-3 text-left last:border-b-0 ${s.retiredAt ? 'opacity-55' : ''}`}
          >
            <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{s.name}</span>
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
              {s.category?.name ?? '—'} · {PAYMENT_TERMS_LABEL[s.defaultPaymentTerms]}
            </span>
          </button>
        ))}
      </div>
    );
  })();

  if (!isDesktop) {
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader title="Suppliers" subtitle={`${suppliers.length} suppliers on file`} userInitials="JM" />
        <div className="flex flex-1 flex-col gap-4 p-4">{body}</div>
        {canWrite ? (
          <div className="sticky bottom-0 border-t border-wds-border bg-wds-surface p-4">
            <Button className="w-full" onClick={() => setDrawerSupplierId(null)}>
              New supplier
            </Button>
          </div>
        ) : null}
        <SupplierFormDrawer
          supplierId={drawerSupplierId === undefined ? null : drawerSupplierId}
          open={drawerSupplierId !== undefined}
          onOpenChange={(open) => setDrawerSupplierId(open ? drawerSupplierId ?? null : undefined)}
          onSaved={reload}
          variant="mobile"
        />
      </div>
    );
  }

  return (
    <InventoryDesktopShell
      activeKey="suppliers"
      breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }}
      searchProps={{ placeholder: 'Search suppliers', value: search, onChange: (e) => setSearch(e.target.value) }}
      actions={canWrite ? <Button onClick={() => setDrawerSupplierId(null)}>New supplier</Button> : null}
    >
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Suppliers</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Supplier records for Central Store procurement.
          </p>
        </div>
        {body}
      </div>
      <SupplierFormDrawer
        supplierId={drawerSupplierId === undefined ? null : drawerSupplierId}
        open={drawerSupplierId !== undefined}
        onOpenChange={(open) => setDrawerSupplierId(open ? drawerSupplierId ?? null : undefined)}
        onSaved={reload}
        variant="desktop"
      />
    </InventoryDesktopShell>
  );
}
