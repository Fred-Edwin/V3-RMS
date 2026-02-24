'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog, Input, PageHeader, PageLayout } from '@/components/ui';
import { useFcmToken } from '@/hooks/useFcmToken';
import { performLogout } from '@/lib/logout';
import { authService } from '@/services/authService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { AppRole } from '@/types/auth';

const canUseStaffProfileEndpoints = (role: AppRole | null): boolean => {
  return role === 'MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
};

export default function Page(): JSX.Element {
  const router = useRouter();
  const { user, accessToken, setAuth, role } = useAuthStore();
  const {
    canPrompt: canPromptFcmPermission,
    isRegistering: isRegisteringFcmToken,
    requestPermissionAndRegister,
    dismissPrompt,
  } = useFcmToken();

  const [profile, setProfile] = useState<StaffDto | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      if (!user || !accessToken) {
        return;
      }

      if (!canUseStaffProfileEndpoints(role)) {
        setProfile(null);
        setName(user.name);
        setPhone('');
        return;
      }

      try {
        const data = await staffService.getById(user.id, accessToken);
        setProfile(data);
        setName(data.name);
        setPhone(data.phone ?? '');
      } catch (error: unknown) {
        const message = error instanceof ApiError ? error.message : 'Failed to load profile.';
        setErrorMessage(message);
      }
    };

    void loadProfile();
  }, [accessToken, role, user]);

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!user?.id || !accessToken) {
      return;
    }

    if (!canUseStaffProfileEndpoints(role)) {
      setErrorMessage('Profile edits are not available for your role yet.');
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
    } catch (error: unknown) {
      const message = error instanceof ApiError ? error.message : 'Failed to update profile.';
      setErrorMessage(message);
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

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await performLogout();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
      setIsLogoutOpen(false);
    }
  };

  return (
    <>
    <PageLayout className="animate-fade-up space-y-6">
      <section className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Profile" subtitle="Manage your personal account details." />

        {canPromptFcmPermission && (
          <div className="rounded-md border border-[#F0D080] bg-[#FDF3DC] p-3">
            <p className="text-body-sm text-[#92650A]">
              Turn on notifications for ready-order alerts while you are away from the app.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => void requestPermissionAndRegister()}
                isLoading={isRegisteringFcmToken}
              >
                Enable Notifications
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissPrompt}>
                Not now
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">

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

          <div className="mt-6 border-t border-stone-200 pt-4">
            <Button type="button" variant="destructive" onClick={() => setIsLogoutOpen(true)}>
              Log Out
            </Button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSaveProfile}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Phone</span>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={loading || !canUseStaffProfileEndpoints(role)}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Save Profile
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-900">Change Password</h2>
          <form className="mt-4 space-y-4" onSubmit={handleChangePassword}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Current Password</span>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">New Password</span>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Confirm New Password</span>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <Button
              type="submit"
              disabled={loading}
            >
              Update Password
            </Button>
          </form>
        </div>
      </section>
    </PageLayout>
    <ConfirmDialog
      isOpen={isLogoutOpen}
      onClose={() => setIsLogoutOpen(false)}
      onConfirm={() => void handleLogout()}
      title="Log out?"
      description="Are you sure you want to log out?"
      confirmLabel="Log Out"
      cancelLabel="Cancel"
      isLoading={isLoggingOut}
    />
    </>
  );
}
