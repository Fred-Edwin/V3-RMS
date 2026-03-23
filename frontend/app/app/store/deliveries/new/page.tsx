'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  FormField,
  Input,
  PageHeader,
  PageLayout,
  Select,
  Textarea,
} from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { RawIngredient, Supplier } from '@/types/inventory';

export default function LogDeliveryPage() {
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const [ingredients, setIngredients] = useState<RawIngredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    ingredientId: '',
    supplierId: '',
    quantity: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [ings, sups] = await Promise.all([
        inventoryService.getIngredients(token),
        inventoryService.getSuppliers(token),
      ]);
      setIngredients(ings.filter((i) => i.isActive));
      setSuppliers(sups.filter((s) => s.isActive));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const quantity = Number(form.quantity);
    if (!form.ingredientId || !form.supplierId || Number.isNaN(quantity) || quantity <= 0) return;
    setIsSaving(true);
    try {
      await inventoryService.logDelivery(
        {
          ingredientId: form.ingredientId,
          supplierId: form.supplierId,
          quantity,
          notes: form.notes.trim() || undefined,
        },
        token,
      );
      setSuccess(true);
      setForm({ ingredientId: '', supplierId: '', quantity: '', notes: '' });
    } finally {
      setIsSaving(false);
    }
  };

  const ingredientOptions = ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));

  if (success) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CheckCircle2 size={48} className="text-green-600" />
          <h2 className="font-display text-2xl text-stone-900">Delivery Logged</h2>
          <p className="text-body-sm text-stone-500">Stock has been updated in the Central Kitchen.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setSuccess(false)}>
              Log Another
            </Button>
            <Button onClick={() => router.push('/app/store/dashboard')}>Back to Dashboard</Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Log Delivery" subtitle="Record a supplier delivery to the Central Kitchen" />

      <Card className="bg-parchment shadow-md">
        <CardHeader>
          <h2 className="font-display text-xl text-stone-900">Delivery Details</h2>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <p className="text-body-sm text-stone-500">Loading…</p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              <FormField label="Ingredient" htmlFor="delivery-ingredient" required>
                <Select
                  id="delivery-ingredient"
                  options={ingredientOptions}
                  value={form.ingredientId}
                  onChange={(e) => setForm((f) => ({ ...f, ingredientId: e.target.value }))}
                  placeholder="Select ingredient"
                />
              </FormField>
              <FormField label="Supplier" htmlFor="delivery-supplier" required>
                <Select
                  id="delivery-supplier"
                  options={supplierOptions}
                  value={form.supplierId}
                  onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
                  placeholder="Select supplier"
                />
              </FormField>
              <FormField label="Quantity" htmlFor="delivery-quantity" required>
                <Input
                  id="delivery-quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="e.g. 25"
                />
              </FormField>
              <FormField label="Notes" htmlFor="delivery-notes">
                <Textarea
                  id="delivery-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any delivery notes…"
                  rows={3}
                />
              </FormField>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} isLoading={isSaving}>
                  Confirm Delivery
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </PageLayout>
  );
}
