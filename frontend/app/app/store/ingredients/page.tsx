'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, Package, Plus } from 'lucide-react';
import {
  Badge,
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
  SkeletonTable,
} from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { RawIngredient } from '@/types/inventory';

export default function IngredientsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [ingredients, setIngredients] = useState<RawIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RawIngredient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', unit: '', reorderThreshold: '' });

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getIngredients(token);
      setIngredients(data);
    } catch {
      setError('Failed to load ingredients.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', unit: '', reorderThreshold: '' });
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (ing: RawIngredient) => {
    setEditTarget(ing);
    setForm({ name: ing.name, unit: ing.unit, reorderThreshold: String(ing.reorderThreshold) });
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!token) return;
    const threshold = Number(form.reorderThreshold);
    if (!form.name.trim() || !form.unit.trim() || Number.isNaN(threshold) || threshold < 0) return;
    setIsSaving(true);
    try {
      if (editTarget) {
        const updated = await inventoryService.updateIngredient(
          editTarget.id,
          { name: form.name.trim(), unit: form.unit.trim(), reorderThreshold: threshold },
          token,
        );
        setIngredients((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await inventoryService.createIngredient(
          { name: form.name.trim(), unit: form.unit.trim(), reorderThreshold: threshold },
          token,
        );
        setIngredients((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save ingredient.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Ingredients"
        subtitle="Manage CK raw ingredient stock levels and reorder thresholds"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1" />
            Add Ingredient
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void load()}>Retry</Button>} />
      ) : (
        <Card className="bg-parchment shadow-md">
          <CardBody>
            {ingredients.length === 0 ? (
              <EmptyState icon={<Package size={40} className="text-stone-400" />} heading="No ingredients yet" body="Add your first ingredient to get started." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Name</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Unit</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">In Stock (CK)</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Reorder At</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Status</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Conversions</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ing) => {
                      const isLow = ing.currentStockCk <= ing.reorderThreshold;
                      return (
                        <tr key={ing.id} className="border-b border-stone-100 last:border-0">
                          <td className="py-2 pr-4 font-medium text-stone-900">{ing.name}</td>
                          <td className="py-2 pr-4 text-stone-600">{ing.unit}</td>
                          <td className={`py-2 pr-4 font-semibold ${isLow ? 'text-amber-700' : 'text-stone-900'}`}>
                            {ing.currentStockCk}
                          </td>
                          <td className="py-2 pr-4 text-stone-500">{ing.reorderThreshold}</td>
                          <td className="py-2 pr-4">
                            {isLow ? (
                              <Badge variant="pending" />
                            ) : (
                              <Badge variant="ready" />
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <Link href={`/app/store/ingredients/${ing.id}/conversions`}>
                              <button className="inline-flex items-center gap-1 text-body-sm text-stone-500 transition-colors hover:text-stone-900">
                                {ing.conversions?.length ?? 0} items
                                <ChevronRight size={13} />
                              </button>
                            </Link>
                          </td>
                          <td className="py-2 text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(ing)}>
                              Edit
                            </Button>
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
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Ingredient' : 'Add Ingredient'}
      >
        <div className="space-y-4">
          <FormField label="Name" htmlFor="ingredient-name" required>
            <Input
              id="ingredient-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Coffee Beans"
            />
          </FormField>
          <FormField label="Unit" htmlFor="ingredient-unit" required>
            <Input
              id="ingredient-unit"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder="e.g. kg"
            />
          </FormField>
          <FormField label="Reorder Threshold" htmlFor="ingredient-reorder-threshold" required>
            <Input
              id="ingredient-reorder-threshold"
              type="number"
              min="0"
              value={form.reorderThreshold}
              onChange={(e) => setForm((f) => ({ ...f, reorderThreshold: e.target.value }))}
              placeholder="e.g. 10"
            />
          </FormField>
          {saveError && <p className="text-body-sm text-red-600">{saveError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving} isLoading={isSaving}>
              {editTarget ? 'Save Changes' : 'Add Ingredient'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
