'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Eye, EyeOff, KeyRound, Pencil, Plus, ShieldCheck, Users } from 'lucide-react';
import { branchService, type BranchDto } from '@/services/branchService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';
import {
  Button,
  ConfirmDialog,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Select,
  SkeletonTable,
  StatCard,
  Table,
  type TableColumn,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/types/api';

type AdminUserRole = Extract<AppRole, 'DIRECTOR' | 'MANAGER' | 'ACCOUNTANT' | 'HR_MANAGER'>;

type BranchRow = Record<string, unknown> & {
  id: string;
  name: string;
  city: string;
  isHub: boolean;
  isActive: boolean;
  branch: BranchDto;
};

type UserRow = Record<string, unknown> & {
  id: string;
  name: string;
  email: string;
  role: StaffDto['role'];
  organizationName: string | null;
  isActive: boolean;
  user: StaffDto;
};

interface BranchFormState {
  name: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
}

interface UserFormState {
  name: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  organizationId: string;
  temporaryPassword: string;
}

interface EditUserFormState {
  name: string;
  email: string;
  phone: string;
}

interface ResetPasswordFormState {
  newPassword: string;
  confirmPassword: string;
}

const initialBranchForm: BranchFormState = {
  name: '',
  address: '',
  city: '',
  latitude: '',
  longitude: '',
};

const initialUserForm: UserFormState = {
  name: '',
  email: '',
  phone: '',
  role: 'MANAGER',
  organizationId: '',
  temporaryPassword: '',
};

const statusPillClass = {
  active: 'border border-[#86EFAC] bg-[#EDFAF1] text-[#1A6B3C]',
  inactive: 'border border-[#D4D4D8] bg-[#F4F4F5] text-[#71717A]',
} as const;

export default function Page(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [users, setUsers] = useState<StaffDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Branch modals
  const [createBranchModalOpen, setCreateBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState<BranchFormState>(initialBranchForm);
  const [editBranchModalOpen, setEditBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchDto | null>(null);
  const [editBranchForm, setEditBranchForm] = useState<BranchFormState>(initialBranchForm);
  const [hubTarget, setHubTarget] = useState<BranchDto | null>(null);

  // User modals
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(initialUserForm);
  const [toggleUserTarget, setToggleUserTarget] = useState<StaffDto | null>(null);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffDto | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserFormState>({ name: '', email: '', phone: '' });
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<StaffDto | null>(null);
  const [resetPasswordForm, setResetPasswordForm] = useState<ResetPasswordFormState>({ newPassword: '', confirmPassword: '' });
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      void hydrateSession();
    }
  }, [accessToken, hydrateSession]);

  const loadData = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const [branchData, managers, directors, accountants, hrManagers] = await Promise.all([
        branchService.listBranches(accessToken),
        staffService.listStaff(accessToken, { role: 'MANAGER' }),
        staffService.listStaff(accessToken, { role: 'DIRECTOR' }),
        staffService.listStaff(accessToken, { role: 'ACCOUNTANT' }),
        staffService.listStaff(accessToken, { role: 'HR_MANAGER' }),
      ]);
      setBranches(branchData);
      setUsers([...directors, ...hrManagers, ...accountants, ...managers]);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load admin data.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const branchRows = useMemo<BranchRow[]>(
    () =>
      branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        city: branch.city,
        isHub: branch.isHub,
        isActive: branch.isActive,
        branch,
      })),
    [branches],
  );

  const userRows = useMemo<UserRow[]>(
    () =>
      users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationName: user.organizationName ?? null,
        isActive: user.isActive,
        user,
      })),
    [users],
  );

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) return;

    const latitude = Number.parseFloat(branchForm.latitude);
    const longitude = Number.parseFloat(branchForm.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast({ variant: 'warning', title: 'Invalid coordinates', message: 'Latitude and longitude must be valid numbers.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await branchService.createBranch(
        { name: branchForm.name.trim(), address: branchForm.address.trim(), city: branchForm.city.trim(), latitude, longitude },
        accessToken,
      );
      setBranchForm(initialBranchForm);
      setCreateBranchModalOpen(false);
      toast({ variant: 'success', title: 'Branch created' });
      await loadData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create branch.';
      toast({ variant: 'error', title: 'Create failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditBranchModal = (branch: BranchDto): void => {
    setEditingBranch(branch);
    setEditBranchForm({
      name: branch.name,
      address: branch.address,
      city: branch.city,
      latitude: String(branch.latitude),
      longitude: String(branch.longitude),
    });
    setEditBranchModalOpen(true);
  };

  const handleUpdateBranch = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !editingBranch) return;

    const latitude = Number.parseFloat(editBranchForm.latitude);
    const longitude = Number.parseFloat(editBranchForm.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast({ variant: 'warning', title: 'Invalid coordinates', message: 'Latitude and longitude must be valid numbers.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await branchService.updateBranch(
        editingBranch.id,
        { name: editBranchForm.name.trim(), address: editBranchForm.address.trim(), city: editBranchForm.city.trim(), latitude, longitude },
        accessToken,
      );
      setEditBranchModalOpen(false);
      setEditingBranch(null);
      toast({ variant: 'success', title: 'Branch updated' });
      await loadData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update branch.';
      toast({ variant: 'error', title: 'Update failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSetHub = async (): Promise<void> => {
    if (!accessToken || !hubTarget) return;

    setIsSubmitting(true);
    try {
      await branchService.setHub(hubTarget.id, accessToken);
      setHubTarget(null);
      toast({ variant: 'success', title: 'Hub branch updated' });
      await loadData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to set hub branch.';
      toast({ variant: 'error', title: 'Hub update failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) return;

    if (userForm.role === 'MANAGER' && !userForm.organizationId) {
      toast({ variant: 'warning', title: 'Branch required', message: 'Select a branch before creating a manager.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await staffService.createStaff(
        {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim() || undefined,
          role: userForm.role,
          // Only branch managers are scoped to a branch; all other roles are system-wide
          organizationId: userForm.role === 'MANAGER' ? userForm.organizationId : undefined,
          temporaryPassword: userForm.temporaryPassword,
        },
        accessToken,
      );
      setUserForm(initialUserForm);
      setCreateUserModalOpen(false);
      toast({ variant: 'success', title: 'Account created' });
      await loadData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create account.';
      toast({ variant: 'error', title: 'Create failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditUserModal = (user: StaffDto): void => {
    setEditingUser(user);
    setEditUserForm({ name: user.name, email: user.email, phone: user.phone ?? '' });
    setEditUserModalOpen(true);
  };

  const handleUpdateUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !editingUser) return;

    setIsSubmitting(true);
    try {
      await staffService.updateStaff(
        editingUser.id,
        {
          name: editUserForm.name.trim() || undefined,
          email: editUserForm.email.trim() || undefined,
          phone: editUserForm.phone.trim() || undefined,
        },
        accessToken,
      );
      setEditUserModalOpen(false);
      setEditingUser(null);
      toast({ variant: 'success', title: 'Account updated' });
      await loadData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update account.';
      toast({ variant: 'error', title: 'Update failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openResetPasswordModal = (user: StaffDto): void => {
    setResetPasswordTarget(user);
    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
    setResetPasswordModalOpen(true);
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !resetPasswordTarget) return;

    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      toast({ variant: 'warning', title: 'Passwords do not match', message: 'Please enter the same password in both fields.' });
      return;
    }
    if (resetPasswordForm.newPassword.length < 8) {
      toast({ variant: 'warning', title: 'Password too short', message: 'Password must be at least 8 characters.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await staffService.resetPassword(resetPasswordTarget.id, resetPasswordForm.newPassword, accessToken);
      setResetPasswordModalOpen(false);
      setResetPasswordTarget(null);
      toast({ variant: 'success', title: 'Password reset', message: `Password updated for ${resetPasswordTarget.name}.` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to reset password.';
      toast({ variant: 'error', title: 'Reset failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmToggleUser = async (): Promise<void> => {
    if (!accessToken || !toggleUserTarget) return;

    setIsSubmitting(true);
    try {
      if (toggleUserTarget.isActive) {
        await staffService.deactivateStaff(toggleUserTarget.id, accessToken);
      } else {
        await staffService.reactivateStaff(toggleUserTarget.id, accessToken);
      }
      setToggleUserTarget(null);
      toast({ variant: 'success', title: 'Account status updated' });
      await loadData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update account status.';
      toast({ variant: 'error', title: 'Status update failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const branchColumns: Array<TableColumn<BranchRow>> = [
    {
      key: 'name',
      label: 'Branch',
      render: (_value, row) => (
        <div>
          <p className="text-body-sm font-medium text-stone-900">{row.branch.name}</p>
          <p className="text-caption text-stone-400">{row.branch.address}</p>
        </div>
      ),
    },
    {
      key: 'city',
      label: 'City',
      render: (_value, row) => <span className="text-body-sm text-stone-700">{row.branch.city}</span>,
    },
    {
      key: 'isHub',
      label: 'Hub',
      render: (_value, row) =>
        row.branch.isHub ? (
          <span className="inline-flex rounded-full border border-amber/40 bg-amber/10 px-2.5 py-0.5 text-label-sm font-semibold text-[#92400E]">
            Hub
          </span>
        ) : (
          <span className="text-caption text-stone-400">—</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (_value, row) => (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-label-sm font-medium ${row.branch.isActive ? statusPillClass.active : statusPillClass.inactive}`}>
          {row.branch.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[160px]',
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => openEditBranchModal(row.branch)}>
            Edit
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setHubTarget(row.branch)}>
            Set Hub
          </Button>
        </div>
      ),
    },
  ];

  const roleBadge = (role: StaffDto['role']): JSX.Element => {
    if (role === 'DIRECTOR') {
      return (
        <span className="inline-flex rounded-full border border-[#C4862A]/30 bg-[#FEF0E0] px-2.5 py-0.5 text-label-sm font-semibold text-[#A04F0A]">
          Director
        </span>
      );
    }
    if (role === 'ACCOUNTANT') {
      return (
        <span className="inline-flex rounded-full border border-[#7C3AED]/20 bg-[#F5F3FF] px-2.5 py-0.5 text-label-sm font-semibold text-[#5B21B6]">
          Accountant
        </span>
      );
    }
    if (role === 'HR_MANAGER') {
      return (
        <span className="inline-flex rounded-full border border-[#0D9488]/20 bg-[#F0FDFA] px-2.5 py-0.5 text-label-sm font-semibold text-[#0F766E]">
          HR Manager
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-full border border-stone-200 bg-stone-100 px-2.5 py-0.5 text-label-sm font-semibold text-stone-700">
        Manager
      </span>
    );
  };

  const userColumns: Array<TableColumn<UserRow>> = [
    {
      key: 'name',
      label: 'Name',
      render: (_value, row) => (
        <div>
          <p className="text-body-sm font-medium text-stone-900">{row.user.name}</p>
          <p className="text-caption text-stone-400">{row.user.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (_value, row) => roleBadge(row.user.role),
    },
    {
      key: 'organizationName',
      label: 'Branch',
      render: (_value, row) => (
        <span className="text-body-sm text-stone-600">{row.user.organizationName ?? <span className="text-stone-400">System-wide</span>}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (_value, row) => (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-label-sm font-medium ${row.user.isActive ? statusPillClass.active : statusPillClass.inactive}`}>
          {row.user.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[180px]',
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Edit account"
            onClick={() => openEditUserModal(row.user)}
          >
            <Pencil size={14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Reset password"
            onClick={() => openResetPasswordModal(row.user)}
          >
            <KeyRound size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setToggleUserTarget(row.user)}>
            {row.user.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ];

  const activeBranches = branches.filter((b) => b.isActive).length;
  const managerCount = users.filter((u) => u.role === 'MANAGER').length;
  const directorCount = users.filter((u) => u.role === 'DIRECTOR').length;
  const accountantCount = users.filter((u) => u.role === 'ACCOUNTANT').length;
  const hrManagerCount = users.filter((u) => u.role === 'HR_MANAGER').length;

  return (
    <>
      <PageLayout className="animate-fade-up space-y-6">
        <PageHeader
          title="System Admin"
          titleClassName="font-display text-display-lg font-semibold text-espresso"
          subtitle="Manage branches, leadership accounts, and system configuration."
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => router.push('/app/admin/order-corrections')}
              >
                Order Corrections
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => router.push('/app/admin/menu')}
              >
                Master Menu
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            value={activeBranches}
            label="Active Branches"
            icon={<Building2 size={18} />}
            caption={`${branches.length} total`}
          />
          <StatCard
            value={directorCount}
            label="Directors"
            icon={<ShieldCheck size={18} />}
          />
          <StatCard
            value={hrManagerCount}
            label="HR Managers"
            icon={<Users size={18} />}
          />
          <StatCard
            value={managerCount}
            label="Managers"
            icon={<Users size={18} />}
            caption={`${accountantCount} accountant${accountantCount !== 1 ? 's' : ''}`}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Branches */}
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-heading-md font-semibold text-stone-900">Branches</h2>
              <Button
                type="button"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setBranchForm(initialBranchForm);
                  setCreateBranchModalOpen(true);
                }}
              >
                Add Branch
              </Button>
            </div>
            {isLoading ? (
              <SkeletonTable rows={4} columns={4} />
            ) : (
              <Table<BranchRow> columns={branchColumns} data={branchRows} keyField="id" />
            )}
          </section>

          {/* Leadership Accounts */}
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-heading-md font-semibold text-stone-900">Leadership Accounts</h2>
              <Button
                type="button"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setUserForm(initialUserForm);
                  setCreateUserModalOpen(true);
                }}
              >
                Add Account
              </Button>
            </div>
            {isLoading ? (
              <SkeletonTable rows={4} columns={4} />
            ) : (
              <Table<UserRow> columns={userColumns} data={userRows} keyField="id" />
            )}
          </section>
        </div>
      </PageLayout>

      {/* Create Branch Modal */}
      <Modal
        isOpen={createBranchModalOpen}
        onClose={() => { if (!isSubmitting) setCreateBranchModalOpen(false); }}
        title="Add Branch"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setCreateBranchModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="create-branch-form" isLoading={isSubmitting}>
              Create Branch
            </Button>
          </div>
        }
      >
        <form id="create-branch-form" className="space-y-4" onSubmit={(event) => void handleCreateBranch(event)}>
          <FormField label="Branch Name" htmlFor="branch-name" required>
            <Input
              id="branch-name"
              value={branchForm.name}
              onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Wendo Kimathi"
            />
          </FormField>
          <FormField label="Address" htmlFor="branch-address" required>
            <Input
              id="branch-address"
              value={branchForm.address}
              onChange={(event) => setBranchForm((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="Street address"
            />
          </FormField>
          <FormField label="City" htmlFor="branch-city" required>
            <Input
              id="branch-city"
              value={branchForm.city}
              onChange={(event) => setBranchForm((prev) => ({ ...prev, city: event.target.value }))}
              placeholder="e.g. Nyeri"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Latitude" htmlFor="branch-latitude" required>
              <Input
                id="branch-latitude"
                value={branchForm.latitude}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, latitude: event.target.value }))}
                placeholder="-0.4167"
              />
            </FormField>
            <FormField label="Longitude" htmlFor="branch-longitude" required>
              <Input
                id="branch-longitude"
                value={branchForm.longitude}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, longitude: event.target.value }))}
                placeholder="36.9500"
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* Edit Branch Modal */}
      <Modal
        isOpen={editBranchModalOpen}
        onClose={() => { if (!isSubmitting) setEditBranchModalOpen(false); }}
        title="Edit Branch"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditBranchModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="edit-branch-form" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        }
      >
        <form id="edit-branch-form" className="space-y-4" onSubmit={(event) => void handleUpdateBranch(event)}>
          <FormField label="Branch Name" htmlFor="edit-branch-name" required>
            <Input
              id="edit-branch-name"
              value={editBranchForm.name}
              onChange={(event) => setEditBranchForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </FormField>
          <FormField label="Address" htmlFor="edit-branch-address" required>
            <Input
              id="edit-branch-address"
              value={editBranchForm.address}
              onChange={(event) => setEditBranchForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </FormField>
          <FormField label="City" htmlFor="edit-branch-city" required>
            <Input
              id="edit-branch-city"
              value={editBranchForm.city}
              onChange={(event) => setEditBranchForm((prev) => ({ ...prev, city: event.target.value }))}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Latitude" htmlFor="edit-branch-latitude" required>
              <Input
                id="edit-branch-latitude"
                value={editBranchForm.latitude}
                onChange={(event) => setEditBranchForm((prev) => ({ ...prev, latitude: event.target.value }))}
              />
            </FormField>
            <FormField label="Longitude" htmlFor="edit-branch-longitude" required>
              <Input
                id="edit-branch-longitude"
                value={editBranchForm.longitude}
                onChange={(event) => setEditBranchForm((prev) => ({ ...prev, longitude: event.target.value }))}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* Create User Modal */}
      <Modal
        isOpen={createUserModalOpen}
        onClose={() => { if (!isSubmitting) setCreateUserModalOpen(false); }}
        title="Add Leadership Account"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setCreateUserModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="create-user-form" isLoading={isSubmitting}>
              Create Account
            </Button>
          </div>
        }
      >
        <form id="create-user-form" className="space-y-4" onSubmit={(event) => void handleCreateUser(event)}>
          <FormField label="Full Name" htmlFor="user-name" required>
            <Input
              id="user-name"
              value={userForm.name}
              onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Jane Wambui"
            />
          </FormField>
          <FormField label="Email" htmlFor="user-email" required>
            <Input
              id="user-email"
              type="email"
              value={userForm.email}
              onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="jane@wendo.co.ke"
            />
          </FormField>
          <FormField label="Phone" htmlFor="user-phone">
            <Input
              id="user-phone"
              value={userForm.phone}
              onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="+254 700 000 000"
            />
          </FormField>
          <FormField label="Role" htmlFor="user-role" required>
            <Select
              id="user-role"
              value={userForm.role}
              onChange={(event) =>
                setUserForm((prev) => ({ ...prev, role: event.target.value as AdminUserRole, organizationId: '' }))
              }
              options={[
                { value: 'MANAGER', label: 'Manager' },
                { value: 'DIRECTOR', label: 'Director' },
                { value: 'ACCOUNTANT', label: 'Accountant' },
                { value: 'HR_MANAGER', label: 'HR Manager' },
              ]}
            />
          </FormField>
          {userForm.role === 'MANAGER' ? (
            <FormField label="Assign to Branch" htmlFor="user-branch" required>
              <Select
                id="user-branch"
                placeholder="Select branch"
                value={userForm.organizationId}
                onChange={(event) => setUserForm((prev) => ({ ...prev, organizationId: event.target.value }))}
                options={branches.map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                }))}
              />
            </FormField>
          ) : null}
          <FormField label="Temporary Password" htmlFor="user-password" required>
            <div className="relative">
              <Input
                id="user-password"
                type={showTempPassword ? 'text' : 'password'}
                value={userForm.temporaryPassword}
                onChange={(event) => setUserForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
                placeholder="Minimum 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600"
                onClick={() => setShowTempPassword((v) => !v)}
                tabIndex={-1}
              >
                {showTempPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1.5 text-caption text-stone-400">The user will be prompted to change this on first login.</p>
          </FormField>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={editUserModalOpen}
        onClose={() => { if (!isSubmitting) { setEditUserModalOpen(false); setEditingUser(null); } }}
        title={`Edit — ${editingUser?.name ?? ''}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setEditUserModalOpen(false); setEditingUser(null); }} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        }
      >
        <form id="edit-user-form" className="space-y-4" onSubmit={(event) => void handleUpdateUser(event)}>
          <FormField label="Full Name" htmlFor="edit-user-name" required>
            <Input
              id="edit-user-name"
              value={editUserForm.name}
              onChange={(event) => setEditUserForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </FormField>
          <FormField label="Email" htmlFor="edit-user-email" required>
            <Input
              id="edit-user-email"
              type="email"
              value={editUserForm.email}
              onChange={(event) => setEditUserForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </FormField>
          <FormField label="Phone" htmlFor="edit-user-phone">
            <Input
              id="edit-user-phone"
              value={editUserForm.phone}
              onChange={(event) => setEditUserForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="+254 700 000 000"
            />
          </FormField>
          <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-caption text-stone-500">
            Role and branch assignment cannot be changed after account creation. To reassign, deactivate this account and create a new one.
          </p>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetPasswordModalOpen}
        onClose={() => { if (!isSubmitting) { setResetPasswordModalOpen(false); setResetPasswordTarget(null); } }}
        title={`Reset Password — ${resetPasswordTarget?.name ?? ''}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setResetPasswordModalOpen(false); setResetPasswordTarget(null); }} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="reset-password-form" isLoading={isSubmitting}>
              Reset Password
            </Button>
          </div>
        }
      >
        <form id="reset-password-form" className="space-y-4" onSubmit={(event) => void handleResetPassword(event)}>
          <div className="rounded-lg border border-amber/30 bg-amber/5 px-3 py-2">
            <p className="text-caption text-stone-600">
              This sets a temporary password. The user will be prompted to change it on next login.
            </p>
          </div>
          <FormField label="New Password" htmlFor="reset-new-password" required>
            <div className="relative">
              <Input
                id="reset-new-password"
                type={showResetPassword ? 'text' : 'password'}
                value={resetPasswordForm.newPassword}
                onChange={(event) => setResetPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                placeholder="Minimum 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600"
                onClick={() => setShowResetPassword((v) => !v)}
                tabIndex={-1}
              >
                {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>
          <FormField label="Confirm Password" htmlFor="reset-confirm-password" required>
            <div className="relative">
              <Input
                id="reset-confirm-password"
                type={showResetConfirmPassword ? 'text' : 'password'}
                value={resetPasswordForm.confirmPassword}
                onChange={(event) => setResetPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                placeholder="Re-enter password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600"
                onClick={() => setShowResetConfirmPassword((v) => !v)}
                tabIndex={-1}
              >
                {showResetConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!hubTarget}
        onClose={() => setHubTarget(null)}
        onConfirm={() => void handleConfirmSetHub()}
        title="Set hub branch?"
        description={`Set "${hubTarget?.name ?? ''}" as the system hub branch. This will replace the current hub.`}
        confirmLabel="Set Hub"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={!!toggleUserTarget}
        onClose={() => setToggleUserTarget(null)}
        onConfirm={() => void handleConfirmToggleUser()}
        title={toggleUserTarget?.isActive ? 'Deactivate account?' : 'Reactivate account?'}
        description={`Update account status for "${toggleUserTarget?.name ?? ''}".`}
        confirmLabel={toggleUserTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        isLoading={isSubmitting}
      />
    </>
  );
}
