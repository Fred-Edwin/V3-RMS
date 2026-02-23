'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AppRole } from '@/types/auth';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';

type ManagerCreatableRole = Extract<AppRole, 'WAITER' | 'CHEF' | 'BARISTA' | 'KITCHEN_DISPLAY' | 'BARISTA_DISPLAY'>;

export default function Page(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);

  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'WAITER' as ManagerCreatableRole,
    temporaryPassword: '',
  });

  useEffect(() => {
    if (!accessToken) {
      void hydrateSession();
    }
  }, [accessToken, hydrateSession]);

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

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setError(null);
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

      setForm({
        name: '',
        email: '',
        phone: '',
        role: 'WAITER',
        temporaryPassword: '',
      });
      await loadStaff();
    } catch {
      setError('Failed to create staff account.');
    }
  };

  const handleEdit = async (item: StaffDto): Promise<void> => {
    if (!accessToken) {
      setError('Session expired. Please sign in again.');
      return;
    }

    const name = window.prompt('Name', item.name);
    if (!name) {
      return;
    }

    const phone = window.prompt('Phone', item.phone ?? '');
    setError(null);
    try {
      await staffService.updateStaff(item.id, { name, phone: phone ?? undefined }, accessToken);
      await loadStaff();
    } catch {
      setError('Failed to update staff details.');
    }
  };

  const handleToggleActive = async (item: StaffDto): Promise<void> => {
    if (!accessToken) {
      setError('Session expired. Please sign in again.');
      return;
    }

    if (!window.confirm(`${item.isActive ? 'Deactivate' : 'Reactivate'} ${item.name}?`)) {
      return;
    }

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
    <main className="min-h-screen bg-stone-100 p-6 md:p-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-stone-900">Branch Staff Management</h1>
          <p className="mt-2 text-sm text-stone-600">Create and maintain staff accounts for your branch.</p>
          {loading ? <p className="mt-3 text-sm text-stone-500">Loading...</p> : null}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </header>

        <article className="rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">Current Staff</h2>
          <ul className="mt-4 space-y-3 text-sm text-stone-700">
            {staff.map((item) => (
              <li key={item.id} className="rounded-md border border-stone-200 p-3">
                <p className="font-medium">{item.name}</p>
                <p>{item.email}</p>
                <p>
                  {item.role} - {item.isActive ? 'Active' : 'Inactive'}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleEdit(item)}
                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(item)}
                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                  >
                    {item.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">Create Staff Account</h2>
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <input
              placeholder="Name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as ManagerCreatableRole }))}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="WAITER">WAITER</option>
              <option value="CHEF">CHEF</option>
              <option value="BARISTA">BARISTA</option>
              <option value="KITCHEN_DISPLAY">KITCHEN_DISPLAY</option>
              <option value="BARISTA_DISPLAY">BARISTA_DISPLAY</option>
            </select>
            <input
              type="password"
              placeholder="Temporary Password"
              value={form.temporaryPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded bg-stone-900 px-3 py-2 text-sm text-white">
              Create Staff
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
