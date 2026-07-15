'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Pencil, ScrollText } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState, Button, Modal, Input, ExcelTable, type ExcelColumn } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { listContractTypes, createContractType, updateContractType } from '@/services/hrService';
import type { ContractType, LeaveType } from '@/types/hr';
import type { AppRole } from '@/types/auth';
import { ApiError } from '@/types/api';

const LEAVE_TYPES: { type: LeaveType; label: string }[] = [
  { type: 'ANNUAL', label: 'Annual' },
  { type: 'SICK', label: 'Sick' },
  { type: 'EMERGENCY', label: 'Emergency' },
  { type: 'UNPAID', label: 'Unpaid' },
];

type PolicyDays = Record<LeaveType, string>;

const emptyPolicyDays: PolicyDays = { ANNUAL: '0', SICK: '0', EMERGENCY: '0', UNPAID: '0' };

interface FormState {
  name: string;
  durationMonths: string;
  isActive: boolean;
  policyDays: PolicyDays;
}

const emptyForm: FormState = { name: '', durationMonths: '', isActive: true, policyDays: emptyPolicyDays };

function policyDaysFrom(ct: ContractType): PolicyDays {
  const days = { ...emptyPolicyDays };
  for (const p of ct.leavePolicies) days[p.leaveType] = String(p.totalDays);
  return days;
}

export default function ContractTypesPage(): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role) as AppRole | null;
  const { toast } = useToast();
  const router = useRouter();

  const isHrAuth = role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';

  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContractType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !isHrAuth) return;
    setLoading(true);
    try {
      setContractTypes(await listContractTypes(accessToken, showInactive));
    } catch {
      toast({ variant: 'error', title: 'Failed to load contract types' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, isHrAuth, showInactive, toast]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (ct: ContractType): void => {
    setEditing(ct);
    setForm({
      name: ct.name,
      durationMonths: ct.durationMonths !== null ? String(ct.durationMonths) : '',
      isActive: ct.isActive,
      policyDays: policyDaysFrom(ct),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!accessToken) return;
    const name = form.name.trim();
    if (!name) {
      toast({ variant: 'error', title: 'Name is required' });
      return;
    }
    const durationMonths = form.durationMonths.trim() === '' ? null : Number(form.durationMonths);
    if (durationMonths !== null && (!Number.isInteger(durationMonths) || durationMonths < 1)) {
      toast({ variant: 'error', title: 'Invalid duration', message: 'Duration must be a whole number of months (or blank for open-ended).' });
      return;
    }
    const leavePolicies = LEAVE_TYPES.map(({ type }) => ({
      leaveType: type,
      totalDays: Number(form.policyDays[type]) || 0,
    }));
    if (leavePolicies.some((p) => p.totalDays < 0 || !Number.isInteger(p.totalDays))) {
      toast({ variant: 'error', title: 'Invalid leave days', message: 'Leave days must be whole numbers ≥ 0.' });
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updateContractType(
          editing.id,
          { name, durationMonths, isActive: form.isActive, leavePolicies },
          accessToken,
        );
        toast({ variant: 'success', title: 'Contract type updated' });
      } else {
        await createContractType({ name, durationMonths, leavePolicies }, accessToken);
        toast({ variant: 'success', title: 'Contract type created' });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Please try again.';
      toast({ variant: 'error', title: editing ? 'Failed to update' : 'Failed to create', message });
    } finally {
      setSubmitting(false);
    }
  };

  const policyDaysCell = (ct: ContractType, type: LeaveType): React.ReactNode => {
    const policy = ct.leavePolicies.find((p) => p.leaveType === type);
    if (!policy || policy.totalDays === 0) return <span className="text-stone-400">0</span>;
    return policy.totalDays;
  };

  const columns: ExcelColumn<ContractType>[] = [
    {
      key: 'name',
      label: 'Contract Type',
      render: (ct) => <span className="font-semibold text-stone-900">{ct.name}</span>,
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (ct) =>
        ct.durationMonths !== null
          ? <span className="whitespace-nowrap">{ct.durationMonths} mo</span>
          : <span className="text-stone-500">Open-ended</span>,
    },
    { key: 'annual', label: 'Annual', numeric: true, render: (ct) => policyDaysCell(ct, 'ANNUAL') },
    { key: 'sick', label: 'Sick', numeric: true, render: (ct) => policyDaysCell(ct, 'SICK') },
    { key: 'emergency', label: 'Emergency', numeric: true, render: (ct) => policyDaysCell(ct, 'EMERGENCY') },
    { key: 'unpaid', label: 'Unpaid', numeric: true, render: (ct) => policyDaysCell(ct, 'UNPAID') },
    { key: 'staff', label: 'Staff', numeric: true, render: (ct) => ct._count.employeeProfiles },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (ct) => (
        <span className={`rounded-full px-2 py-0.5 text-label-sm font-medium ${
          ct.isActive ? 'bg-[#EDFAF1] text-[#1A6B3C]' : 'bg-stone-100 text-stone-500'
        }`}>
          {ct.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      width: 48,
      render: (ct) => (
        <button
          type="button"
          onClick={() => openEdit(ct)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          aria-label={`Edit ${ct.name}`}
        >
          <Pencil size={13} />
        </button>
      ),
    },
  ];

  if (!isHrAuth) {
    return (
      <PageLayout>
        <div className="px-5 py-16 text-center">
          <p className="text-heading-md text-stone-700">Access denied</p>
          <p className="mt-1 text-body-sm text-stone-400">Only HR Managers and Directors can manage contract types.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <button
        onClick={() => router.push('/app/hr/staff')}
        className="flex items-center gap-1.5 text-label-sm text-stone-500 transition-colors hover:text-stone-800"
      >
        <ChevronLeft size={15} /> Staff Profiles
      </button>

      <PageHeader
        title="Contract Types"
        subtitle="Define contract types and the leave entitlement each one grants. Assigning a contract on a staff profile seeds their leave balances from these policies."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        action={
          <Button onClick={openCreate} className="flex items-center gap-1.5">
            <Plus size={14} />
            New Contract Type
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-label-sm text-stone-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-stone-300 accent-[#2C1810]"
          />
          Show deactivated types
        </label>
        <span className="ml-auto text-caption text-stone-400">
          {loading ? '…' : `${contractTypes.length} contract type${contractTypes.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <ExcelTable
        columns={columns}
        rows={contractTypes}
        rowKey={(ct) => ct.id}
        numbered
        headerTone="navy"
        isLoading={loading}
        skeletonRows={4}
        emptyState={
          <EmptyState
            icon={<ScrollText size={24} />}
            heading="No contract types yet"
            body="Create your first contract type (e.g. 6-Month Contract, 1-Year Contract) to start assigning contracts and seeding leave balances."
          />
        }
        footnote="Leave columns show entitlement in days per year. Editing a policy affects future assignments only — re-assign the contract on a staff profile to apply changes to someone already on it."
      />

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New Contract Type'}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} isLoading={submitting} disabled={!form.name.trim()}>
              {editing ? 'Save Changes' : 'Create Contract Type'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              placeholder="e.g. 6-Month Contract"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              label="Duration (months, blank = open-ended)"
              type="number"
              min={1}
              placeholder="e.g. 6"
              value={form.durationMonths}
              onChange={(e) => setForm((p) => ({ ...p, durationMonths: e.target.value }))}
            />
          </div>

          <div>
            <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">
              Leave Entitlement (days per year)
            </p>
            <div className="grid gap-4 sm:grid-cols-4">
              {LEAVE_TYPES.map(({ type, label }) => (
                <Input
                  key={type}
                  label={label}
                  type="number"
                  min={0}
                  value={form.policyDays[type]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, policyDays: { ...p.policyDays, [type]: e.target.value } }))
                  }
                />
              ))}
            </div>
          </div>

          {editing && (
            <>
              <hr className="border-stone-200" />
              <label className="flex cursor-pointer items-center gap-2 text-body-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-stone-300 accent-[#2C1810]"
                />
                Active — can be assigned to staff
              </label>
              {editing._count.employeeProfiles > 0 && (
                <p className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-caption text-[#92400E]">
                  {editing._count.employeeProfiles} staff member{editing._count.employeeProfiles === 1 ? ' is' : 's are'} on this contract.
                  Policy changes are not retroactive — re-assign the contract on their profile to re-sync balances.
                </p>
              )}
            </>
          )}
        </div>
      </Modal>
    </PageLayout>
  );
}
