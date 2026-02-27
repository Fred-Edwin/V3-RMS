'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, ShieldCheck, Users } from 'lucide-react';
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

type AdminUserRole = Extract<AppRole, 'DIRECTOR' | 'MANAGER'>;

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
      const [branchData, managers, directors] = await Promise.all([
        branchService.listBranches(accessToken),
        staffService.listStaff(accessToken, { role: 'MANAGER' }),
        staffService.listStaff(accessToken, { role: 'DIRECTOR' }),
      ]);
      setBranches(branchData);
      setUsers([...directors, ...managers]);
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
      render: (_value, row) => {
        const isDirector = row.user.role === 'DIRECTOR';
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-label-sm font-semibold ${
              isDirector
                ? 'border border-[#C4862A]/30 bg-[#FEF0E0] text-[#A04F0A]'
                : 'border border-stone-200 bg-stone-100 text-stone-700'
            }`}
          >
            {isDirector ? 'Director' : 'Manager'}
          </span>
        );
      },
    },
    {
      key: 'organizationName',
      label: 'Branch',
      render: (_value, row) => (
        <span className="text-body-sm text-stone-600">{row.user.organizationName ?? <span className="text-stone-400">System</span>}</span>
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
      className: 'w-[120px]',
      render: (_value, row) => (
        <Button type="button" size="sm" variant="ghost" onClick={() => setToggleUserTarget(row.user)}>
          {row.user.isActive ? 'Deactivate' : 'Reactivate'}
        </Button>
      ),
    },
  ];

  const activeBranches = branches.filter((b) => b.isActive).length;
  const managerCount = users.filter((u) => u.role === 'MANAGER').length;
  const directorCount = users.filter((u) => u.role === 'DIRECTOR').length;

  return (
    <>
      <PageLayout className="animate-fade-up space-y-6">
        <PageHeader
          title="System Admin"
          titleClassName="font-display text-display-lg font-semibold text-espresso"
          subtitle="Manage branches, leadership accounts, and system configuration."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.push('/app/admin/menu')}
            >
              Master Menu
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            value={activeBranches}
            label="Active Branches"
            icon={<Building2 size={18} />}
            caption={`${branches.length} total`}
          />
          <StatCard
            value={managerCount}
            label="Managers"
            icon={<Users size={18} />}
          />
          <StatCard
            value={directorCount}
            label="Directors"
            icon={<ShieldCheck size={18} />}
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
            <Input
              id="user-password"
              type="password"
              value={userForm.temporaryPassword}
              onChange={(event) => setUserForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
            />
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
