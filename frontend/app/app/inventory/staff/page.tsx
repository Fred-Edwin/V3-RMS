'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Plus, UserCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageLayout,
} from '@/components/ui';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/types/api';

interface AttendantForm {
  name: string;
  email: string;
  phone: string;
  temporaryPassword: string;
}

const initialForm: AttendantForm = { name: '', email: '', phone: '', temporaryPassword: '' };

export default function StoreStaffPage(): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();

  const [attendants, setAttendants] = useState<StaffDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<AttendantForm>(initialForm);

  const loadAttendants = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      // The backend scopes this to the Store Manager's own (hub) org.
      const staff = await staffService.listStaff(accessToken, { role: 'STORE_ATTENDANT' });
      setAttendants(staff);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load store staff.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadAttendants();
  }, [loadAttendants]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) return;

    setIsSubmitting(true);
    try {
      // No organizationId sent — the backend assigns the Central Store (hub)
      // organization for store roles.
      await staffService.createStaff(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          role: 'STORE_ATTENDANT',
          temporaryPassword: form.temporaryPassword,
        },
        accessToken,
      );
      setForm(initialForm);
      setIsModalOpen(false);
      toast({ variant: 'success', title: 'Attendant account created' });
      await loadAttendants();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create account.';
      toast({ variant: 'error', title: 'Create failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Store Staff"
        subtitle="Store Attendant accounts for the Central Store"
        action={
          <Button type="button" size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>
            Add Attendant
          </Button>
        }
      />

      {isLoading ? (
        <Card className="p-6 text-body-sm text-stone-500">Loading store staff…</Card>
      ) : attendants.length === 0 ? (
        <EmptyState
          icon={<UserCircle size={32} />}
          heading="No Store Attendants yet"
          body="Create the first attendant account — they handle receiving, prep entry, counts, and waste logging."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {attendants.map((attendant) => (
            <Card key={attendant.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-stone-900">{attendant.name}</p>
                <p className="truncate text-caption text-stone-400">{attendant.email}</p>
                {attendant.phone ? (
                  <p className="text-caption text-stone-400">{attendant.phone}</p>
                ) : null}
              </div>
              <Badge tone={attendant.isActive ? 'success' : 'neutral'}>
                {attendant.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Store Attendant"
      >
        <form onSubmit={(event) => void handleCreate(event)} className="flex flex-col gap-4">
          <FormField label="Name" htmlFor="attendant-name" required>
            <Input
              id="attendant-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Full name"
              required
            />
          </FormField>
          <FormField label="Email" htmlFor="attendant-email" required>
            <Input
              id="attendant-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="name@wendo.co.ke"
              required
            />
          </FormField>
          <FormField label="Phone" htmlFor="attendant-phone">
            <Input
              id="attendant-phone"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="07XX XXX XXX"
            />
          </FormField>
          <FormField label="Temporary Password" htmlFor="attendant-password" required>
            <div className="relative">
              <Input
                id="attendant-password"
                type={showPassword ? 'text' : 'password'}
                value={form.temporaryPassword}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))
                }
                placeholder="Minimum 8 characters"
                minLength={8}
                className="pr-10"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>
          <p className="text-caption text-stone-500">
            The account is assigned to the Central Store automatically. Share the temporary
            password with the attendant — they can change it from their Profile.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}
