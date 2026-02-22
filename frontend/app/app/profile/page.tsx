'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authService } from '@/services/authService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

export default function Page(): JSX.Element {
  const { user, accessToken, setAuth } = useAuthStore();

  const [profile, setProfile] = useState<StaffDto | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      if (!user?.id || !accessToken) {
        return;
      }

      const data = await staffService.getById(user.id, accessToken);
      setProfile(data);
      setName(data.name);
      setPhone(data.phone ?? '');
    };

    void loadProfile();
  }, [accessToken, user?.id]);

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!user?.id || !accessToken) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const updated = await staffService.updateStaff(user.id, { name, phone }, accessToken);
      setProfile(updated);
      setAuth({
        user: {
          ...user,
          name: updated.name,
        },
        accessToken,
      });
      setStatusMessage('Profile updated successfully.');
    } catch {
      setErrorMessage('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    if (!currentPassword || !newPassword) {
      setErrorMessage('Current and new password are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await authService.changePassword({ currentPassword, newPassword }, accessToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatusMessage('Password updated successfully.');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 400) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to update password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 p-6 md:p-8">
      <section className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-stone-900">Profile</h1>
          <p className="mt-2 text-sm text-stone-600">Manage your personal account details.</p>

          {errorMessage ? (
            <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
          ) : null}
          {statusMessage ? (
            <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
              {statusMessage}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3 text-sm text-stone-700">
            <p>
              <span className="font-medium">Email:</span> {profile?.email ?? user?.email ?? '-'}
            </p>
            <p>
              <span className="font-medium">Role:</span> {profile?.role ?? user?.role ?? '-'}
            </p>
            <p>
              <span className="font-medium">Branch:</span> {profile?.organizationName ?? user?.organizationName ?? '-'}
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSaveProfile}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Phone</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Save Profile
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-900">Change Password</h2>
          <form className="mt-4 space-y-4" onSubmit={handleChangePassword}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Current Password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">New Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Confirm New Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Update Password
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
