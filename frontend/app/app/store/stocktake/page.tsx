'use client';

import { useCallback, useEffect, useState } from 'react';
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
} from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { RawIngredient } from '@/types/inventory';

interface EntryRow {
  ingredientId: string;
  name: string;
  unit: string;
  currentStock: number;
  actualQty: string;
}

const toYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function CKStocktakePage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await inventoryService.getCentralStocktakes(token);
      setRows(
        data.map((ing: RawIngredient) => ({
          ingredientId: ing.id,
          name: ing.name,
          unit: ing.unit,
          currentStock: ing.currentStockCk,
          actualQty: String(ing.currentStockCk),
        })),
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    try {
      await inventoryService.submitCentralStocktake(
        {
          date: toYmd(new Date()),
          entries: rows.map((r) => ({
            ingredientId: r.ingredientId,
            actualQty: Number(r.actualQty),
          })),
        },
        token,
      );
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CheckCircle2 size={48} className="text-green-600" />
          <h2 className="font-display text-2xl text-stone-900">Stocktake Submitted</h2>
          <p className="text-body-sm text-stone-500">Central Kitchen stock has been reconciled for today.</p>
          <Button onClick={() => { setSubmitted(false); void load(); }}>Take Another</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Central Kitchen Stocktake"
        subtitle={`Date: ${toYmd(new Date())}`}
      />

      <Card className="bg-parchment shadow-md">
        <CardHeader>
          <h2 className="font-display text-xl text-stone-900">Ingredient Counts</h2>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <p className="text-body-sm text-stone-500">Loading ingredients…</p>
          ) : rows.length === 0 ? (
            <p className="text-body-sm text-stone-500">No ingredients to count.</p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Ingredient</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Unit</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">System Qty</th>
                      <th className="pb-2 text-label-sm font-medium text-stone-500">Actual Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const actual = Number(row.actualQty);
                      const variance = Number.isNaN(actual) ? null : actual - row.currentStock;
                      return (
                        <tr key={row.ingredientId} className="border-b border-stone-100 last:border-0">
                          <td className="py-2 pr-4 font-medium text-stone-900">{row.name}</td>
                          <td className="py-2 pr-4 text-stone-600">{row.unit}</td>
                          <td className="py-2 pr-4 text-stone-600">{row.currentStock}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-3">
                              <Input
                                type="number"
                                min="0"
                                step="0.001"
                                className="w-28"
                                value={row.actualQty}
                                onChange={(e) =>
                                  setRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, actualQty: e.target.value } : r)),
                                  )
                                }
                              />
                              {variance !== null && variance !== 0 && (
                                <span className={`text-xs font-medium ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {variance > 0 ? '+' : ''}{variance.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting}>
                  Submit Stocktake
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </PageLayout>
  );
}
