'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ChevronRight, FlaskConical, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Select,
  SkeletonTable,
} from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { menuService } from '@/services/menuService';
import { useAuthStore } from '@/store/authStore';
import type { RawIngredient, IngredientConversion } from '@/types/inventory';
import type { MenuManagementItem } from '@/types/menu';

export default function IngredientConversionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);

  const [ingredient, setIngredient] = useState<RawIngredient | null>(null);
  const [conversions, setConversions] = useState<IngredientConversion[]>([]);
  const [menuItems, setMenuItems] = useState<MenuManagementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ menuItemId: '', quantityPerPortion: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [ingredients, convs, categories] = await Promise.all([
        inventoryService.getIngredients(token),
        inventoryService.getIngredientConversions(id, token),
        menuService.getCategories(token),
      ]);
      const found = ingredients.find((i) => i.id === id) ?? null;
      setIngredient(found);
      setConversions(convs);
      setMenuItems(categories.flatMap((c) => c.items.filter((i) => i.isActive)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load conversion data.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setForm({ menuItemId: '', quantityPerPortion: '' });
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!token) return;
    const qty = Number(form.quantityPerPortion);
    if (!form.menuItemId || Number.isNaN(qty) || qty <= 0) {
      setSaveError('Select a menu item and enter a valid quantity.');
      return;
    }
    setIsSaving(true);
    try {
      const created = await inventoryService.createIngredientConversion(
        id,
        { menuItemId: form.menuItemId, quantityPerPortion: qty },
        token,
      );
      setConversions((prev) => [...prev, created]);
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save conversion.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Menu items not yet mapped to this ingredient
  const availableMenuItems = menuItems.filter(
    (m) => !conversions.some((c) => c.menuItemId === m.id),
  );

  const menuItemOptions = availableMenuItems.map((m) => ({ value: m.id, label: m.name }));

  return (
    <PageLayout>
      <div className="mb-2">
        <button
          onClick={() => router.push('/app/store/ingredients')}
          className="inline-flex items-center gap-1 text-body-sm text-stone-500 transition-colors hover:text-stone-800"
        >
          <ArrowLeft size={14} />
          Back to Ingredients
        </button>
      </div>

      <PageHeader
        title={ingredient ? `${ingredient.name} — Conversion Ratios` : 'Conversion Ratios'}
        subtitle={
          ingredient
            ? `Define how much ${ingredient.name} (${ingredient.unit}) each menu item consumes per portion`
            : 'Loading…'
        }
        action={
          <Button onClick={openAdd} disabled={availableMenuItems.length === 0 || isLoading}>
            <Plus size={16} className="mr-1" />
            Add Conversion
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle size={40} className="text-stone-400" />}
          heading="Error"
          body={error}
          action={<Button onClick={() => void load()}>Retry</Button>}
        />
      ) : (
        <div className="space-y-6">
          {/* Ingredient summary card */}
          {ingredient && (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-stone-200 bg-parchment p-4 shadow-sm">
                <p className="text-label-sm font-medium text-stone-500">In Stock (CK)</p>
                <p className="mt-1 font-display text-2xl text-stone-900">
                  {ingredient.currentStockCk}
                  <span className="ml-1 text-base font-normal text-stone-500">{ingredient.unit}</span>
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-parchment p-4 shadow-sm">
                <p className="text-label-sm font-medium text-stone-500">Reorder Threshold</p>
                <p className="mt-1 font-display text-2xl text-stone-900">
                  {ingredient.reorderThreshold}
                  <span className="ml-1 text-base font-normal text-stone-500">{ingredient.unit}</span>
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-parchment p-4 shadow-sm">
                <p className="text-label-sm font-medium text-stone-500">Menu Items Mapped</p>
                <p className="mt-1 font-display text-2xl text-stone-900">{conversions.length}</p>
              </div>
            </div>
          )}

          {/* Conversions table */}
          <Card className="bg-parchment shadow-md">
            <CardHeader>
              <h2 className="font-display text-xl text-stone-900">Conversion Ratios</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">
                Each ratio tells the system how much {ingredient?.unit ?? 'stock'} to deduct when a prep ticket is marked ready.
              </p>
            </CardHeader>
            <CardBody>
              {conversions.length === 0 ? (
                <EmptyState
                  icon={<FlaskConical size={40} className="text-stone-400" />}
                  heading="No conversions yet"
                  body={`Add a ratio to link ${ingredient?.name ?? 'this ingredient'} to a menu item.`}
                  action={
                    <Button onClick={openAdd} disabled={availableMenuItems.length === 0}>
                      <Plus size={16} className="mr-1" />
                      Add First Conversion
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left">
                        <th className="pb-3 pr-4 text-label-sm font-medium text-stone-500">Menu Item</th>
                        <th className="pb-3 pr-4 text-label-sm font-medium text-stone-500">
                          Usage per Portion
                        </th>
                        <th className="pb-3 text-label-sm font-medium text-stone-500">
                          Can Fulfil from Current Stock
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((conv) => {
                        const portionsAvailable = ingredient
                          ? Math.floor(Number(ingredient.currentStockCk) / Number(conv.quantityPerPortion))
                          : 0;
                        const isLow = portionsAvailable < 10;
                        return (
                          <tr key={conv.id} className="border-b border-stone-100 last:border-0">
                            <td className="py-3 pr-4">
                              <span className="font-medium text-stone-900">
                                {conv.menuItem?.name ?? conv.menuItemId}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-stone-700">
                              <span className="font-semibold">{conv.quantityPerPortion}</span>
                              <span className="ml-1 text-stone-500">{ingredient?.unit ?? ''} / portion</span>
                            </td>
                            <td className="py-3">
                              <span className={`font-semibold ${isLow ? 'text-amber-700' : 'text-green-700'}`}>
                                {portionsAvailable} portions
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Unmapped menu items hint */}
          {availableMenuItems.length > 0 && (
            <p className="text-body-sm text-stone-400">
              {availableMenuItems.length} menu item{availableMenuItems.length !== 1 ? 's' : ''} not yet mapped to this ingredient.
            </p>
          )}
        </div>
      )}

      {/* Add Conversion Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Conversion Ratio"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-body-sm text-amber-800">
              Enter the exact amount of <strong>{ingredient?.name}</strong> consumed when one portion of the selected menu item is prepared.
            </p>
          </div>

          <FormField label="Menu Item" htmlFor="conv-menu-item" required>
            <Select
              id="conv-menu-item"
              options={[{ value: '', label: 'Select a menu item…' }, ...menuItemOptions]}
              value={form.menuItemId}
              onChange={(e) => setForm((f) => ({ ...f, menuItemId: e.target.value }))}
            />
          </FormField>

          <FormField
            label={`Quantity per Portion (${ingredient?.unit ?? 'unit'})`}
            htmlFor="conv-qty"
            required
          >
            <div className="flex items-center gap-2">
              <Input
                id="conv-qty"
                type="number"
                min="0"
                step="0.001"
                value={form.quantityPerPortion}
                onChange={(e) => setForm((f) => ({ ...f, quantityPerPortion: e.target.value }))}
                placeholder="e.g. 0.018"
                className="flex-1"
              />
              <span className="shrink-0 text-body-sm text-stone-500">{ingredient?.unit ?? 'unit'}</span>
            </div>
          </FormField>

          {form.menuItemId && form.quantityPerPortion && Number(form.quantityPerPortion) > 0 && ingredient && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-body-sm text-stone-600">
                At current stock (<strong>{ingredient.currentStockCk} {ingredient.unit}</strong>), the CK can fulfil{' '}
                <strong>
                  {Math.floor(Number(ingredient.currentStockCk) / Number(form.quantityPerPortion))} portions
                </strong>{' '}
                of {menuItems.find((m) => m.id === form.menuItemId)?.name ?? '—'}.
              </p>
            </div>
          )}

          {saveError && <p className="text-body-sm text-red-600">{saveError}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving} isLoading={isSaving}>
              Save Conversion
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
