'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
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
import type { Supplier } from '@/types/inventory';

export default function SuppliersPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getSuppliers(token);
      setSuppliers(data);
    } catch {
      setError('Failed to load suppliers.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', phone: '', email: '' });
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditTarget(s);
    setForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!token || !form.name.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      };
      if (editTarget) {
        const updated = await inventoryService.updateSupplier(editTarget.id, payload, token);
        setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await inventoryService.createSupplier(payload, token);
        setSuppliers((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch {
      // silent — user can retry
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Suppliers"
        subtitle="Manage your ingredient suppliers"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1" />
            Add Supplier
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : error ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void load()}>Retry</Button>} />
      ) : (
        <Card className="bg-parchment shadow-md">
          <CardBody>
            {suppliers.length === 0 ? (
              <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="No suppliers yet" body="Add your first supplier to begin logging deliveries." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Name</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Phone</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Email</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-2 pr-4 font-medium text-stone-900">{s.name}</td>
                        <td className="py-2 pr-4 text-stone-600">{s.phone ?? '—'}</td>
                        <td className="py-2 pr-4 text-stone-600">{s.email ?? '—'}</td>
                        <td className="py-2 pr-4 text-stone-500">{s.isActive ? 'Active' : 'Inactive'}</td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Supplier' : 'Add Supplier'}>
        <div className="space-y-4">
          <FormField label="Name" htmlFor="supplier-name" required>
            <Input
              id="supplier-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Dormans Coffee"
            />
          </FormField>
          <FormField label="Phone" htmlFor="supplier-phone">
            <Input
              id="supplier-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+254 700 000 000"
            />
          </FormField>
          <FormField label="Email" htmlFor="supplier-email">
            <Input
              id="supplier-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="orders@supplier.co.ke"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving} isLoading={isSaving}>
              {editTarget ? 'Save Changes' : 'Add Supplier'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
