'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, ChefHat, HelpCircle, MessageSquare, Scale, Search, Trash2, Wine } from 'lucide-react';
import { HelpTip, IconTile } from '@/components/ui';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import { createWasteLog, getCentralStoreLocation, listInventoryItems } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { buyUnitLabel, toUsageUnitQuantity } from '@/lib/inventory-format';
import type { InventoryItem, WasteReason } from '@/types/inventory';
import { WasteLogDesktop } from './WasteLogDesktop';

const REASONS: { value: WasteReason; label: string; icon: React.ElementType }[] = [
  { value: 'SPOILED', label: 'Spoiled', icon: AlertCircle },
  { value: 'PREP_ERROR', label: 'Prep Error', icon: ChefHat },
  { value: 'DROPPED', label: 'Dropped', icon: Wine },
  { value: 'EXPIRED', label: 'Expired', icon: Calendar },
  { value: 'OTHER', label: 'Other', icon: HelpCircle },
];

// §8.1 row 12: "Manager can log waste same as Attendant... but reviewing
// the full log is a desktop task" — mobile entry is the shared Attendant
// screen. Bug found in Session 8 verification: this dispatcher previously
// routed STORE_MANAGER unconditionally to WasteLogDesktop, which
// self-guards to null on the mobile shell — leaving Manager's mobile Waste
// screen completely blank. Fixed by checking shell context for Manager
// instead of assuming desktop.
export default function WasteLogEntryPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const isDesktop = useIsDesktopShell();
  if (role === 'STORE_MANAGER' && isDesktop) {
    return <WasteLogDesktop />;
  }
  return <WasteLogEntryAttendant />;
}

function WasteLogEntryAttendant(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [locationId, setLocationId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<WasteReason | null>(null);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      setIsLoading(true);
      try {
        const [location, itemList] = await Promise.all([
          getCentralStoreLocation(accessToken),
          listInventoryItems(accessToken, { isActive: true }),
        ]);
        if (!location) {
          toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
          return;
        }
        setLocationId(location.id);
        setItems(itemList);
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, toast]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [items, search]);

  const recentItems = useMemo(() => items.slice(0, 3), [items]);

  const resetForm = () => {
    setSelectedItem(null);
    setSearch('');
    setQuantity('');
    setReason(null);
    setNote('');
    setShowNote(false);
  };

  const handleLogWaste = async () => {
    if (!accessToken || !locationId || !selectedItem || !reason) return;
    if (!quantity || parseFloat(quantity) <= 0) {
      toast({ variant: 'error', title: 'Enter a quantity', message: 'How much was wasted?' });
      return;
    }
    setIsSaving(true);
    try {
      await createWasteLog(
        {
          locationId,
          inventoryItemId: selectedItem.id,
          quantity: String(toUsageUnitQuantity(quantity, selectedItem)),
          reason,
          note: note.trim() || undefined,
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Waste logged', message: `${selectedItem.name} recorded.` });
      resetForm();
    } catch (error) {
      toast({ variant: 'error', title: 'Could not log waste', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = Boolean(selectedItem && quantity && parseFloat(quantity) > 0 && reason);

  return (
    <div className="min-h-full bg-crema pb-8">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-heading-lg font-medium">Log Waste</p>
            <p className="text-label-md text-crema/70">Central Store</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-crema/10 text-amber">
              <Trash2 size={20} />
            </div>
            <HelpTip
              title="Log Waste"
              triggerClassName="flex h-7 w-7 items-center justify-center rounded-full text-crema/70 transition-colors hover:bg-white/10 hover:text-crema focus-visible:outline-none focus-visible:shadow-focus"
            >
              <p>Record stock that&rsquo;s lost or unusable — spoiled, dropped, expired, a prep mistake — so it&rsquo;s removed from stock and reflected in cost reporting.</p>
              <p className="mt-2">Pick the item, how much, and why. Log it as soon as it happens so stock stays accurate.</p>
            </HelpTip>
          </div>
        </div>
        <p className="mt-2 text-label-md text-crema/60">Record lost or unusable stock immediately.</p>
      </div>

      <div className="px-4 py-4">
        {/* Step 1 — item */}
        <StepHeader n={1} label="Select item" />
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={selectedItem ? selectedItem.name : search}
            onChange={(e) => { setSearch(e.target.value); setSelectedItem(null); }}
            placeholder="Search for an item…"
            className="h-11 w-full rounded-md border border-stone-200 bg-white pl-9 pr-3 text-body-md text-stone-900 placeholder:text-stone-400 focus:border-espresso focus:outline-none"
          />
        </div>

        {!selectedItem && search.trim() && (
          <div className="mb-4 space-y-1.5 rounded-md border border-stone-200 bg-white p-2">
            {isLoading ? (
              <p className="p-2 text-body-sm text-stone-500">Loading…</p>
            ) : filteredItems.length === 0 ? (
              <p className="p-2 text-body-sm text-stone-500">No items found.</p>
            ) : (
              filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setSelectedItem(item); setSearch(''); }}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-stone-100"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-stone-900">{item.name}</p>
                    <p className="text-label-sm text-stone-500">{buyUnitLabel(item)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {!selectedItem && !search.trim() && recentItems.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-label-sm font-medium text-stone-500">Recent items</p>
            <div className="grid grid-cols-3 gap-2">
              {recentItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="rounded-md border border-stone-200 bg-white p-2.5 text-left"
                >
                  <span className="mb-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                    {index + 1}
                  </span>
                  <p className="truncate text-label-md font-semibold text-stone-900">{item.name}</p>
                  <p className="text-label-sm text-stone-500">{buyUnitLabel(item)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — quantity */}
        <StepHeader n={2} label="Quantity wasted" />
        <div className="mb-6 flex items-center gap-3 rounded-md border border-stone-200 bg-white p-3">
          <IconTile icon={Scale} />
          <QuantityInput
            value={quantity}
            onValueChange={setQuantity}
            unit={selectedItem ? buyUnitLabel(selectedItem) : ''}
            className="flex-1"
            inputClassName="text-heading-md"
          />
        </div>

        {/* Step 3 — reason */}
        <StepHeader n={3} label="Reason" />
        <div className="mb-3 grid grid-cols-3 gap-2">
          {REASONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setReason(value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-md border p-3',
                reason === value ? 'border-amber bg-amber-light/50' : 'border-stone-200 bg-white',
              )}
            >
              <Icon size={20} className={reason === value ? 'text-espresso' : 'text-stone-500'} />
              <span className={cn('text-label-md font-medium', reason === value ? 'text-espresso' : 'text-stone-700')}>{label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowNote((s) => !s)}
          className="mb-6 flex w-full items-center gap-2 rounded-md border border-stone-200 bg-white p-3 text-left text-body-sm text-stone-500"
        >
          <MessageSquare size={16} />
          {showNote ? (
            <input
              autoFocus
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Add a note…"
              className="flex-1 bg-transparent text-body-sm text-stone-900 focus:outline-none"
            />
          ) : (
            <span className="flex-1">Add a note (optional)</span>
          )}
        </button>
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={() => void handleLogWaste()}
          disabled={!canSubmit || isSaving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
        >
          <Trash2 size={18} />
          {isSaving ? 'Logging…' : 'Log Waste'}
        </button>
      </div>
    </div>
  );
}

function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-espresso text-label-sm font-bold text-crema">{n}</span>
      <p className="font-display text-heading-sm font-medium text-stone-900">{label}</p>
    </div>
  );
}
