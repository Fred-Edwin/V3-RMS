'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { PurchaseCatalogPickerDesktop, PurchaseCatalogPickerMobile } from '../purchase-catalog-picker';
import { PurchaseSelectionPanelDesktop, PurchaseSelectionPanelMobile, type SelectedPurchaseLine } from '../purchase-selection-panel';
import { PurchaseConfirmationDesktop, PurchaseConfirmationMobile } from '../purchase-confirmation';
import { usePurchaseCatalog, useFilteredPurchaseCatalog, type PurchaseCatalogRow, type StockLevelFilter } from '../../hooks/use-purchase-catalog';
import { useCreateSupplierInline, useNewPurchaseOptions, useSaveExpectedDelivery } from '../../hooks/use-new-purchase-form';
import type { SupplierPaymentTerms } from '../../../types';

const PRINT_HANDOFF_KEY = 'inventory:new-purchase:print-draft';
const DRAFT_STORAGE_KEY = 'inventory:new-purchase:draft';

interface NewPurchaseDraft {
  quantities: Record<string, number>;
  supplierId: string;
  paymentTerms: SupplierPaymentTerms;
}

function loadDraft(): NewPurchaseDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NewPurchaseDraft) : null;
  } catch {
    return null;
  }
}

/**
 * New purchase — checkbox-driven catalog picker + live selection panel
 * (2026-09-17 redesign, owner-approved in Paper). Replaces the full-page
 * line-by-line builder. Reference: `X9J-0` (desktop), `XUT-0`/`XXR-0`
 * (mobile catalog + expanded review tray), `XOK-0`/`XZM-0` (confirmation).
 * Printable list is a separate route (`XN8-0`) — see `print/page.tsx`.
 *
 * Supplier is optional (a purchase list may be saved with no supplier, a
 * pure shopping list) — payment terms are disabled until one is chosen.
 * Selection is checkbox-driven over a browsable/filterable catalog, not
 * "search one item, add a line, repeat."
 */
export function NewPurchaseScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const userName = useAuthStore((s) => s.user?.name ?? 'Store Manager');

  const { items: catalogRows, categories, status: catalogStatus } = usePurchaseCatalog();
  const { suppliers, addSupplier } = useNewPurchaseOptions(true);
  const { save, saving, error } = useSaveExpectedDelivery();
  const { create: createSupplierInline } = useCreateSupplierInline();

  const [search, setSearch] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [stockFilter, setStockFilter] = React.useState<StockLevelFilter>('any');
  const [quantities, setQuantities] = React.useState<Record<string, number>>(() => loadDraft()?.quantities ?? {});
  const [supplierId, setSupplierId] = React.useState<string>(() => loadDraft()?.supplierId ?? '');
  const [paymentTerms, setPaymentTerms] = React.useState<SupplierPaymentTerms>(
    () => loadDraft()?.paymentTerms ?? 'INVOICE_TO_FOLLOW'
  );
  const [mobileReviewOpen, setMobileReviewOpen] = React.useState(false);
  const [saved, setSaved] = React.useState<{ itemCount: number; estTotal: number } | null>(null);

  // Autosave the in-progress selection so navigating away doesn't lose it —
  // no server-side draft for New Purchase (unlike Goods Receipt), so
  // localStorage is the persistence layer here.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (Object.keys(quantities).length === 0) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ quantities, supplierId, paymentTerms }));
      }
    } catch {
      // localStorage can throw in a private window — draft persistence is best-effort.
    }
  }, [quantities, supplierId, paymentTerms]);

  const categoryName = React.useMemo(
    () => categories.find((c) => c.id === categoryId)?.name ?? null,
    [categories, categoryId]
  );

  const filteredRows = useFilteredPurchaseCatalog(catalogRows, search, categoryId, categoryName, stockFilter);

  const selectedIds = React.useMemo(() => new Set(Object.keys(quantities)), [quantities]);
  const rowsById = React.useMemo(() => {
    const map = new Map<string, PurchaseCatalogRow>();
    for (const row of catalogRows) map.set(row.inventoryItemId, row);
    return map;
  }, [catalogRows]);

  const selectedLines: SelectedPurchaseLine[] = React.useMemo(
    () =>
      Object.entries(quantities)
        .map(([id, quantity]) => {
          const row = rowsById.get(id);
          if (!row) return null;
          return {
            inventoryItemId: id,
            itemName: row.itemName,
            buyUnit: row.buyUnit,
            unitPrice: row.buyUnitPrice,
            quantity,
          };
        })
        .filter((l): l is SelectedPurchaseLine => l !== null),
    [quantities, rowsById]
  );

  const estTotal = selectedLines.reduce((sum, l) => sum + l.quantity * (Number(l.unitPrice) || 0), 0);

  const handleToggle = (row: PurchaseCatalogRow) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (row.inventoryItemId in next) {
        delete next[row.inventoryItemId];
      } else {
        next[row.inventoryItemId] = 1;
      }
      return next;
    });
  };

  const handleQuantityChange = (inventoryItemId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [inventoryItemId]: quantity }));
  };

  const handleRemove = (inventoryItemId: string) => {
    setQuantities((prev) => {
      const next = { ...prev };
      delete next[inventoryItemId];
      return next;
    });
  };

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const supplierLabel = supplierOptions.find((o) => o.value === supplierId)?.label ?? '';

  const handleSupplierChange = (value: string) => {
    const match = supplierOptions.find((o) => o.value === value || o.label === value);
    setSupplierId(match?.value ?? value);
  };

  const handleCreateSupplier = async (name: string) => {
    const created = await createSupplierInline({ name, phone: null, defaultPaymentTerms: 'INVOICE_TO_FOLLOW' });
    if (created) {
      addSupplier(created);
      setSupplierId(created.id);
    }
  };

  const goBack = () => router.push('/app/inventory/purchasing');

  const buildPrintDraft = () => ({
    orgName: 'Wendo Coffee Bistro',
    dateLabel: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    supplierLabel: supplierLabel || 'Not assigned — hand to any supplier',
    requestedByName: userName,
    lines: selectedLines.map((l) => ({
      itemName: l.itemName,
      quantity: l.quantity,
      buyUnit: l.buyUnit,
      estCost: l.quantity * (Number(l.unitPrice) || 0),
    })),
    estTotal,
  });

  const handlePrint = () => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(PRINT_HANDOFF_KEY, JSON.stringify(buildPrintDraft()));
    } catch {
      // sessionStorage can throw in a private window — the print route falls back to an empty draft.
    }
    // `noopener` would sever the new tab's browsing-context-group and, with it,
    // its inherited sessionStorage — the print route reads its draft from
    // exactly that storage. Safe to keep `opener` here: same-origin route.
    window.open('/app/inventory/purchasing-print/new', '_blank');
  };

  const canSave = selectedLines.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const result = await save({
      supplierId: supplierId || undefined,
      paymentTerms: supplierId ? paymentTerms : undefined,
      lines: selectedLines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: String(l.quantity),
        estimatedUnitPrice: l.unitPrice || '0',
      })),
    });
    if (result) {
      setSaved({ itemCount: selectedLines.length, estTotal });
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // localStorage can throw in a private window — draft persistence is best-effort.
      }
    }
  };

  if (!hydrated || catalogStatus === 'loading' || catalogStatus === 'idle') return null;

  if (saved) {
    if (!isDesktop) {
      return <PurchaseConfirmationMobile {...saved} onPrint={handlePrint} onGoToPurchasing={goBack} />;
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'New purchase' }} className="shrink-0" />
        <PurchaseConfirmationDesktop {...saved} onPrint={handlePrint} onGoToPurchasing={goBack} />
      </div>
    );
  }

  const pickerProps = {
    rows: filteredRows,
    categories,
    selectedIds,
    onToggle: handleToggle,
    search,
    onSearchChange: setSearch,
    categoryId,
    onCategoryChange: setCategoryId,
    stockFilter,
    onStockFilterChange: setStockFilter,
  };

  const panelProps = {
    lines: selectedLines,
    onQuantityChange: handleQuantityChange,
    onRemove: handleRemove,
    supplierOptions,
    supplierLabel,
    onSupplierChange: handleSupplierChange,
    onCreateSupplier: handleCreateSupplier,
    paymentTerms,
    onPaymentTermsChange: setPaymentTerms,
    hasSupplier: Boolean(supplierId),
    estTotal,
    onSave: handleSave,
    onPrint: handlePrint,
    saving,
    saveDisabled: !canSave,
  };

  if (!isDesktop) {
    if (mobileReviewOpen) {
      return (
        <PurchaseSelectionPanelMobile
          {...panelProps}
          itemCount={selectedLines.length}
          onBack={() => setMobileReviewOpen(false)}
        />
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-surface">
        <MobileStatusBar />
        <div className="flex shrink-0 flex-col gap-0.5 bg-wds-sidebar-mid px-5 pb-4 pt-2">
          <div className="flex items-center justify-between">
            <button type="button" onClick={goBack} aria-label="Cancel" className="flex shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0 text-wds-primary-fg">
                <path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" onClick={goBack} className="font-wds-sans text-wds-body text-white/75">
              Cancel
            </button>
          </div>
          <span className="pt-1.5 font-wds-sans text-[22px] leading-7 font-semibold text-white">New purchase</span>
          <span className="font-wds-sans text-wds-body-sm text-white/60">Not a purchase order — a shopping list.</span>
        </div>
        <PurchaseCatalogPickerMobile {...pickerProps} />
        {error ? <p className="px-4 py-2 font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-wds-border bg-wds-surface py-3.5 px-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">
              {selectedLines.length} items selected
            </span>
            <span className="font-wds-mono text-wds-caption text-wds-text-faint">~KES {estTotal.toLocaleString()}</span>
          </div>
          <Button
            onClick={() => setMobileReviewOpen(true)}
            disabled={selectedLines.length === 0}
            className="h-10 px-4"
          >
            Review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Central Store', screen: 'New purchase' }} className="shrink-0" />
      <div className="flex min-h-0 grow flex-col gap-1 px-6 pt-6">
        <button
          type="button"
          onClick={goBack}
          className="flex w-fit items-center gap-1.5 font-wds-sans text-wds-body-sm text-wds-text-copy-muted outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
            <path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Purchasing
        </button>
        <h1 className="pt-2 font-wds-sans text-[24px] leading-[30px] tracking-[-0.01em] font-semibold text-wds-text-ink">
          New purchase
        </h1>
        <p className="pb-3 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
          Select items, then save or print. Not a purchase order — a shopping list.
        </p>
        <div className={cn('flex min-h-0 grow gap-5 pb-6')}>
          <PurchaseCatalogPickerDesktop {...pickerProps} className="min-w-0" />
          <PurchaseSelectionPanelDesktop {...panelProps} />
        </div>
        {error ? <p className="pb-4 font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
      </div>
    </div>
  );
}
