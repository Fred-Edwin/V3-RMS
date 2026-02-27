'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { UserCircle, UserCheck, UserX, Pencil } from 'lucide-react';
import { Button, EmptyState, Input, PageHeader, PageLayout, Select } from '@/components/ui';
import type { AppRole } from '@/types/auth';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';

type ManagerCreatableRole = Extract<AppRole, 'WAITER' | 'CHEF' | 'BARISTA' | 'KITCHEN_DISPLAY' | 'BARISTA_DISPLAY'>;

const roleLabel: Record<string, string> = {
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  KITCHEN_DISPLAY: 'Kitchen Display',
  BARISTA_DISPLAY: 'Barista Display',
  MANAGER: 'Manager',
  DIRECTOR: 'Director',
  SYSTEM_ADMIN: 'System Admin',
};

export default function Page(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);

  const [staff, setStaff] = useState<StaffDto[]>([]);
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
    } catch {
      setFormError('Failed to create staff account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (item: StaffDto): Promise<void> => {
    if (!accessToken) return;

    const name = window.prompt('Name', item.name);
    if (!name) return;

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
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-heading-sm font-semibold text-stone-900">Team Members</h2>
            <p className="mt-0.5 text-body-sm text-stone-500">
              {loading ? 'Loading…' : `${staff.length} staff account${staff.length === 1 ? '' : 's'}`}
            </p>
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
        ) : (
          <ul className="divide-y divide-stone-100">
            {staff.map((item) => (
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
                  <button
                    type="button"
                    onClick={() => void handleEdit(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-700"
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil size={14} />
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
    </PageLayout>
  );
}
