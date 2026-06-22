'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { UserCircle, UserCheck, UserX, Pencil, KeyRound, Trash2, Search, ArrowLeftRight } from 'lucide-react';
import { Button, ConfirmDialog, EmptyState, Input, Modal, PageHeader, PageLayout, Select } from '@/components/ui';
import type { AppRole } from '@/types/auth';
import { ApiError } from '@/types/api';
import { staffService, type StaffDto } from '@/services/staffService';
import { branchService, type BranchDto } from '@/services/branchService';
import { staffTransferService } from '@/services/staffTransferService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';

type ManagerCreatableRole = Extract<AppRole, 'WAITER' | 'CHEF' | 'BARISTA' | 'KITCHEN_DISPLAY' | 'BARISTA_DISPLAY' | 'STEWARD' | 'HOUSEKEEPING'>;

const roleLabel: Record<string, string> = {
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  KITCHEN_DISPLAY: 'Kitchen Display',
  BARISTA_DISPLAY: 'Barista Display',
  STEWARD: 'Steward',
  HOUSEKEEPING: 'Housekeeping',
  MANAGER: 'Manager',
  DIRECTOR: 'Director',
  ACCOUNTANT: 'Accountant',
  HR_MANAGER: 'HR Manager',
  SYSTEM_ADMIN: 'System Admin',
};

const TRANSFER_ROLES: AppRole[] = ['DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN'];

export default function Page(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);
  const role = useAuthStore((state) => state.role) as AppRole | null;
  const { toast } = useToast();

  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'WAITER' as ManagerCreatableRole,
    temporaryPassword: '',
  });

  // ── Edit modal state ──
  const [editTarget, setEditTarget] = useState<StaffDto | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── Reset password modal state ──
  const [resetTarget, setResetTarget] = useState<StaffDto | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // ── Delete confirm state ──
  const [deleteTarget, setDeleteTarget] = useState<StaffDto | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── Transfer modal state ──
  const [transferTarget, setTransferTarget] = useState<StaffDto | null>(null);
  const [transferBranchId, setTransferBranchId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      void hydrateSession();
    }
  }, [accessToken, hydrateSession]);

  useEffect(() => {
    if (!accessToken || !role || !TRANSFER_ROLES.includes(role)) return;
    void branchService.listBranches(accessToken).then(setBranches).catch(() => undefined);
  }, [accessToken, role]);

  const loadStaff = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setError('Session not ready. Please wait or sign in again.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await staffService.listStaff(accessToken);
      setStaff(data);
    } catch {
      setError('Failed to load staff data.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return staff.filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q);
      const matchesRole = !filterRole || item.role === filterRole;
      const matchesStatus =
        !filterStatus ||
        (filterStatus === 'active' && item.isActive) ||
        (filterStatus === 'inactive' && !item.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staff, searchQuery, filterRole, filterStatus]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      setFormError('Session expired. Please sign in again.');
      return;
    }

    setFormError(null);
    setFormSuccess(false);
    setIsSubmitting(true);
    try {
      await staffService.createStaff(
        {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          role: form.role,
          temporaryPassword: form.temporaryPassword,
        },
        accessToken,
      );

      setForm({ name: '', email: '', phone: '', role: 'WAITER', temporaryPassword: '' });
      setFormSuccess(true);
      await loadStaff();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create staff account.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Edit handlers ──
  const openEditModal = (item: StaffDto): void => {
    setEditTarget(item);
    setEditForm({ name: item.name, email: item.email, phone: item.phone ?? '' });
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !editTarget) return;

    setEditSubmitting(true);
    try {
      await staffService.updateStaff(
        editTarget.id,
        {
          name: editForm.name || undefined,
          email: editForm.email || undefined,
          phone: editForm.phone || undefined,
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Updated', message: `${editForm.name} updated successfully.` });
      setEditTarget(null);
      await loadStaff();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update staff details.';
      toast({ variant: 'error', title: 'Update failed', message });
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Reset password handlers ──
  const openResetModal = (item: StaffDto): void => {
    setResetTarget(item);
    setResetPassword('');
  };

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !resetTarget) return;

    setResetSubmitting(true);
    try {
      await staffService.resetPassword(resetTarget.id, resetPassword, accessToken);
      toast({ variant: 'success', title: 'Password reset', message: `${resetTarget.name} will need to sign in again.` });
      setResetTarget(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to reset password.';
      toast({ variant: 'error', title: 'Reset failed', message });
    } finally {
      setResetSubmitting(false);
    }
  };

  // ── Delete handlers ──
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!accessToken || !deleteTarget) return;

    setDeleteSubmitting(true);
    try {
      await staffService.deleteStaff(deleteTarget.id, accessToken);
      toast({ variant: 'success', title: 'Deleted', message: `${deleteTarget.name} permanently deleted.` });
      setDeleteTarget(null);
      await loadStaff();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete staff account.';
      toast({ variant: 'error', title: 'Delete failed', message });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openTransferModal = (item: StaffDto): void => {
    setTransferTarget(item);
    setTransferBranchId('');
    setTransferNotes('');
  };

  const handleTransferSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !transferTarget || !transferBranchId) return;
    setTransferSubmitting(true);
    try {
      await staffTransferService.createTransfer(
        { userId: transferTarget.id, toOrganizationId: transferBranchId, notes: transferNotes || undefined },
        accessToken,
      );
      toast({ variant: 'success', title: 'Transferred', message: `${transferTarget.name} has been transferred.` });
      setTransferTarget(null);
      await loadStaff();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to transfer staff member.';
      toast({ variant: 'error', title: 'Transfer failed', message });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleToggleActive = async (item: StaffDto): Promise<void> => {
    if (!accessToken) return;
    if (!window.confirm(`${item.isActive ? 'Deactivate' : 'Reactivate'} ${item.name}?`)) return;

    setError(null);
    try {
      if (item.isActive) {
        await staffService.deactivateStaff(item.id, accessToken);
      } else {
        await staffService.reactivateStaff(item.id, accessToken);
      }
      await loadStaff();
    } catch {
      setError('Failed to update staff status.');
    }
  };

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Manage branch staff accounts and access."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
      />

      {/* Staff list */}
      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-stone-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-heading-sm font-semibold text-stone-900">Team Members</h2>
              <p className="mt-0.5 text-body-sm text-stone-500">
                {loading
                  ? 'Loading\u2026'
                  : filteredStaff.length === staff.length
                    ? `${staff.length} staff account${staff.length === 1 ? '' : 's'}`
                    : `${filteredStaff.length} of ${staff.length} accounts`}
              </p>
            </div>
          </div>

          {/* Search + filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-body-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-700 focus:border-stone-400 focus:outline-none"
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              <option value="WAITER">Waiter</option>
              <option value="CHEF">Chef</option>
              <option value="BARISTA">Barista</option>
              <option value="KITCHEN_DISPLAY">Kitchen Display</option>
              <option value="BARISTA_DISPLAY">Barista Display</option>
              <option value="STEWARD">Steward</option>
              <option value="HOUSEKEEPING">Housekeeping</option>
              <option value="MANAGER">Manager</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-700 focus:border-stone-400 focus:outline-none"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {(searchQuery || filterRole || filterStatus) && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setFilterRole(''); setFilterStatus(''); }}
                className="h-9 rounded-lg border border-stone-200 px-3 text-body-sm text-stone-500 transition-colors duration-fast hover:border-stone-300 hover:text-stone-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
            <p className="text-body-sm text-[#991B1B]">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 animate-pulse rounded-full bg-stone-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-stone-200" />
                  <div className="h-3 w-48 animate-pulse rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<UserCircle size={24} />}
              heading="No staff accounts yet"
              body="Create your first staff account using the form below."
            />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<Search size={24} />}
              heading="No results"
              body="No staff match your search or filters. Try adjusting the criteria."
            />
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filteredStaff.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                {/* Avatar + info */}
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-label-sm font-semibold text-stone-600">
                    {item.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-stone-900">{item.name}</p>
                    <p className="truncate text-caption text-stone-500">{item.email}</p>
                  </div>
                </div>

                {/* Role + status + actions */}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-label-sm text-stone-600 sm:inline-flex">
                    {roleLabel[item.role] ?? item.role}
                  </span>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-label-sm font-medium ${
                    item.isActive
                      ? 'bg-[#EDFAF1] text-[#1A6B3C]'
                      : 'bg-stone-100 text-stone-500'
                  }`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {role && TRANSFER_ROLES.includes(role) && (
                    <button
                      type="button"
                      onClick={() => openTransferModal(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors duration-fast hover:bg-blue-50 hover:text-blue-700"
                      aria-label={`Transfer ${item.name}`}
                    >
                      <ArrowLeftRight size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-700"
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openResetModal(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors duration-fast hover:bg-amber-50 hover:text-amber-700"
                    aria-label={`Reset password for ${item.name}`}
                  >
                    <KeyRound size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(item)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-fast ${
                      item.isActive
                        ? 'text-stone-400 hover:bg-[#FEF2F2] hover:text-[#991B1B]'
                        : 'text-stone-400 hover:bg-[#EDFAF1] hover:text-[#1A6B3C]'
                    }`}
                    aria-label={item.isActive ? `Deactivate ${item.name}` : `Reactivate ${item.name}`}
                  >
                    {item.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors duration-fast hover:bg-[#FEF2F2] hover:text-[#991B1B]"
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create staff form */}
      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="text-heading-sm font-semibold text-stone-900">Add Staff Account</h2>
          <p className="mt-0.5 text-body-sm text-stone-500">A temporary password will be provided for first sign-in.</p>
        </div>

        <form className="space-y-4 p-5" onSubmit={(e) => void handleCreate(e)}>
          {formError && (
            <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
              <p className="text-body-sm text-[#991B1B]">{formError}</p>
            </div>
          )}
          {formSuccess && (
            <div className="rounded-lg border border-[#86EFAC] bg-[#EDFAF1] px-4 py-3">
              <p className="text-body-sm text-[#1A6B3C]">Staff account created successfully.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              placeholder="e.g. James Kariuki"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              label="Email address"
              type="email"
              placeholder="james@wendocoffee.com"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <Input
              label="Phone (optional)"
              placeholder="+254 7XX XXX XXX"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <Select
              label="Role"
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as ManagerCreatableRole }))}
              options={[
                { value: 'WAITER', label: 'Waiter' },
                { value: 'CHEF', label: 'Chef' },
                { value: 'BARISTA', label: 'Barista' },
                { value: 'KITCHEN_DISPLAY', label: 'Kitchen Display' },
                { value: 'BARISTA_DISPLAY', label: 'Barista Display' },
                { value: 'STEWARD', label: 'Steward' },
                { value: 'HOUSEKEEPING', label: 'Housekeeping' },
              ]}
            />
            <Input
              label="Temporary password"
              type="password"
              placeholder="Min. 8 characters"
              value={form.temporaryPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
            />
          </div>

          <div className="pt-1">
            <Button type="submit" isLoading={isSubmitting}>
              Create Account
            </Button>
          </div>
        </form>
      </section>

      {/* ── Edit Staff Modal ── */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit ${editTarget?.name ?? 'Staff'}`}
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="edit-staff-form" isLoading={editSubmitting}>
              Save Changes
            </Button>
          </div>
        }
      >
        <form id="edit-staff-form" className="space-y-4" onSubmit={(e) => void handleEditSubmit(e)}>
          <Input
            label="Full name"
            value={editForm.name}
            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Email address"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Input
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
        </form>
      </Modal>

      {/* ── Reset Password Modal ── */}
      <Modal
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Reset Password — ${resetTarget?.name ?? ''}`}
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setResetTarget(null)} disabled={resetSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="reset-password-form" isLoading={resetSubmitting}>
              Reset Password
            </Button>
          </div>
        }
      >
        <form id="reset-password-form" className="space-y-4" onSubmit={(e) => void handleResetSubmit(e)}>
          <p className="text-body-sm text-stone-500">
            This will invalidate all active sessions for this staff member.
          </p>
          <Input
            label="New temporary password"
            type="password"
            placeholder="Min. 8 characters"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
        </form>
      </Modal>

      {/* ── Delete Confirm Dialog ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
        title={`Delete ${deleteTarget?.name ?? ''}?`}
        description="This permanently removes the staff account. If this person has orders, shifts, or clock records, deletion will be blocked — deactivate instead."
        confirmLabel="Delete permanently"
        isLoading={deleteSubmitting}
      />

      {/* ── Transfer Staff Modal ── */}
      <Modal
        isOpen={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        title={`Transfer ${transferTarget?.name ?? 'Staff'}`}
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setTransferTarget(null)} disabled={transferSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="transfer-staff-form" isLoading={transferSubmitting} disabled={!transferBranchId}>
              Transfer
            </Button>
          </div>
        }
      >
        <form id="transfer-staff-form" className="space-y-4" onSubmit={(e) => void handleTransferSubmit(e)}>
          <p className="text-body-sm text-stone-500">
            This will move <span className="font-medium text-stone-800">{transferTarget?.name}</span> to the selected branch. Their home branch and all access will update immediately.
          </p>
          <div>
            <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Destination Branch</label>
            <select
              value={transferBranchId}
              onChange={(e) => setTransferBranchId(e.target.value)}
              className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
              required
            >
              <option value="">Select branch…</option>
              {branches.filter((b) => b.id !== transferTarget?.organizationId).map((b) => (
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
        </form>
      </Modal>
    </PageLayout>
  );
}
