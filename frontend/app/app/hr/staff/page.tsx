'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserCircle, ChevronRight, ArrowLeftRight, ScrollText } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState, Button, Modal, Input, ExcelTable, type ExcelColumn } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { listEmployeeProfiles } from '@/services/hrService';
import { branchService, type BranchDto } from '@/services/branchService';
import { staffTransferService } from '@/services/staffTransferService';
import type { EmployeeProfile } from '@/types/hr';
import { roleLabel } from '@/components/hr/LeaveTypeBadge';
import { ApiError } from '@/types/api';

type ProfileFilter = 'ACTIVE' | 'INACTIVE' | 'NO_CONTRACT' | 'ALL';

/** Personal fields staff fill in themselves — drives the completeness column. */
const PERSONAL_FIELDS = [
  'nationalId', 'dateOfBirth', 'personalPhone', 'personalEmail', 'physicalAddress',
  'emergencyName', 'emergencyRelation', 'emergencyPhone',
  'kraPIN', 'bankName', 'accountNumber', 'accountName', 'bankBranch',
] as const;

function personalInfoFilled(profile: EmployeeProfile): number {
  return PERSONAL_FIELDS.filter((f) => {
    const v = profile[f];
    return typeof v === 'string' && v.trim().length > 0;
  }).length;
}

function leaveDaysRemaining(profile: EmployeeProfile): number | null {
  const year = new Date().getFullYear();
  const balances = (profile.leaveBalances ?? []).filter((b) => b.leaveYear === year);
  if (balances.length === 0) return null;
  return balances.reduce(
    (sum, b) => sum + Number(b.totalDays) - Number(b.usedDays) - Number(b.pendingDays),
    0,
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  active,
  warn,
  onClick,
}: {
  value: number;
  label: string;
  active?: boolean;
  warn?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all ${
        warn && !active
          ? 'border-[#FCD34D] bg-[#FFFBEB] hover:border-[#F59E0B]'
          : active
          ? 'border-[#2C1810] bg-[#FDF8F4]'
          : 'border-stone-200 bg-white hover:border-[#2C1810] hover:shadow-sm'
      }`}
    >
      <p className={`text-[28px] font-extrabold leading-none tracking-tight ${warn && !active ? 'text-[#92400E]' : 'text-[#2C1810]'}`}>
        {value}
      </p>
      <p className="mt-1.5 text-[12px] font-medium text-stone-400">{label}</p>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HrStaffPage(): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const router = useRouter();

  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Inactive staff hidden by default — toggle via the Inactive stat card
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>('ACTIVE');

  // ── Transfer state ──
  const [transferTarget, setTransferTarget] = useState<EmployeeProfile | null>(null);
  const [transferBranchId, setTransferBranchId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      setProfiles(await listEmployeeProfiles(accessToken));
    } catch {
      toast({ variant: 'error', title: 'Failed to load staff profiles' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!accessToken) return;
    void branchService.listBranches(accessToken).then(setBranches).catch(() => undefined);
  }, [accessToken]);

  // Stats
  const activeCount = useMemo(() => profiles.filter((p) => p.user.isActive).length, [profiles]);
  const inactiveCount = useMemo(() => profiles.filter((p) => !p.user.isActive).length, [profiles]);
  const noContractCount = useMemo(
    () => profiles.filter((p) => p.user.isActive && !p.contractType).length,
    [profiles],
  );

  // Filtered table
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return profiles
      .filter((p) => {
        if (profileFilter === 'ACTIVE') return p.user.isActive;
        if (profileFilter === 'INACTIVE') return !p.user.isActive;
        if (profileFilter === 'NO_CONTRACT') return p.user.isActive && !p.contractType;
        return true;
      })
      .filter((p) => {
        if (!q) return true;
        return (
          p.user.name.toLowerCase().includes(q) ||
          p.user.email.toLowerCase().includes(q) ||
          (p.jobTitle?.toLowerCase().includes(q) ?? false) ||
          (p.contractType?.name.toLowerCase().includes(q) ?? false)
        );
      });
  }, [profiles, searchQuery, profileFilter]);

  const openTransferModal = (profile: EmployeeProfile, e: React.MouseEvent): void => {
    e.stopPropagation();
    setTransferTarget(profile);
    setTransferBranchId('');
    setTransferNotes('');
  };

  const handleTransferSubmit = async (): Promise<void> => {
    if (!accessToken || !transferTarget || !transferBranchId) return;
    setTransferSubmitting(true);
    try {
      await staffTransferService.createTransfer(
        { userId: transferTarget.userId, toOrganizationId: transferBranchId, notes: transferNotes || undefined },
        accessToken,
      );
      toast({ variant: 'success', title: 'Transferred', message: `${transferTarget.user.name} has been transferred.` });
      setTransferTarget(null);
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to transfer staff member.';
      toast({ variant: 'error', title: 'Transfer failed', message });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const columns: ExcelColumn<EmployeeProfile>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (p) => (
        <div className="min-w-[160px]">
          <p className="font-semibold text-stone-900">{p.user.name}</p>
          <p className="text-caption text-stone-500">{p.jobTitle ?? roleLabel(p.user.role)}</p>
        </div>
      ),
    },
    {
      key: 'branch',
      label: 'Branch',
      render: (p) => p.user.organization?.name ?? <span className="text-stone-400">—</span>,
    },
    {
      key: 'contract',
      label: 'Contract',
      render: (p) =>
        p.contractType ? (
          <span className="whitespace-nowrap">{p.contractType.name}</span>
        ) : (
          <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-label-sm font-medium text-[#92400E]">Not assigned</span>
        ),
    },
    {
      key: 'started',
      label: 'Started',
      render: (p) => (
        <span className="whitespace-nowrap text-stone-600">
          {new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'leave',
      label: 'Leave Left',
      numeric: true,
      render: (p) => {
        const days = leaveDaysRemaining(p);
        if (days === null) return <span className="text-stone-400">—</span>;
        return <span className={days < 0 ? 'font-semibold text-sheet-negative' : undefined}>{days} d</span>;
      },
    },
    {
      key: 'details',
      label: 'Details Filled',
      align: 'center',
      render: (p) => {
        const filled = personalInfoFilled(p);
        const total = PERSONAL_FIELDS.length;
        const tone =
          filled === total ? 'bg-[#EDFAF1] text-[#1A6B3C]'
          : filled === 0 ? 'bg-[#FEF2F2] text-[#991B1B]'
          : 'bg-[#FFFBEB] text-[#92400E]';
        return (
          <span className={`rounded-full px-2 py-0.5 text-label-sm font-semibold tabular-nums ${tone}`}>
            {filled}/{total}
          </span>
        );
      },
    },
    {
      key: 'docs',
      label: 'Docs',
      numeric: true,
      render: (p) => p._count?.documents ?? 0,
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (p) => (
        <span className={`rounded-full px-2 py-0.5 text-label-sm font-medium ${
          p.user.isActive ? 'bg-[#EDFAF1] text-[#1A6B3C]' : 'bg-stone-100 text-stone-500'
        }`}>
          {p.user.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      width: 80,
      render: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={(e) => openTransferModal(p, e)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            aria-label={`Transfer ${p.user.name}`}
            title="Transfer to another branch"
          >
            <ArrowLeftRight size={13} />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/app/hr/staff/${p.userId}`)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label={`Open ${p.user.name}`}
            title="Open profile"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Staff Profiles"
        subtitle="Employee records and HR information. Profiles are created automatically with each staff account."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        action={
          <Button
            variant="secondary"
            onClick={() => router.push('/app/hr/contract-types')}
            className="flex items-center gap-1.5"
          >
            <ScrollText size={14} />
            Contract Types
          </Button>
        }
      />

      {/* ── Stat Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          value={activeCount}
          label="Active employees"
          active={profileFilter === 'ACTIVE'}
          onClick={() => setProfileFilter('ACTIVE')}
        />
        <StatCard
          value={noContractCount}
          label="No contract assigned"
          warn={noContractCount > 0}
          active={profileFilter === 'NO_CONTRACT'}
          onClick={() => setProfileFilter(profileFilter === 'NO_CONTRACT' ? 'ACTIVE' : 'NO_CONTRACT')}
        />
        <StatCard
          value={inactiveCount}
          label="Inactive"
          active={profileFilter === 'INACTIVE'}
          onClick={() => setProfileFilter(profileFilter === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE')}
        />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            placeholder="Search name, email, title, or contract…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-64 rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-body-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
          />
        </div>
        {profileFilter !== 'ACTIVE' && (
          <button
            onClick={() => setProfileFilter('ACTIVE')}
            className="text-label-sm font-medium text-stone-500 underline underline-offset-2 hover:text-stone-700"
          >
            Reset to active staff
          </button>
        )}
        <span className="ml-auto text-caption text-stone-400">
          {loading ? '…' : `${filtered.length} of ${profiles.length} profiles`}
        </span>
      </div>

      {/* ── Profiles Table ─────────────────────────────────────────────── */}
      <ExcelTable
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.id}
        numbered
        headerTone="navy"
        isLoading={loading}
        skeletonRows={6}
        emptyState={
          <EmptyState
            icon={<UserCircle size={24} />}
            heading="No profiles found"
            body={profiles.length === 0
              ? 'Profiles are created automatically when staff accounts are added.'
              : 'No profiles match the current filter.'}
          />
        }
        footnote="Details Filled counts the personal fields staff complete themselves (ID, contacts, emergency contact, banking). Leave Left is the remaining days across all leave types this year."
      />

      {/* ── Transfer Staff Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        title={`Transfer ${transferTarget?.user.name ?? 'Staff'}`}
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setTransferTarget(null)} disabled={transferSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleTransferSubmit()} isLoading={transferSubmitting} disabled={!transferBranchId}>
              Transfer
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-body-sm text-stone-500">
            This will move <span className="font-medium text-stone-800">{transferTarget?.user.name}</span> to the selected branch. Their home branch and all access will update immediately.
          </p>
          <div>
            <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Destination Branch</label>
            <select
              value={transferBranchId}
              onChange={(e) => setTransferBranchId(e.target.value)}
              className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
            >
              <option value="">Select branch…</option>
              {branches.filter((b) => b.id !== transferTarget?.user.organization?.id).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Notes (optional)"
            placeholder="Reason for transfer…"
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
          />
        </div>
      </Modal>
    </PageLayout>
  );
}
