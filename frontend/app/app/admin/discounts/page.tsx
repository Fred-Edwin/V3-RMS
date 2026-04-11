'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Percent, Tag } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Select,
  Toggle,
  type TableColumn,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { discountService } from '@/services/discountService';
import { reportService } from '@/services/reportService';
import { branchService, type BranchDto } from '@/services/branchService';
import { useAuthStore } from '@/store/authStore';
import type { Discount, CreateDiscountInput, UpdateDiscountInput, DiscountType } from '@/types/discount';
import type { DiscountUsageByDiscount } from '@/types/report';
import { ApiError } from '@/types/api';

interface DiscountFormState {
  name: string;
  type: DiscountType;
  value: string;
  requiresApproval: boolean;
  scope: string;
  isActive: boolean;
}

const initialForm: DiscountFormState = {
  name: '',
  type: 'PERCENTAGE',
  value: '',
  requiresApproval: false,
  scope: 'all',
  isActive: true,
};

const toYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatKes = (value: string): string => {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n) || n === 0) return '—';
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

type DiscountRow = Discount & { usage?: DiscountUsageByDiscount };

export default function DiscountsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [usageMap, setUsageMap] = useState<Map<string, DiscountUsageByDiscount>>(new Map());
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [form, setForm] = useState<DiscountFormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const today = toYmd(new Date());
      const thirtyDaysAgo = toYmd(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      const [discountData, branchData, usageData] = await Promise.all([
        discountService.list(accessToken),
        branchService.listBranches(accessToken),
        reportService.getDiscountUsage(accessToken, { startDate: thirtyDaysAgo, endDate: today }),
      ]);

      setDiscounts(discountData);
      setBranches(branchData);
      setUsageMap(new Map(usageData.byDiscount.map((u) => [u.discountId, u])));
    } catch (error) {
      toast({ title: 'Failed to load discounts', variant: 'error' });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setModalMode('create');
    setEditingDiscount(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEdit = (discount: Discount) => {
    setModalMode('edit');
    setEditingDiscount(discount);
    setForm({
      name: discount.name,
      type: discount.type,
      value: discount.value,
      requiresApproval: discount.requiresApproval,
      scope: discount.organizationId ?? 'all',
      isActive: discount.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!accessToken) return;
    if (!form.name.trim() || !form.value) {
      toast({ title: 'Name and value are required', variant: 'error' });
      return;
    }
    const value = Number.parseFloat(form.value);
    if (Number.isNaN(value) || value <= 0) {
      toast({ title: 'Value must be a positive number', variant: 'error' });
      return;
    }
    if (form.type === 'PERCENTAGE' && value > 100) {
      toast({ title: 'Percentage discount cannot exceed 100%', variant: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const scopeOrgId = form.scope === 'all' ? null : form.scope;

      if (modalMode === 'create') {
        const input: CreateDiscountInput = {
          organizationId: scopeOrgId,
          name: form.name.trim(),
          type: form.type,
          value,
          requiresApproval: form.requiresApproval,
        };
        const created = await discountService.create(input, accessToken);
        setDiscounts((prev) => [created, ...prev]);
        toast({ title: `Discount "${created.name}" created`, variant: 'success' });
      } else if (editingDiscount) {
        const input: UpdateDiscountInput = {
          organizationId: scopeOrgId,
          name: form.name.trim(),
          type: form.type,
          value,
          requiresApproval: form.requiresApproval,
          isActive: form.isActive,
        };
        const updated = await discountService.update(editingDiscount.id, input, accessToken);
        setDiscounts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        toast({ title: `Discount "${updated.name}" updated`, variant: 'success' });
      }
      setModalOpen(false);
      setForm(initialForm);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Something went wrong';
      toast({ title: message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (): Promise<void> => {
    if (!accessToken || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await discountService.deactivate(deleteTarget.id, accessToken);
      setDiscounts((prev) =>
        prev.map((d) => (d.id === deleteTarget.id ? { ...d, isActive: false } : d)),
      );
      toast({ title: `Discount "${deleteTarget.name}" deactivated`, variant: 'success' });
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Something went wrong';
      toast({ title: message, variant: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const rows: DiscountRow[] = useMemo(
    () => discounts.map((d) => ({ ...d, usage: usageMap.get(d.id) })),
    [discounts, usageMap],
  );

  const branchOptions = [
    { value: 'all', label: 'All branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  const columns: TableColumn<DiscountRow>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (_v, row) => (
        <div className="flex items-center gap-2.5">
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
              row.isActive ? 'bg-espresso/10' : 'bg-stone-100'
            }`}
          >
            {row.type === 'PERCENTAGE'
              ? <Percent size={12} className={row.isActive ? 'text-espresso' : 'text-stone-400'} />
              : <Tag size={12} className={row.isActive ? 'text-espresso' : 'text-stone-400'} />}
          </span>
          <span className={`text-body-sm font-medium ${row.isActive ? 'text-stone-900' : 'text-stone-400'}`}>
            {row.name}
          </span>
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      render: (_v, row) => (
        <span className="text-body-sm tabular-nums text-stone-700">
          {row.type === 'PERCENTAGE' ? `${row.value}%` : `KES ${Number.parseFloat(row.value).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`}
        </span>
      ),
    },
    {
      key: 'requiresApproval',
      label: 'Approval',
      render: (_v, row) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-label-sm ${
            row.requiresApproval
              ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D]'
              : 'bg-[#F4F4F5] text-[#71717A] border border-[#D4D4D8]'
          }`}
        >
          {row.requiresApproval ? 'Needs approval' : 'Auto-apply'}
        </span>
      ),
    },
    {
      key: 'scope',
      label: 'Scope',
      render: (_v, row) => (
        <span className="text-body-sm text-stone-500">
          {row.organizationId ? 'This branch' : 'All branches'}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (_v, row) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-label-sm ${
            row.isActive
              ? 'bg-[#EDFAF1] text-[#1A6B3C] border border-[#86EFAC]'
              : 'bg-[#F4F4F5] text-[#71717A] border border-[#D4D4D8]'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'uses',
      label: 'Uses (30d)',
      render: (_v, row) => (
        <span className="text-body-sm tabular-nums text-stone-700">
          {row.usage?.orderCount ?? 0}
        </span>
      ),
    },
    {
      key: 'discounted',
      label: 'Discounted (30d)',
      render: (_v, row) => (
        <span className={`text-body-sm tabular-nums font-medium ${(row.usage?.orderCount ?? 0) > 0 ? 'text-espresso' : 'text-stone-400'}`}>
          {row.usage ? formatKes(row.usage.totalDiscounted) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_v, row) => (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          {row.isActive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTarget(row)}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageLayout>
      <PageHeader
        title="Discounts"
        subtitle="Configure customer-facing discount types. Usage figures reflect the last 30 days."
        action={
          <Button onClick={openCreate} size="sm">
            New Discount
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Tag size={32} className="text-stone-400" />}
          heading="No discounts yet"
          body="Create a discount type for your team to apply at checkout"
        />
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-label-sm font-semibold uppercase tracking-wider text-stone-500 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-stone-50 ${!row.isActive ? 'opacity-60' : ''}`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3.5 whitespace-nowrap">
                        {col.render ? col.render(row[col.key as keyof DiscountRow] as never, row) : String(row[col.key as keyof DiscountRow] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'create' ? 'New Discount' : 'Edit Discount'}
        maxWidth="md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting}>
              {modalMode === 'create' ? 'Create Discount' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" htmlFor="discount-name">
            <Input
              id="discount-name"
              placeholder="e.g. Happy Hour, Senior Citizen"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>

          <FormField label="Discount type" htmlFor="discount-type">
            <Select
              id="discount-type"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as DiscountType }))
              }
              options={[
                { value: 'PERCENTAGE', label: 'Percentage (%)' },
                { value: 'FIXED_AMOUNT', label: 'Fixed Amount (KES)' },
              ]}
            />
          </FormField>

          <FormField
            label={form.type === 'PERCENTAGE' ? 'Percentage (0–100)' : 'Amount (KES)'}
            htmlFor="discount-value"
          >
            <Input
              id="discount-value"
              type="number"
              min="0"
              max={form.type === 'PERCENTAGE' ? '100' : undefined}
              step="0.01"
              placeholder={form.type === 'PERCENTAGE' ? '10' : '100'}
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </FormField>

          <FormField label="Apply to" htmlFor="discount-scope">
            <Select
              id="discount-scope"
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
              options={branchOptions}
            />
          </FormField>

          <div className="flex items-center justify-between rounded-md border border-stone-200 p-3">
            <div>
              <p className="text-label-sm font-medium text-stone-700">Requires manager approval</p>
              <p className="text-caption text-stone-500">
                If off, the discount applies instantly at checkout
              </p>
            </div>
            <Toggle
              checked={form.requiresApproval}
              onChange={(checked) => setForm((f) => ({ ...f, requiresApproval: checked }))}
            />
          </div>

          {modalMode === 'edit' && (
            <div className="flex items-center justify-between rounded-md border border-stone-200 p-3">
              <div>
                <p className="text-label-sm font-medium text-stone-700">Active</p>
                <p className="text-caption text-stone-500">
                  Inactive discounts are hidden from waiters
                </p>
              </div>
              <Toggle
                checked={form.isActive}
                onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Deactivate confirm */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen
          title="Deactivate discount"
          description={`"${deleteTarget.name}" will be hidden from waiters immediately. Existing orders are not affected.`}
          confirmLabel="Deactivate"
          isLoading={isDeleting}
          onConfirm={handleDeactivate}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </PageLayout>
  );
}
