'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserCircle, ChevronRight, Plus, AlertTriangle } from 'lucide-react';
import { PageLayout, PageHeader, EmptyState, Button, Modal, Input, Select } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { listEmployeeProfiles, createEmployeeProfile } from '@/services/hrService';
import { staffService } from '@/services/staffService';
import type { EmployeeProfile, CreateEmployeeProfileInput, EmploymentType } from '@/types/hr';
import { employmentTypeLabel, roleLabel } from '@/components/hr/LeaveTypeBadge';
import { ApiError } from '@/types/api';

type StaffUser = { id: string; name: string; email: string; role: string; organizationName?: string | null };
type ProfileFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

// ─── Staff Dropdown (grouped by branch) ──────────────────────────────────────

function StaffDropdown({
  staff,
  value,
  onChange,
}: {
  staff: StaffUser[];
  value: string;
  onChange: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, StaffUser[]>();
    for (const s of staff) {
      const branch = s.organizationName ?? 'No Branch Assigned';
      const list = map.get(branch) ?? [];
      list.push(s);
      map.set(branch, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [staff]);

  return (
    <div>
      <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Staff Member</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
      >
        <option value="">Select a staff member…</option>
        {groups.map(([branch, members]) => (
          <optgroup key={branch} label={branch}>
            {members.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {roleLabel(s.role)}
                {s.organizationName ? ` · ${s.organizationName}` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
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
        warn
          ? 'border-[#FCD34D] bg-[#FFFBEB] hover:border-[#F59E0B]'
          : active
          ? 'border-[#2C1810] bg-[#FDF8F4]'
          : 'border-stone-200 bg-white hover:border-[#2C1810] hover:shadow-sm'
      }`}
    >
      <p className={`text-[28px] font-extrabold leading-none tracking-tight ${warn ? 'text-[#92400E]' : 'text-[#2C1810]'}`}>
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
  const [staffWithoutProfiles, setStaffWithoutProfiles] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CreateEmployeeProfileInput>({
    userId: '',
    employmentType: 'FULL_TIME',
    startDate: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [profileList, staffList] = await Promise.all([
        listEmployeeProfiles(accessToken),
        staffService.listStaff(accessToken),
      ]);
      setProfiles(profileList);
      const profiledUserIds = new Set(profileList.map((p) => p.userId));
      setStaffWithoutProfiles(
        staffList.filter((s) => !profiledUserIds.has(s.id)).map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          role: s.role,
          organizationName: s.organizationName,
        })),
      );
    } catch {
      toast({ variant: 'error', title: 'Failed to load staff profiles' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  // Stats
  const activeCount = useMemo(() => profiles.filter((p) => p.user.isActive).length, [profiles]);
  const inactiveCount = useMemo(() => profiles.filter((p) => !p.user.isActive).length, [profiles]);

  // Filtered table
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return profiles
      .filter((p) => {
        if (profileFilter === 'ACTIVE') return p.user.isActive;
        if (profileFilter === 'INACTIVE') return !p.user.isActive;
        return true;
      })
      .filter((p) => {
        if (!q) return true;
        return (
          p.user.name.toLowerCase().includes(q) ||
          p.user.email.toLowerCase().includes(q) ||
          (p.jobTitle?.toLowerCase().includes(q) ?? false)
        );
      });
  }, [profiles, searchQuery, profileFilter]);

  const handleCreate = async () => {
    if (!accessToken || !form.userId) return;
    setSubmitting(true);
    try {
      await createEmployeeProfile(
        { ...form, startDate: new Date(form.startDate).toISOString() },
        accessToken,
      );
      toast({ variant: 'success', title: 'Profile created' });
      setShowCreate(false);
      setForm({ userId: '', employmentType: 'FULL_TIME', startDate: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create profile';
      toast({ variant: 'error', title: 'Error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Staff Profiles"
        subtitle="Employee records and HR information."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        action={
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            New Profile
          </Button>
        }
      />

      {/* ── Stat Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          value={activeCount}
          label="Active employees"
          active={profileFilter === 'ACTIVE'}
          onClick={() => setProfileFilter(profileFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
        />
        <StatCard
          value={staffWithoutProfiles.length}
          label="No HR profile yet"
          warn={staffWithoutProfiles.length > 0}
          active={false}
          onClick={() => setShowCreate(true)}
        />
        <StatCard
          value={inactiveCount}
          label="Inactive"
          active={profileFilter === 'INACTIVE'}
          onClick={() => setProfileFilter(profileFilter === 'INACTIVE' ? 'ALL' : 'INACTIVE')}
        />
      </div>

      {/* ── No-profile alert ──────────────────────────────────────────── */}
      {staffWithoutProfiles.length > 0 && !loading && (
        <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#92400E]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
                Missing Profiles
              </span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="text-[11px] font-bold text-[#92400E] underline underline-offset-2"
            >
              Create profile
            </button>
          </div>
          <div className="space-y-1.5">
            {staffWithoutProfiles.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-body-sm text-[#78350F]">
                <span>{s.name} · <span className="text-[#92650A]">{roleLabel(s.role)}</span></span>
                <span className="text-caption text-[#A16207]">{s.organizationName ?? 'No branch'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Profiles Table ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-3">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              placeholder="Search by name, email, or title…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-56 rounded-lg border border-stone-200 bg-stone-50 pl-8 pr-3 text-body-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
            />
          </div>
          <span className="ml-auto text-caption text-stone-400">
            {loading ? '…' : `${filtered.length} of ${profiles.length}`}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 animate-pulse rounded-full bg-stone-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 animate-pulse rounded bg-stone-200" />
                  <div className="h-3 w-52 animate-pulse rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState
              icon={<UserCircle size={24} />}
              heading="No profiles found"
              body={profiles.length === 0 ? 'Create an employee profile to get started.' : 'No profiles match the current filter.'}
            />
          </div>
        ) : (
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Employee</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Branch</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Employment</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Started</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((profile) => (
                <tr
                  key={profile.id}
                  className="cursor-pointer transition-colors hover:bg-stone-50"
                  onClick={() => router.push(`/app/hr/staff/${profile.userId}`)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] text-label-sm font-bold text-[#2C1810]">
                        {profile.user.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-stone-900">{profile.user.name}</p>
                        <p className="text-caption text-stone-400">{profile.jobTitle ?? roleLabel(profile.user.role)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-stone-600">
                    {profile.user.organization?.name ?? <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-label-sm text-stone-600">
                      {employmentTypeLabel(profile.employmentType)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-stone-500">
                    {profile.startDate
                      ? new Date(profile.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-medium ${
                      profile.user.isActive ? 'bg-[#EDFAF1] text-[#1A6B3C]' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {profile.user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ChevronRight size={15} className="text-stone-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create Profile Modal ───────────────────────────────────────── */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Employee Profile"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} isLoading={submitting} disabled={!form.userId}>
              Create Profile
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <StaffDropdown
            staff={staffWithoutProfiles}
            value={form.userId}
            onChange={(id) => setForm((p) => ({ ...p, userId: id }))}
          />
          <Select
            label="Employment Type"
            value={form.employmentType}
            onChange={(e) => setForm((p) => ({ ...p, employmentType: e.target.value as EmploymentType }))}
            options={[
              { value: 'FULL_TIME', label: 'Full-time' },
              { value: 'PART_TIME', label: 'Part-time' },
              { value: 'CASUAL', label: 'Casual' },
            ]}
          />
          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
          />
          <Input
            label="Job Title (optional)"
            placeholder="e.g. Senior Barista"
            value={form.jobTitle ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value || undefined }))}
          />
        </div>
      </Modal>
    </PageLayout>
  );
}
