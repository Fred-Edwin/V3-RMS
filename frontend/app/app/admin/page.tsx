'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { branchService, type BranchDto } from '@/services/branchService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';

type AdminUserRole = Extract<AppRole, 'DIRECTOR' | 'MANAGER'>;

export default function Page(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [users, setUsers] = useState<StaffDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    city: '',
    latitude: '',
    longitude: '',
  });

  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'MANAGER' as AdminUserRole,
    organizationId: '',
    temporaryPassword: '',
  });

  const loadData = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [branchData, managers, directors] = await Promise.all([
        branchService.listBranches(accessToken),
        staffService.listStaff(accessToken, { role: 'MANAGER' }),
        staffService.listStaff(accessToken, { role: 'DIRECTOR' }),
      ]);
      setBranches(branchData);
      setUsers([...directors, ...managers]);
    } catch {
      setError('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    await branchService.createBranch(
      {
        name: branchForm.name,
        address: branchForm.address,
        city: branchForm.city,
        latitude: Number(branchForm.latitude),
        longitude: Number(branchForm.longitude),
      },
      accessToken,
    );

    setBranchForm({
      name: '',
      address: '',
      city: '',
      latitude: '',
      longitude: '',
    });
    await loadData();
  };

  const handleSetHub = async (branchId: string): Promise<void> => {
    if (!accessToken) {
      return;
    }
    if (!window.confirm('Set this branch as hub?')) {
      return;
    }

    await branchService.setHub(branchId, accessToken);
    await loadData();
  };

  const handleEditBranch = async (branch: BranchDto): Promise<void> => {
    if (!accessToken) {
      return;
    }

    const name = window.prompt('Branch name', branch.name);
    if (!name) {
      return;
    }

    await branchService.updateBranch(branch.id, { name }, accessToken);
    await loadData();
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    await staffService.createStaff(
      {
        name: userForm.name,
        email: userForm.email,
        phone: userForm.phone || undefined,
        role: userForm.role,
        organizationId: userForm.role === 'MANAGER' ? userForm.organizationId : undefined,
        temporaryPassword: userForm.temporaryPassword,
      },
      accessToken,
    );

    setUserForm({
      name: '',
      email: '',
      phone: '',
      role: 'MANAGER',
      organizationId: '',
      temporaryPassword: '',
    });
    await loadData();
  };

  const handleToggleUser = async (staff: StaffDto): Promise<void> => {
    if (!accessToken) {
      return;
    }

    if (!window.confirm(`${staff.isActive ? 'Deactivate' : 'Reactivate'} ${staff.name}?`)) {
      return;
    }

    if (staff.isActive) {
      await staffService.deactivateStaff(staff.id, accessToken);
    } else {
      await staffService.reactivateStaff(staff.id, accessToken);
    }

    await loadData();
  };

  return (
    <main className="min-h-screen bg-stone-100 p-6 md:p-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-stone-900">System Admin</h1>
          <p className="mt-2 text-sm text-stone-600">Manage branches and leadership accounts.</p>
          {loading ? <p className="mt-3 text-sm text-stone-500">Loading...</p> : null}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Branches</h2>
            <ul className="mt-4 space-y-3 text-sm text-stone-700">
              {branches.map((branch) => (
                <li key={branch.id} className="rounded-md border border-stone-200 p-3">
                  <p className="font-medium">
                    {branch.name} {branch.isHub ? '(Hub)' : ''}
                  </p>
                  <p>{branch.city}</p>
                  <p className="text-stone-500">{branch.isActive ? 'Active' : 'Inactive'}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleEditBranch(branch)}
                      className="rounded border border-stone-300 px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSetHub(branch.id)}
                      className="rounded border border-stone-300 px-2 py-1 text-xs"
                    >
                      Set Hub
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <form className="mt-6 space-y-3" onSubmit={handleCreateBranch}>
              <h3 className="text-sm font-semibold text-stone-800">Create Branch</h3>
              <input
                placeholder="Name"
                value={branchForm.name}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Address"
                value={branchForm.address}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, address: event.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="City"
                value={branchForm.city}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, city: event.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Latitude"
                  value={branchForm.latitude}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, latitude: event.target.value }))}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Longitude"
                  value={branchForm.longitude}
                  onChange={(event) => setBranchForm((prev) => ({ ...prev, longitude: event.target.value }))}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <button className="rounded bg-stone-900 px-3 py-2 text-sm text-white" type="submit">
                Create Branch
              </button>
            </form>
          </article>

          <article className="rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Director and Manager Accounts</h2>
            <ul className="mt-4 space-y-3 text-sm text-stone-700">
              {users.map((staff) => (
                <li key={staff.id} className="rounded-md border border-stone-200 p-3">
                  <p className="font-medium">{staff.name}</p>
                  <p>{staff.email}</p>
                  <p>
                    {staff.role} {staff.organizationName ? `- ${staff.organizationName}` : ''}
                  </p>
                  <p className="text-stone-500">{staff.isActive ? 'Active' : 'Inactive'}</p>
                  <button
                    type="button"
                    onClick={() => void handleToggleUser(staff)}
                    className="mt-2 rounded border border-stone-300 px-2 py-1 text-xs"
                  >
                    {staff.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </li>
              ))}
            </ul>

            <form className="mt-6 space-y-3" onSubmit={handleCreateUser}>
              <h3 className="text-sm font-semibold text-stone-800">Create Director / Manager</h3>
              <input
                placeholder="Name"
                value={userForm.name}
                onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Email"
                value={userForm.email}
                onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Phone"
                value={userForm.phone}
                onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <select
                value={userForm.role}
                onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value as AdminUserRole }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="MANAGER">MANAGER</option>
                <option value="DIRECTOR">DIRECTOR</option>
              </select>
              {userForm.role === 'MANAGER' ? (
                <select
                  value={userForm.organizationId}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, organizationId: event.target.value }))}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="">Select branch</option>
                  {branches.map((branch) => (
                    <option value={branch.id} key={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                placeholder="Temporary Password"
                value={userForm.temporaryPassword}
                onChange={(event) => setUserForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                type="password"
              />
              <button className="rounded bg-stone-900 px-3 py-2 text-sm text-white" type="submit">
                Create Account
              </button>
            </form>
          </article>
        </div>
      </section>
    </main>
  );
}
