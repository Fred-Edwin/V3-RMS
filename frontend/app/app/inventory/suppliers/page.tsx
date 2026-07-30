'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Banknote, Mail, Phone, Plus, Search, Star, Trash2, User, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FormField,
  HelpTip,
  IconButton,
  IconTile,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Select,
  TabBar,
  type SelectOption,
} from '@/components/ui';
import { Sparkline } from '@/components/inventory/Sparkline';
import {
  assignSupplierItem,
  createSupplier,
  createSupplierInvoice,
  deactivateSupplier,
  getCentralStoreLocation,
  getPriceHistoryReport,
  getSupplierItems,
  listInventoryItems,
  listSupplierInvoices,
  listSuppliers,
  recordSupplierPayment,
  removeSupplierItem,
  updateSupplier,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { buyUnitCostValue } from '@/lib/inventory-format';
import type {
  InventoryItem,
  SupplierInvoice,
  SupplierItem,
  SupplierPaymentMethod,
  SupplierWithItemCount,
} from '@/types/inventory';

/** Roster-row rollup, computed client-side from each supplier's item assignments — no backend change needed (Phase 1 has few suppliers, so N calls here is trivial, unlike an N+1-per-item pattern). */
interface SupplierRosterInfo {
  lowStockCount: number;
}

interface DefaultSupplierInfo {
  supplierId: string;
  supplierName: string;
}

/** Working draft for one catalog item inside the Add/Edit Supplier sheet's item picker. */
interface ItemDraftEntry {
  checked: boolean;
  price: string;
  isDefault: boolean;
}

interface AllSupplierItemsResult {
  rosterInfoBySupplierId: Map<string, SupplierRosterInfo>;
  /** Every supplier's current item assignments, keyed by supplierId — reused by the Add/Edit sheet as the "existing assignments" baseline without a second fetch. */
  itemsBySupplierId: Map<string, SupplierItem[]>;
  /** Which supplier is currently the default for each item, org-wide — powers the sheet's "switching this will change X's default" warning. */
  defaultSupplierByItemId: Map<string, DefaultSupplierInfo>;
}

async function loadAllSupplierItems(
  suppliers: SupplierWithItemCount[],
  itemsById: Map<string, InventoryItem>,
  accessToken: string,
): Promise<AllSupplierItemsResult> {
  const rosterInfoBySupplierId = new Map<string, SupplierRosterInfo>();
  const itemsBySupplierId = new Map<string, SupplierItem[]>();
  const defaultSupplierByItemId = new Map<string, DefaultSupplierInfo>();

  await Promise.all(
    suppliers.map(async (supplier) => {
      const items = await getSupplierItems(supplier.id, accessToken).catch(() => []);
      itemsBySupplierId.set(supplier.id, items);

      let lowStockCount = 0;
      for (const si of items) {
        const item = itemsById.get(si.inventoryItemId);
        if (item?.onHandQty !== undefined && parseFloat(item.onHandQty) <= parseFloat(item.reorderLevel)) {
          lowStockCount += 1;
        }
        if (si.isDefault) {
          defaultSupplierByItemId.set(si.inventoryItemId, { supplierId: supplier.id, supplierName: supplier.name });
        }
      }
      rosterInfoBySupplierId.set(supplier.id, { lowStockCount });
    }),
  );

  return { rosterInfoBySupplierId, itemsBySupplierId, defaultSupplierByItemId };
}

const formatKes = (value: string | number): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `Ksh ${Number.isFinite(n) ? n.toLocaleString('en-KE', { maximumFractionDigits: 2 }) : '0'}`;
};

const PAYMENT_METHODS: SelectOption[] = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'HOUSE_ACCOUNT', label: 'House Account' },
  { value: 'CORPORATE_ACCOUNT', label: 'Corporate Account' },
];

const invoiceStatusTone: Record<SupplierInvoice['status'], 'success' | 'warning' | 'neutral'> = {
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  UNPAID: 'neutral',
};

type DetailTab = 'items' | 'ap';

interface SupplierFormState {
  name: string;
  contactName: string;
  phone: string;
  email: string;
}

const emptySupplierForm: SupplierFormState = { name: '', contactName: '', phone: '', email: '' };

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER only (dual
// desktop sidebar + CSS-hidden mobile shell) — STORE_ATTENDANT gets a single
// mobile-only shell, so it's never double-mounted and must always render.
// Manager's mobile-shell copy renders a genuinely separate mobile design
// (§8.1 row 3), not this desktop component reflowed.
export default function SuppliersPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const isDesktop = useIsDesktopShell();
  if (role === 'STORE_MANAGER' && !isDesktop) return <SuppliersMobile />;
  return <SuppliersPageInner />;
}

function SuppliersPageInner(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();
  const isManager = role === 'STORE_MANAGER';

  const [suppliers, setSuppliers] = useState<SupplierWithItemCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outstandingBySupplierId, setOutstandingBySupplierId] = useState<Map<string, number>>(new Map());
  const [rosterInfoBySupplierId, setRosterInfoBySupplierId] = useState<Map<string, SupplierRosterInfo>>(new Map());

  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithItemCount | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('items');

  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [sparklineByItemId, setSparklineByItemId] = useState<Map<string, number[]>>(new Map());
  const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithItemCount | null>(null);
  const [form, setForm] = useState<SupplierFormState>(emptySupplierForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof SupplierFormState, string>>>({});
  const [defaultSupplierByItemId, setDefaultSupplierByItemId] = useState<Map<string, DefaultSupplierInfo>>(new Map());
  const [catalogItems, setCatalogItems] = useState<InventoryItem[]>([]);
  const [itemDraft, setItemDraft] = useState<Map<string, ItemDraftEntry>>(new Map());
  const [itemDraftSearch, setItemDraftSearch] = useState('');

  const [deactivateTarget, setDeactivateTarget] = useState<SupplierWithItemCount | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ referenceNumber: '', amount: '', invoiceDate: '' });
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState<SupplierInvoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'MPESA' as SupplierPaymentMethod, paidAt: '' });
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listSuppliers(accessToken, true);
      setSuppliers(result);
      if (isManager) {
        // One org-wide call, grouped client-side — powers the roster's
        // outstanding-balance badge without an N+1 per-supplier fetch.
        const allInvoices = await listSupplierInvoices(accessToken);
        const grouped = new Map<string, number>();
        for (const inv of allInvoices) {
          const outstanding = parseFloat(inv.amount) - parseFloat(inv.amountPaid);
          grouped.set(inv.supplierId, (grouped.get(inv.supplierId) ?? 0) + outstanding);
        }
        setOutstandingBySupplierId(grouped);
      }

      const location = await getCentralStoreLocation(accessToken);
      const items = location ? await listInventoryItems(accessToken, { locationId: location.id, isActive: true }) : [];
      setCatalogItems(items);
      if (isManager) {
        const itemsById = new Map(items.map((item) => [item.id, item]));
        const { rosterInfoBySupplierId, defaultSupplierByItemId } = await loadAllSupplierItems(result, itemsById, accessToken);
        setRosterInfoBySupplierId(rosterInfoBySupplierId);
        setDefaultSupplierByItemId(defaultSupplierByItemId);
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load suppliers', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isManager, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSupplierItems = useCallback(
    async (supplierId: string) => {
      if (!accessToken) return;
      setIsLoadingItems(true);
      try {
        const result = await getSupplierItems(supplierId, accessToken);
        setSupplierItems(result);
        // Bounded by this one supplier's item count (Samrat's 14, not the
        // whole org's catalog) — a reasonable parallel fetch, not an N+1.
        const sparklines = await Promise.all(
          result.map(async (si) => {
            const lines = await getPriceHistoryReport(si.inventoryItemId, accessToken, supplierId).catch(() => []);
            const prices = lines
              .slice()
              .reverse()
              .map((l) => parseFloat(l.invoicePrice ?? l.unitPrice))
              .filter((p) => Number.isFinite(p));
            return [si.inventoryItemId, prices] as const;
          }),
        );
        setSparklineByItemId(new Map(sparklines));
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load supplier items', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoadingItems(false);
      }
    },
    [accessToken, toast],
  );

  const loadInvoices = useCallback(
    async (supplierId: string) => {
      if (!accessToken) return;
      setIsLoadingInvoices(true);
      try {
        const result = await listSupplierInvoices(accessToken, { supplierId });
        setInvoices(result);
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load invoices', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoadingInvoices(false);
      }
    },
    [accessToken, toast],
  );

  const openSupplier = useCallback(
    (supplier: SupplierWithItemCount) => {
      setSelectedSupplier(supplier);
      setDetailTab('items');
      void loadSupplierItems(supplier.id);
      if (isManager) void loadInvoices(supplier.id);
    },
    [isManager, loadSupplierItems, loadInvoices],
  );

  // Pre-select the first supplier once the roster loads, so the detail panel
  // is never a blank void on first paint — a real screen, not empty chrome.
  useEffect(() => {
    if (!selectedSupplier && suppliers.length > 0) {
      openSupplier(suppliers[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only meant to fire once when suppliers first arrive, not on every selection change
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [suppliers, search]);

  const openCreateForm = () => {
    setEditingSupplier(null);
    setForm(emptySupplierForm);
    setErrors({});
    setItemDraft(new Map());
    setItemDraftSearch('');
    setIsFormOpen(true);
  };

  const openEditForm = async (supplier: SupplierWithItemCount) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      contactName: supplier.contactName ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
    });
    setErrors({});
    setItemDraftSearch('');
    setItemDraft(new Map());
    setIsFormOpen(true);
    if (!accessToken) return;
    try {
      const existing = await getSupplierItems(supplier.id, accessToken);
      setItemDraft(
        new Map(existing.map((si) => [si.inventoryItemId, { checked: true, price: si.lastPrice ?? '', isDefault: si.isDefault }])),
      );
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load current items', message: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  const toggleDraftItem = (item: InventoryItem) => {
    setItemDraft((prev) => {
      const next = new Map(prev);
      const current = next.get(item.id);
      if (current?.checked) {
        next.set(item.id, { ...current, checked: false, isDefault: false });
      } else {
        // Pre-fill from the item's own weighted-average cost (a sensible
        // starting point) rather than leaving it blank — the Manager can
        // still override it before saving, this just saves re-typing a
        // number that's usually already right. A brand-new item's cost is
        // 0 (no purchase history yet) — leave that blank instead of
        // pre-filling a misleading "0.00".
        const costBasis = buyUnitCostValue(item);
        const defaultPrice = current?.price || (costBasis > 0 ? costBasis.toFixed(2) : '');
        next.set(item.id, { checked: true, price: defaultPrice, isDefault: current?.isDefault ?? false });
      }
      return next;
    });
  };

  const setDraftItemPrice = (itemId: string, price: string) => {
    setItemDraft((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId);
      if (!current) return prev;
      next.set(itemId, { ...current, price });
      return next;
    });
  };

  const setDraftItemDefault = (itemId: string, isDefault: boolean) => {
    setItemDraft((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId);
      if (!current) return prev;
      next.set(itemId, { ...current, isDefault });
      return next;
    });
  };

  const handleSaveSupplier = async () => {
    if (!accessToken) return;
    const nextErrors: typeof errors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Must be a valid email';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contactName: form.contactName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      };
      let supplierId = editingSupplier?.id;
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload, accessToken);
      } else {
        const created = await createSupplier(payload, accessToken);
        supplierId = created.id;
      }

      if (supplierId) {
        const finalSupplierId = supplierId;
        // Diff the draft against what was loaded, not a wholesale replace —
        // untouched assignments (e.g. lastPrice set by a previous receiving)
        // must survive a save that only touched the checkbox for another row.
        for (const [itemId, entry] of Array.from(itemDraft)) {
          if (entry.checked) {
            await assignSupplierItem(
              finalSupplierId,
              { inventoryItemId: itemId, isDefault: entry.isDefault, lastPrice: entry.price || undefined },
              accessToken,
            );
          } else {
            await removeSupplierItem(finalSupplierId, itemId, accessToken).catch(() => undefined);
          }
        }
      }

      toast({
        variant: 'success',
        title: editingSupplier ? 'Supplier updated' : 'Supplier added',
        message: `${form.name.trim()} was ${editingSupplier ? 'updated' : 'added'}.`,
      });
      setIsFormOpen(false);
      void load();
      if (supplierId && selectedSupplier?.id === supplierId) void loadSupplierItems(supplierId);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to save supplier', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivateSupplier = async () => {
    if (!accessToken || !deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await deactivateSupplier(deactivateTarget.id, accessToken);
      toast({ variant: 'success', title: 'Supplier deactivated', message: `${deactivateTarget.name} was deactivated.` });
      setDeactivateTarget(null);
      if (selectedSupplier?.id === deactivateTarget.id) setSelectedSupplier(null);
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to deactivate supplier', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!accessToken || !selectedSupplier) return;
    try {
      await removeSupplierItem(selectedSupplier.id, itemId, accessToken);
      toast({ variant: 'success', title: 'Item removed', message: 'The item was unassigned from this supplier.' });
      void loadSupplierItems(selectedSupplier.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to remove item', message: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  const handleSetDefault = async (si: SupplierItem) => {
    if (!accessToken || !selectedSupplier || si.isDefault) return;
    setIsSettingDefault(si.inventoryItemId);
    try {
      await assignSupplierItem(
        selectedSupplier.id,
        { inventoryItemId: si.inventoryItemId, isDefault: true, lastPrice: si.lastPrice ?? undefined },
        accessToken,
      );
      toast({ variant: 'success', title: 'Default supplier set', message: `${selectedSupplier.name} is now the default for ${si.inventoryItem?.name ?? 'this item'}.` });
      void loadSupplierItems(selectedSupplier.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to set default supplier', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSettingDefault(null);
    }
  };

  const openInvoiceModal = () => {
    setInvoiceForm({ referenceNumber: '', amount: '', invoiceDate: new Date().toISOString().slice(0, 10) });
    setIsInvoiceModalOpen(true);
  };

  const handleSaveInvoice = async () => {
    if (!accessToken || !selectedSupplier) return;
    if (!invoiceForm.referenceNumber.trim() || !invoiceForm.amount || !invoiceForm.invoiceDate) {
      toast({ variant: 'error', title: 'Missing details', message: 'Reference number, amount, and invoice date are required.' });
      return;
    }
    setIsSavingInvoice(true);
    try {
      await createSupplierInvoice(
        {
          supplierId: selectedSupplier.id,
          referenceNumber: invoiceForm.referenceNumber.trim(),
          amount: invoiceForm.amount,
          invoiceDate: new Date(invoiceForm.invoiceDate).toISOString(),
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Invoice recorded', message: `${invoiceForm.referenceNumber.trim()} was added.` });
      setIsInvoiceModalOpen(false);
      void loadInvoices(selectedSupplier.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to record invoice', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const openPaymentModal = (invoice: SupplierInvoice) => {
    setPaymentForm({ amount: '', method: 'MPESA', paidAt: new Date().toISOString().slice(0, 10) });
    setPaymentTarget(invoice);
  };

  const handleRecordPayment = async () => {
    if (!accessToken || !paymentTarget || !selectedSupplier) return;
    if (!paymentForm.amount || !paymentForm.paidAt) {
      toast({ variant: 'error', title: 'Missing details', message: 'Amount and payment date are required.' });
      return;
    }
    setIsSavingPayment(true);
    try {
      await recordSupplierPayment(
        paymentTarget.id,
        { amount: paymentForm.amount, method: paymentForm.method, paidAt: new Date(paymentForm.paidAt).toISOString() },
        accessToken,
      );
      toast({ variant: 'success', title: 'Payment recorded', message: `Payment of ${formatKes(paymentForm.amount)} was recorded.` });
      setPaymentTarget(null);
      void loadInvoices(selectedSupplier.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to record payment', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const outstandingForSupplier = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) - parseFloat(inv.amountPaid)), 0);

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} active suppliers`}
        action={
          <div className="flex items-center gap-2">
            <HelpTip title="Suppliers">
              <p>Everyone you buy from, what you buy from them, and — for Managers — what you owe them.</p>
              <p>
                The star next to an item marks its default supplier (used to pre-fill new purchase orders). Click a
                hollow star to make that supplier the default instead.
              </p>
            </HelpTip>
            <Button leftIcon={<Plus size={18} />} onClick={openCreateForm}>Add Supplier</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
        {/* Roster */}
        <Card className="overflow-hidden">
          <div className="border-b border-stone-100 px-4 py-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers…" className="pl-9" />
            </div>
          </div>
          <div className="max-h-[640px] divide-y divide-stone-100 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="m-3 h-16 animate-pulse rounded-md bg-stone-100" />)
            ) : filteredSuppliers.length === 0 ? (
              <p className="px-4 py-10 text-center text-body-sm text-stone-500">No suppliers yet.</p>
            ) : (
              filteredSuppliers.map((supplier) => {
                const outstanding = outstandingBySupplierId.get(supplier.id) ?? 0;
                const rosterInfo = rosterInfoBySupplierId.get(supplier.id);
                const hasOutstanding = isManager && outstanding > 0.005;
                // At most one badge per row — financial exposure is the more
                // urgent signal for a Manager, so it wins if both are true.
                const badge = hasOutstanding
                  ? { label: `${formatKes(outstanding)} owed` }
                  : rosterInfo?.lowStockCount
                    ? { label: `${rosterInfo.lowStockCount} low stock` }
                    : null;
                return (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => openSupplier(supplier)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50',
                      selectedSupplier?.id === supplier.id && 'bg-parchment',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-md font-medium text-stone-900">{supplier.name}</p>
                      <p className="truncate text-label-sm text-stone-400">
                        {supplier._count.supplierItems} item{supplier._count.supplierItems === 1 ? '' : 's'}
                      </p>
                    </div>
                    {badge && <Badge tone="warning" className="shrink-0">{badge.label}</Badge>}
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Detail panel */}
        {!selectedSupplier ? (
          <Card className="flex min-h-[400px] items-center justify-center">
            {isLoading ? (
              <p className="text-body-sm text-stone-500">Loading…</p>
            ) : (
              <EmptyState
                icon={<User size={40} />}
                heading="No suppliers yet"
                body="Add your first supplier to start assigning items and tracking pricing."
              />
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
              <div>
                <h2 className="text-heading-md font-semibold text-stone-900">{selectedSupplier.name}</h2>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-label-md text-stone-500">
                  {selectedSupplier.contactName && (
                    <span className="inline-flex items-center gap-1.5"><User size={13} /> {selectedSupplier.contactName}</span>
                  )}
                  {selectedSupplier.phone && (
                    <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {selectedSupplier.phone}</span>
                  )}
                  {selectedSupplier.email && (
                    <span className="inline-flex items-center gap-1.5"><Mail size={13} /> {selectedSupplier.email}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEditForm(selectedSupplier)}>Edit</Button>
                <IconButton icon={<Trash2 size={15} />} label="Deactivate supplier" variant="ghost" size="sm" onClick={() => setDeactivateTarget(selectedSupplier)} />
              </div>
            </div>

            {isManager ? (
              <TabBar
                tabs={[
                  { value: 'items', label: 'Items & Pricing' },
                  { value: 'ap', label: 'Accounts Payable' },
                ]}
                active={detailTab}
                onChange={setDetailTab}
                className="px-5 pt-3"
              />
            ) : null}

            {detailTab === 'items' || !isManager ? (
              <div className="p-5">
                {isLoadingItems ? (
                  <div className="h-40 animate-pulse rounded-md bg-stone-100" />
                ) : supplierItems.length === 0 ? (
                  <p className="py-6 text-center text-body-sm text-stone-500">No items assigned to this supplier yet — assign them from the Item Catalog screen.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 rounded-md border border-stone-100">
                    {supplierItems.map((si) => (
                      <li key={si.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <p className="min-w-0 flex-1 truncate text-body-sm font-medium text-stone-900">
                          {si.inventoryItem?.name ?? si.inventoryItemId}
                        </p>
                        <Sparkline values={sparklineByItemId.get(si.inventoryItemId) ?? []} />
                        <p className="w-24 shrink-0 text-right text-body-sm font-semibold tabular-nums text-stone-900">
                          {si.lastPrice ? formatKes(si.lastPrice) : <span className="font-normal text-stone-300">—</span>}
                        </p>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {isManager ? (
                            <IconButton
                              icon={<Star size={14} className={si.isDefault ? 'fill-amber text-amber' : 'text-stone-300'} />}
                              label={si.isDefault ? 'Default supplier for this item' : 'Set as default supplier'}
                              variant="ghost"
                              size="sm"
                              disabled={si.isDefault || isSettingDefault === si.inventoryItemId}
                              onClick={() => handleSetDefault(si)}
                            />
                          ) : (
                            si.isDefault && <Star size={13} className="shrink-0 fill-amber text-amber" aria-label="Default supplier" />
                          )}
                          {isManager && (
                            <IconButton icon={<X size={14} />} label="Remove item" variant="ghost" size="sm" onClick={() => handleRemoveItem(si.inventoryItemId)} />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-body-sm text-stone-600">
                    Outstanding: <span className="font-semibold tabular-nums text-stone-900">{formatKes(outstandingForSupplier)}</span>
                  </p>
                  <Button size="sm" leftIcon={<Plus size={16} />} onClick={openInvoiceModal}>Record Invoice</Button>
                </div>
                {isLoadingInvoices ? (
                  <div className="h-40 animate-pulse rounded-md bg-stone-100" />
                ) : invoices.length === 0 ? (
                  <p className="py-6 text-center text-body-sm text-stone-500">No invoices recorded for this supplier yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 rounded-md border border-stone-100">
                    {invoices.map((invoice) => {
                      const outstanding = parseFloat(invoice.amount) - parseFloat(invoice.amountPaid);
                      return (
                        <li key={invoice.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-body-sm font-medium text-stone-800">{invoice.referenceNumber}</p>
                            <p className="text-label-sm text-stone-400">{new Date(invoice.invoiceDate).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <p className="text-label-lg font-semibold tabular-nums text-stone-900">{formatKes(invoice.amount)}</p>
                              {outstanding > 0 && <p className="text-label-sm tabular-nums text-danger">{formatKes(outstanding)} due</p>}
                            </div>
                            <Badge tone={invoiceStatusTone[invoice.status]}>{invoice.status.replace('_', ' ')}</Badge>
                            {invoice.status !== 'PAID' && (
                              <Button size="sm" variant="secondary" leftIcon={<Banknote size={14} />} onClick={() => openPaymentModal(invoice)}>Pay</Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Create/Edit Supplier side panel — wide enough for identity fields + item picker in one continuous flow, matching the pattern Item Catalog's edit panel already established. */}
      {isFormOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(28,25,23,0.4)]" onClick={() => setIsFormOpen(false)}>
          <div
            className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl animate-fade-up motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <h2 className="text-heading-md font-semibold text-stone-900">{editingSupplier ? `Edit ${editingSupplier.name}` : 'Add Supplier'}</h2>
              <IconButton icon={<X size={18} />} label="Close" variant="ghost" size="sm" onClick={() => setIsFormOpen(false)} />
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                <FormField label="Name" htmlFor="supplier-name" required errorMessage={errors.name}>
                  <Input id="supplier-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </FormField>
                <FormField label="Contact Name" htmlFor="supplier-contact">
                  <Input id="supplier-contact" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
                </FormField>
                <FormField label="Phone" htmlFor="supplier-phone">
                  <Input id="supplier-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </FormField>
                <FormField label="Email" htmlFor="supplier-email" errorMessage={errors.email}>
                  <Input id="supplier-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </FormField>
              </div>

              <div className="border-t border-stone-100 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-label-lg font-semibold text-stone-900">Items Supplied</h3>
                  <p className="text-label-sm text-stone-400">
                    {Array.from(itemDraft.values()).filter((e) => e.checked).length} selected
                  </p>
                </div>
                <div className="relative mb-3">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <Input
                    value={itemDraftSearch}
                    onChange={(e) => setItemDraftSearch(e.target.value)}
                    placeholder="Search items…"
                    className="pl-9"
                  />
                </div>
                <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-200">
                  {catalogItems
                    .filter((item) => !itemDraftSearch.trim() || item.name.toLowerCase().includes(itemDraftSearch.trim().toLowerCase()))
                    .map((item) => {
                      const entry = itemDraft.get(item.id);
                      const checked = entry?.checked ?? false;
                      const currentDefault = defaultSupplierByItemId.get(item.id);
                      const conflictsWithAnother =
                        checked && entry?.isDefault && currentDefault && currentDefault.supplierId !== editingSupplier?.id;
                      return (
                        <li key={item.id} className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDraftItem(item)}
                              className="h-4 w-4 shrink-0 rounded border-stone-300 text-espresso focus:ring-espresso"
                              aria-label={`Include ${item.name}`}
                            />
                            <span className="min-w-0 flex-1 truncate text-body-sm text-stone-800">{item.name}</span>
                            {checked && (
                              <>
                                <div className="w-28 shrink-0">
                                  <Input
                                    value={entry?.price ?? ''}
                                    onChange={(e) => setDraftItemPrice(item.id, e.target.value)}
                                    placeholder="Price"
                                    inputMode="decimal"
                                    className="h-8 text-label-sm"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDraftItemDefault(item.id, !entry?.isDefault)}
                                  className="shrink-0 p-1"
                                  aria-label={entry?.isDefault ? 'Unset as default supplier' : 'Set as default supplier'}
                                  title={entry?.isDefault ? 'Default supplier for this item' : 'Set as default supplier'}
                                >
                                  <Star size={15} className={entry?.isDefault ? 'fill-amber text-amber' : 'text-stone-300'} />
                                </button>
                              </>
                            )}
                          </div>
                          {conflictsWithAnother && (
                            <p className="mt-1.5 pl-6 text-label-sm text-warning">
                              Currently defaulted to {currentDefault.supplierName} — saving will switch it to this supplier.
                            </p>
                          )}
                        </li>
                      );
                    })}
                </ul>
                <p className="mt-2 text-label-sm text-stone-400">
                  Check an item to supply it — the price pre-fills from its current cost, edit it if this supplier
                  charges differently. The star marks the default supplier used to pre-fill new purchase orders.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-stone-100 px-6 py-4">
              <Button variant="secondary" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveSupplier} isLoading={isSaving}>{editingSupplier ? 'Save Changes' : 'Add Supplier'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Record invoice modal */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title="Record Supplier Invoice"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsInvoiceModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveInvoice} isLoading={isSavingInvoice}>Record Invoice</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Reference Number" htmlFor="invoice-ref" required>
            <Input id="invoice-ref" value={invoiceForm.referenceNumber} onChange={(e) => setInvoiceForm((f) => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g. INV-2026-0148" />
          </FormField>
          <FormField label="Amount (Ksh)" htmlFor="invoice-amount" required>
            <Input id="invoice-amount" inputMode="decimal" value={invoiceForm.amount} onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))} />
          </FormField>
          <FormField label="Invoice Date" htmlFor="invoice-date" required>
            <Input id="invoice-date" type="date" value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceDate: e.target.value }))} />
          </FormField>
        </div>
      </Modal>

      {/* Record payment modal */}
      <Modal
        isOpen={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        title={`Record Payment — ${paymentTarget?.referenceNumber ?? ''}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPaymentTarget(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} isLoading={isSavingPayment}>Record Payment</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {paymentTarget && (
            <p className="text-body-sm text-stone-600">
              Outstanding: <span className="font-semibold text-stone-900">{formatKes(parseFloat(paymentTarget.amount) - parseFloat(paymentTarget.amountPaid))}</span>
            </p>
          )}
          <FormField label="Amount (Ksh)" htmlFor="payment-amount" required>
            <Input id="payment-amount" inputMode="decimal" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} />
          </FormField>
          <FormField label="Method" htmlFor="payment-method" required>
            <Select id="payment-method" options={PAYMENT_METHODS} value={paymentForm.method} onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as SupplierPaymentMethod }))} />
          </FormField>
          <FormField label="Payment Date" htmlFor="payment-date" required>
            <Input id="payment-date" type="date" value={paymentForm.paidAt} onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))} />
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateSupplier}
        title="Deactivate supplier?"
        description={`${deactivateTarget?.name ?? 'This supplier'} will no longer appear in active supplier lists. Historical records are kept.`}
        confirmLabel="Deactivate"
        isLoading={isDeactivating}
      />
    </PageLayout>
  );
}

// ─── Manager mobile ─────────────────────────────────────────────────────────
// §8.1 row 3/4 mobile: "List → tap supplier → detail screen, price history
// as a simple sparkline + list (not a full chart)... AP shown as a compact
// status chip per invoice, not a separate chart." AP is Manager-only
// (§8.3) — Attendant never reaches this component at all (dispatched to
// SuppliersPageInner's shared body instead), so no role check is needed
// inside once we're here.
function SuppliersMobile(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<SupplierWithItemCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<SupplierWithItemCount | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('items');

  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [sparklineByItemId, setSparklineByItemId] = useState<Map<string, number[]>>(new Map());
  const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState<SupplierInvoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'MPESA' as SupplierPaymentMethod, paidAt: '' });
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SupplierFormState>(emptySupplierForm);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listSuppliers(accessToken, true);
      setSuppliers(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load suppliers', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadInvoices = useCallback(
    async (supplierId: string) => {
      if (!accessToken) return;
      setIsLoadingInvoices(true);
      try {
        const result = await listSupplierInvoices(accessToken, { supplierId });
        setInvoices(result);
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load invoices', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoadingInvoices(false);
      }
    },
    [accessToken, toast],
  );

  const loadSupplierItems = useCallback(
    async (supplierId: string) => {
      if (!accessToken) return;
      setIsLoadingItems(true);
      try {
        const result = await getSupplierItems(supplierId, accessToken);
        setSupplierItems(result);
        const sparklines = await Promise.all(
          result.map(async (si) => {
            const lines = await getPriceHistoryReport(si.inventoryItemId, accessToken, supplierId).catch(() => []);
            const prices = lines
              .slice()
              .reverse()
              .map((l) => parseFloat(l.invoicePrice ?? l.unitPrice))
              .filter((p) => Number.isFinite(p));
            return [si.inventoryItemId, prices] as const;
          }),
        );
        setSparklineByItemId(new Map(sparklines));
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load supplier items', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoadingItems(false);
      }
    },
    [accessToken, toast],
  );

  const openSupplier = async (supplier: SupplierWithItemCount) => {
    setSelected(supplier);
    setDetailTab('items');
    void loadSupplierItems(supplier.id);
    void loadInvoices(supplier.id);
  };

  const handleSetDefault = async (si: SupplierItem) => {
    if (!accessToken || !selected || si.isDefault) return;
    setIsSettingDefault(si.inventoryItemId);
    try {
      await assignSupplierItem(
        selected.id,
        { inventoryItemId: si.inventoryItemId, isDefault: true, lastPrice: si.lastPrice ?? undefined },
        accessToken,
      );
      toast({ variant: 'success', title: 'Default supplier set', message: `${selected.name} is now the default for ${si.inventoryItem?.name ?? 'this item'}.` });
      void loadSupplierItems(selected.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to set default supplier', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSettingDefault(null);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [suppliers, search]);

  const openCreateSheet = () => {
    setCreateForm(emptySupplierForm);
    setCreateError(undefined);
    setIsCreateOpen(true);
  };

  const handleCreateSupplier = async () => {
    if (!accessToken) return;
    if (!createForm.name.trim()) {
      setCreateError('Name is required');
      return;
    }
    setIsSavingSupplier(true);
    try {
      await createSupplier(
        {
          name: createForm.name.trim(),
          contactName: createForm.contactName.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
          email: createForm.email.trim() || undefined,
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Supplier added', message: `${createForm.name.trim()} was added.` });
      setIsCreateOpen(false);
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to save supplier', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const openPaymentModal = (invoice: SupplierInvoice) => {
    setPaymentForm({ amount: '', method: 'MPESA', paidAt: new Date().toISOString().slice(0, 10) });
    setPaymentTarget(invoice);
  };

  const handleRecordPayment = async () => {
    if (!accessToken || !paymentTarget || !selected) return;
    if (!paymentForm.amount || !paymentForm.paidAt) {
      toast({ variant: 'error', title: 'Missing details', message: 'Amount and payment date are required.' });
      return;
    }
    setIsSavingPayment(true);
    try {
      await recordSupplierPayment(
        paymentTarget.id,
        { amount: paymentForm.amount, method: paymentForm.method, paidAt: new Date(paymentForm.paidAt).toISOString() },
        accessToken,
      );
      toast({ variant: 'success', title: 'Payment recorded', message: `Payment of ${formatKes(paymentForm.amount)} was recorded.` });
      setPaymentTarget(null);
      void loadInvoices(selected.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to record payment', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const outstandingForSupplier = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) - parseFloat(inv.amountPaid)), 0);

  if (selected) {
    return (
      <div className="min-h-full bg-crema pb-8">
        <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
          <button type="button" onClick={() => setSelected(null)} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
            <ArrowLeft size={16} /> Suppliers
          </button>
          <p className="font-display text-heading-md font-medium">{selected.name}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-label-sm text-crema/70">
            {selected.contactName && <span className="inline-flex items-center gap-1"><User size={12} /> {selected.contactName}</span>}
            {selected.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {selected.phone}</span>}
          </div>
        </div>

        <TabBar
          tabs={[
            { value: 'items', label: 'Items & Pricing' },
            { value: 'ap', label: 'Accounts Payable' },
          ]}
          active={detailTab}
          onChange={setDetailTab}
          className="px-4 pt-3"
        />

        {detailTab === 'items' ? (
          <div className="px-4 py-4">
            {isLoadingItems ? (
              <div className="h-32 animate-pulse rounded-md bg-stone-100" />
            ) : supplierItems.length === 0 ? (
              <p className="py-6 text-center text-body-sm text-stone-500">No items assigned to this supplier yet.</p>
            ) : (
              <div className="space-y-1.5">
                {supplierItems.map((si) => (
                  <div key={si.id} className="flex w-full items-center gap-3 rounded-md border border-stone-200 bg-white p-2.5">
                    <p className="min-w-0 flex-1 truncate text-body-sm font-medium text-stone-900">
                      {si.inventoryItem?.name ?? si.inventoryItemId}
                    </p>
                    <Sparkline values={sparklineByItemId.get(si.inventoryItemId) ?? []} />
                    <p className="w-20 shrink-0 text-right text-body-sm font-semibold tabular-nums text-stone-900">
                      {si.lastPrice ? formatKes(si.lastPrice) : <span className="font-normal text-stone-300">—</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => (si.isDefault || isSettingDefault ? undefined : void handleSetDefault(si))}
                      disabled={si.isDefault || isSettingDefault === si.inventoryItemId}
                      aria-label={si.isDefault ? 'Default supplier for this item' : 'Set as default supplier'}
                      className="shrink-0 p-1"
                    >
                      <Star size={15} className={si.isDefault ? 'fill-amber text-amber' : 'text-stone-300'} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 px-4 py-4">
            <Card className="p-3.5">
              <p className="text-label-sm text-stone-500">Outstanding</p>
              <p className="text-heading-md font-bold tabular-nums text-stone-900">{formatKes(outstandingForSupplier)}</p>
            </Card>
            {isLoadingInvoices ? (
              <div className="h-32 animate-pulse rounded-md bg-stone-100" />
            ) : invoices.length === 0 ? (
              <p className="py-6 text-center text-body-sm text-stone-500">No invoices recorded for this supplier yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => {
                  const outstanding = parseFloat(invoice.amount) - parseFloat(invoice.amountPaid);
                  return (
                    <Card key={invoice.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-body-sm font-semibold text-stone-900">{invoice.referenceNumber}</p>
                          <p className="text-label-sm text-stone-400">{new Date(invoice.invoiceDate).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</p>
                        </div>
                        {/* Compact AP status chip, not a separate chart — §8.1 row 4 mobile */}
                        <Badge tone={invoiceStatusTone[invoice.status]}>{invoice.status.replace('_', ' ')}</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <p className="text-body-md font-bold tabular-nums text-stone-900">{formatKes(invoice.amount)}</p>
                          {outstanding > 0 && <p className="text-label-sm tabular-nums text-danger">{formatKes(outstanding)} due</p>}
                        </div>
                        {invoice.status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(invoice)}
                            className="flex h-9 items-center gap-1.5 rounded-md bg-amber px-3 text-label-md font-semibold text-espresso"
                          >
                            <Banknote size={14} /> Pay
                          </button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Record payment sheet */}
        {paymentTarget && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setPaymentTarget(null)}>
            <div className="rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-heading-sm font-semibold text-stone-900">Record Payment — {paymentTarget.referenceNumber}</p>
              <p className="mt-1 text-body-sm text-stone-600">
                Outstanding: <span className="font-semibold text-stone-900">{formatKes(parseFloat(paymentTarget.amount) - parseFloat(paymentTarget.amountPaid))}</span>
              </p>
              <div className="mt-4 space-y-3">
                <FormField label="Amount (Ksh)" htmlFor="m-payment-amount" required>
                  <Input id="m-payment-amount" inputMode="decimal" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} />
                </FormField>
                <FormField label="Method" htmlFor="m-payment-method" required>
                  <Select id="m-payment-method" options={PAYMENT_METHODS} value={paymentForm.method} onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as SupplierPaymentMethod }))} />
                </FormField>
                <FormField label="Payment Date" htmlFor="m-payment-date" required>
                  <Input id="m-payment-date" type="date" value={paymentForm.paidAt} onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))} />
                </FormField>
              </div>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setPaymentTarget(null)} className="h-12 flex-1 rounded-md border border-stone-200 text-label-lg font-semibold text-stone-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleRecordPayment()}
                  disabled={isSavingPayment}
                  className="h-12 flex-1 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
                >
                  {isSavingPayment ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-full bg-crema">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <p className="font-display text-heading-lg font-medium">Suppliers</p>
        <p className="text-label-md text-crema/70">{suppliers.length} active suppliers</p>
      </div>

      <div className="px-4 py-4">
        <div className="relative mb-4">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="h-11 w-full rounded-md border border-stone-200 bg-white pl-9 pr-3 text-body-md text-stone-900 placeholder:text-stone-400 focus:border-espresso focus:outline-none"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <EmptyState icon={<Search size={40} />} heading="No suppliers yet" body="Suppliers you add will appear here." />
        ) : (
          <div className="space-y-3">
            {filteredSuppliers.map((supplier) => (
              <Card key={supplier.id} onClick={() => void openSupplier(supplier)} className="flex items-center gap-3 p-3">
                <IconTile icon={User} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-semibold text-stone-900">{supplier.name}</p>
                  <p className="truncate text-label-sm text-stone-500">{supplier._count.supplierItems} item{supplier._count.supplierItems === 1 ? '' : 's'}</p>
                </div>
                <span className="shrink-0 text-stone-400">›</span>
              </Card>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openCreateSheet}
        className="fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-amber px-5 text-label-lg font-semibold text-espresso shadow-lg"
      >
        <Plus size={20} />
        Add Supplier
      </button>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setIsCreateOpen(false)}>
          <div className="rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-heading-sm font-semibold text-stone-900">Add Supplier</p>
            <div className="mt-4 space-y-3">
              <FormField label="Name" htmlFor="m-supplier-name" required errorMessage={createError}>
                <Input id="m-supplier-name" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
              </FormField>
              <FormField label="Contact Name" htmlFor="m-supplier-contact">
                <Input id="m-supplier-contact" value={createForm.contactName} onChange={(e) => setCreateForm((f) => ({ ...f, contactName: e.target.value }))} />
              </FormField>
              <FormField label="Phone" htmlFor="m-supplier-phone">
                <Input id="m-supplier-phone" value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} />
              </FormField>
              <FormField label="Email" htmlFor="m-supplier-email">
                <Input id="m-supplier-email" type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
              </FormField>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="h-12 flex-1 rounded-md border border-stone-200 text-label-lg font-semibold text-stone-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateSupplier()}
                disabled={isSavingSupplier}
                className="h-12 flex-1 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
              >
                {isSavingSupplier ? 'Saving…' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
