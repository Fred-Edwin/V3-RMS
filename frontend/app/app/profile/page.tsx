'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Bell, BellOff, ShieldCheck, User, Building2 } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, Input, PageLayout, SupportContact } from '@/components/ui';
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

const roleLabels: Record<AppRole, string> = {
  SYSTEM_ADMIN: 'System Admin',
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  KITCHEN_DISPLAY: 'Kitchen Display',
  BARISTA_DISPLAY: 'Barista Display',
  HR_MANAGER: 'HR Manager',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label-sm uppercase tracking-wider text-stone-400">{label}</span>
      <span className="text-body-md font-medium text-stone-900">{value || '—'}</span>
    </div>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-stone-200 bg-white shadow-sm ${className ?? ''}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 px-8 py-5 border-b border-stone-100">
      <span className="flex items-center justify-center size-9 rounded-lg bg-parchment text-stone-600">
        {icon}
      </span>
      <div>
        <h2 className="text-heading-sm font-sans font-semibold text-stone-900">{title}</h2>
        {subtitle && <p className="text-caption text-stone-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function Page(): JSX.Element {
  const router = useRouter();
  const { user, accessToken, setAuth, role } = useAuthStore();
  const {
    isSupported: isFcmSupported,
    canPrompt: canPromptFcmPermission,
    isRegistering: isRegisteringFcmToken,
    permission: fcmPermission,
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
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      if (!user || !accessToken) return;

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
        setProfileStatus({ type: 'error', message });
      }
    };

    void loadProfile();
  }, [accessToken, role, user]);

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!user?.id || !accessToken) return;

    if (!canUseStaffProfileEndpoints(role)) {
      setProfileStatus({ type: 'error', message: 'Profile edits are not available for your role yet.' });
      return;
    }

    setLoading(true);
    setProfileStatus(null);
    try {
      const updated = await staffService.updateStaff(user.id, { name, phone }, accessToken);
      setProfile(updated);
      setAuth({ user: { ...user, name: updated.name }, accessToken });
      setProfileStatus({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error: unknown) {
      const message = error instanceof ApiError ? error.message : 'Failed to update profile.';
      setProfileStatus({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) return;

    if (!currentPassword || !newPassword) {
      setPasswordStatus({ type: 'error', message: 'Current and new password are required.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    setLoading(true);
    setPasswordStatus(null);
    try {
      await authService.changePassword({ currentPassword, newPassword }, accessToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 400) {
        setPasswordStatus({ type: 'error', message: error.message });
      } else {
        setPasswordStatus({ type: 'error', message: 'Failed to update password.' });
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

  const displayName = profile?.name ?? user?.name ?? '';
  const displayRole = role ? (roleLabels[role] ?? role) : '—';
  const displayEmail = profile?.email ?? user?.email ?? '—';
  const displayBranch = profile?.organizationName ?? user?.organizationName ?? '—';

  return (
    <>
      <PageLayout className="animate-fade-up">
        <div className="mx-auto max-w-2xl space-y-8 py-2">

          {/* Notifications card — always visible for staff roles */}
          {isFcmSupported && (
            <SectionCard>
              <SectionHeader icon={<Bell size={18} />} title="Push Notifications" subtitle="Receive alerts even when the app is in the background" />
              <div className="px-8 py-6">
                {fcmPermission === 'granted' && !canPromptFcmPermission && (
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EDFAF1]">
                      <Bell size={16} className="text-[#1A6B3C]" />
                    </span>
                    <div>
                      <p className="text-body-sm font-medium text-stone-900">Notifications enabled</p>
                      <p className="text-caption text-stone-500 mt-0.5">This device will receive order alerts in the background.</p>
                    </div>
                  </div>
                )}
                {canPromptFcmPermission && (
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FDF3DC]">
                      <Bell size={16} className="text-[#92650A]" />
                    </span>
                    <div className="flex-1">
                      <p className="text-body-sm font-medium text-stone-900">Notifications not enabled</p>
                      <p className="text-caption text-stone-500 mt-0.5">Enable push notifications to receive order-ready alerts when you&apos;re away from the app.</p>
                      <div className="mt-3 flex items-center gap-2">
                        <Button size="sm" onClick={() => void requestPermissionAndRegister()} isLoading={isRegisteringFcmToken}>
                          Enable Notifications
                        </Button>
                        <Button size="sm" variant="ghost" onClick={dismissPrompt} leftIcon={<BellOff size={14} />}>
                          Not now
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {fcmPermission === 'denied' && (
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FEF2F2]">
                      <BellOff size={16} className="text-[#991B1B]" />
                    </span>
                    <div>
                      <p className="text-body-sm font-medium text-stone-900">Notifications blocked</p>
                      <p className="text-caption text-stone-500 mt-0.5">
                        You blocked notifications for this site. To re-enable: tap the lock icon in your browser address bar → Notifications → Allow.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ── Identity Hero ── */}
          <SectionCard>
            <div className="flex flex-col items-center px-8 py-8 text-center">
              <Avatar name={displayName || 'U'} size="lg" className="size-20 text-heading-md mb-4 shrink-0" />
              <h1 className="font-display text-display-lg text-espresso leading-tight">
                {displayName || 'Unknown User'}
              </h1>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-3 py-1 text-label-sm font-medium text-stone-700 border border-stone-200">
                  <span className="size-1.5 rounded-full bg-[#1A6B3C] inline-block" />
                  {displayRole}
                </span>
                {displayBranch !== '—' && (
                  <span className="text-caption text-stone-500 flex items-center gap-1">
                    <Building2 size={12} />
                    {displayBranch}
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── Account Info ── */}
          <SectionCard>
            <SectionHeader icon={<User size={18} />} title="Account Information" subtitle="Your identity in the system" />
            <div className="px-8 py-6 space-y-5">
              <InfoRow label="Email" value={displayEmail} />
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <InfoRow label="Role" value={displayRole} />
                <InfoRow label="Branch" value={displayBranch} />
                <InfoRow label="Organisation" value={profile?.organizationName ?? user?.organizationName ?? '—'} />
              </div>
            </div>
          </SectionCard>

          {/* ── Edit Profile ── */}
          <SectionCard>
            <SectionHeader icon={<User size={18} />} title="Edit Profile" subtitle="Update your name and contact number" />
            <form className="px-8 py-6 space-y-5" onSubmit={handleSaveProfile}>
              {profileStatus && (
                <div className={`rounded-lg border px-4 py-3 text-body-sm ${
                  profileStatus.type === 'success'
                    ? 'border-[#86EFAC] bg-[#EDFAF1] text-[#1A6B3C]'
                    : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
                }`}>
                  {profileStatus.message}
                </div>
              )}
              <Input
                label="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading || !canUseStaffProfileEndpoints(role)}
              />
              <Input
                label="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 7XX XXX XXX"
                disabled={loading || !canUseStaffProfileEndpoints(role)}
              />
              <div className="pt-1">
                <Button
                  type="submit"
                  isLoading={loading}
                  disabled={!canUseStaffProfileEndpoints(role)}
                >
                  Save changes
                </Button>
              </div>
            </form>
          </SectionCard>

          {/* ── Security ── */}
          <SectionCard>
            <SectionHeader icon={<ShieldCheck size={18} />} title="Security" subtitle="Change your account password" />
            <form className="px-8 py-6 space-y-5" onSubmit={handleChangePassword}>
              {passwordStatus && (
                <div className={`rounded-lg border px-4 py-3 text-body-sm ${
                  passwordStatus.type === 'success'
                    ? 'border-[#86EFAC] bg-[#EDFAF1] text-[#1A6B3C]'
                    : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
                }`}>
                  {passwordStatus.message}
                </div>
              )}
              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
              <Input
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
              <div className="pt-1">
                <Button type="submit" isLoading={loading}>
                  Update password
                </Button>
              </div>
            </form>
          </SectionCard>

          {/* ── Support ── */}
          <SupportContact />

          {/* ── Sign Out ── */}
          <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-6 flex flex-col items-center text-center gap-4">
            <div className="size-11 rounded-full bg-white border border-[#FCA5A5] flex items-center justify-center">
              <LogOut size={18} className="text-[#991B1B]" />
            </div>
            <div>
              <p className="text-body-sm font-semibold text-[#991B1B]">Sign out</p>
              <p className="text-caption text-[#991B1B]/70 mt-0.5">You will need to sign in again to access the system.</p>
            </div>
            <Button
              variant="destructive"
              leftIcon={<LogOut size={16} />}
              onClick={() => setIsLogoutOpen(true)}
              className="w-full"
            >
              Log out of Wendo RMS
            </Button>
          </div>

        </div>
      </PageLayout>

      <ConfirmDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={() => void handleLogout()}
        title="Log out?"
        description="Are you sure you want to log out?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        isLoading={isLoggingOut}
      />
    </>
  );
}
