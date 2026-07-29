'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, ChefHat, HelpCircle, Plus, Search, Wine } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ExcelTable,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Select,
  type ExcelColumn,
  type SelectOption,
} from '@/components/ui';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import {
  createWasteLog,
  getCentralStoreLocation,
  listInventoryItems,
  listWasteLogs,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import type { InventoryItem, WasteLog, WasteReason } from '@/types/inventory';

const REASONS: { value: WasteReason; label: string; icon: React.ElementType }[] = [
  { value: 'SPOILED', label: 'Spoiled', icon: AlertCircle },
  { value: 'PREP_ERROR', label: 'Prep Error', icon: ChefHat },
  { value: 'DROPPED', label: 'Dropped', icon: Wine },
  { value: 'EXPIRED', label: 'Expired', icon: Calendar },
  { value: 'OTHER', label: 'Other', icon: HelpCircle },
];

const REASON_LABEL: Record<WasteReason, string> = {
  SPOILED: 'Spoiled',
  PREP_ERROR: 'Prep Error',
  DROPPED: 'Dropped',
  EXPIRED: 'Expired',
  OTHER: 'Other',
};

const REASON_FILTERS: SelectOption[] = [
  { value: '', label: 'All Reasons' },
  ...REASONS.map((r) => ({ value: r.value, label: r.label })),
];

const formatKes = (value: number): string =>
  `Ksh ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });

interface WasteRow extends Record<string, unknown> {
  log: WasteLog;
}

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER (dual desktop
// sidebar + CSS-hidden mobile shell) — no mobile variant of this screen
// exists yet (Session 8), so the mobile-shell copy renders nothing rather
// than duplicating data-fetching and DOM element ids.
export function WasteLogDesktop(): JSX.Element | null {
  const isDesktop = useIsDesktopShell();
  if (!isDesktop) return null;
  return <WasteLogDesktopInner />;
}

function WasteLogDesktopInner(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState<WasteReason | ''>('');

  const [locationId, setLocationId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<WasteReason | null>(null);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listWasteLogs(accessToken);
      setLogs(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load waste log', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openForm = async () => {
    setSelectedItemId('');
    setQuantity('');
    setReason(null);
    setNote('');
    setIsFormOpen(true);
    if (!accessToken) return;
    try {
      const [location, itemList] = await Promise.all([
        getCentralStoreLocation(accessToken),
        listInventoryItems(accessToken, { isActive: true }),
      ]);
      setLocationId(location?.id ?? null);
      setItems(itemList);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  const handleSave = async () => {
    if (!accessToken || !locationId) return;
    if (!selectedItemId || !quantity || parseFloat(quantity) <= 0 || !reason) {
      toast({ variant: 'error', title: 'Missing details', message: 'Select an item, quantity, and reason.' });
      return;
    }
    setIsSaving(true);
    try {
      await createWasteLog({ locationId, inventoryItemId: selectedItemId, quantity, reason, note: note.trim() || undefined }, accessToken);
      toast({ variant: 'success', title: 'Waste logged', message: 'The entry was recorded.' });
      setIsFormOpen(false);
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to log waste', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const itemOptions: SelectOption[] = useMemo(() => items.map((i) => ({ value: i.id, label: i.name })), [items]);
  const selectedItem = items.find((i) => i.id === selectedItemId);

  const rows = useMemo<WasteRow[]>(() => {
    const q = search.trim().toLowerCase();
    return logs
      .filter((log) => !reasonFilter || log.reason === reasonFilter)
      .filter((log) => !q || log.inventoryItem.name.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
      .map((log) => ({ log }));
  }, [logs, search, reasonFilter]);

  const totalCost = rows.reduce((sum, r) => sum + parseFloat(r.log.quantity) * parseFloat(r.log.inventoryItem.currentCost), 0);

  const columns: ExcelColumn<WasteRow>[] = [
    { key: 'item', label: 'Item', render: (row) => <span className="font-medium text-office-ink">{row.log.inventoryItem.name}</span> },
    { key: 'quantity', label: 'Quantity', numeric: true, render: (row) => `${row.log.quantity} ${row.log.inventoryItem.usageUnit}` },
    { key: 'cost', label: 'Cost', numeric: true, render: (row) => formatKes(parseFloat(row.log.quantity) * parseFloat(row.log.inventoryItem.currentCost)) },
    { key: 'reason', label: 'Reason', render: (row) => <Badge tone="neutral">{REASON_LABEL[row.log.reason]}</Badge> },
    { key: 'note', label: 'Note', render: (row) => row.log.note ?? <span className="text-stone-400">—</span> },
    { key: 'loggedAt', label: 'Logged At', render: (row) => formatDate(row.log.loggedAt) },
  ];

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Waste Log"
        subtitle={`${rows.length} entries · ${formatKes(totalCost)} total cost`}
        action={<Button leftIcon={<Plus size={18} />} onClick={openForm}>Log Waste</Button>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-56">
            <Select options={REASON_FILTERS} value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value as WasteReason | '')} />
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by item…" className="pl-9" />
          </div>
        </div>

        <ExcelTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.log.id}
          isLoading={isLoading}
          headerTone="navy"
          emptyState={<div className="px-4 py-10 text-center text-body-sm text-stone-500">No waste entries yet.</div>}
        />
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Log Waste"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>Log Waste</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Item" htmlFor="waste-item" required>
            <Select id="waste-item" options={itemOptions} placeholder="Select an item…" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} />
          </FormField>
          <FormField label="Quantity" htmlFor="waste-qty" required>
            <QuantityInput id="waste-qty" value={quantity} onValueChange={setQuantity} unit={selectedItem?.usageUnit} />
          </FormField>
          <FormField label="Reason" htmlFor="waste-reason" required>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-label-md font-medium transition-colors ${
                    reason === r.value ? 'border-espresso bg-espresso text-crema' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <r.icon size={14} /> {r.label}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Note" htmlFor="waste-note" helperText="Optional">
            <Input id="waste-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
          </FormField>
        </div>
      </Modal>
    </PageLayout>
  );
}
