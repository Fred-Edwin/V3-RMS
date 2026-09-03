'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Bell, BellOff, ShieldCheck, User, Building2, ContactRound, FileText, Upload } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, Input, PageLayout, Select, SupportContact } from '@/components/ui';
import { useFcmToken } from '@/hooks/useFcmToken';
import { performLogout } from '@/lib/logout';
import { authService } from '@/services/authService';
import { staffService, type StaffDto } from '@/services/staffService';
import {
  getEmployeeProfile, updateMyEmployeeProfile, getHrDocuments, uploadHrDocument,
} from '@/services/hrService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { AppRole } from '@/types/auth';
import {
  SELF_UPLOADABLE_DOCUMENT_TYPES,
  type EmployeeProfile, type HrDocument, type HrDocumentType, type SelfServiceProfileInput,
} from '@/types/hr';

const canUseStaffProfileEndpoints = (role: AppRole | null): boolean => {
  return role === 'MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
};

// Roles whose accounts get an EmployeeProfile (mirror of backend PROFILE_EXCLUDED_ROLES)
const hasEmployeeProfile = (role: AppRole | null): boolean => {
  if (!role) return false;
  return !['DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'].includes(role);
};

const SELF_DOC_TYPE_LABELS: Record<string, string> = {
  ID_COPY: 'ID Copy',
  NATIONAL_ID_FRONT: 'National ID — Front',
  NATIONAL_ID_BACK: 'National ID — Back',
  CERTIFICATE: 'Certificate',
  MEDICAL_CERTIFICATE: 'Medical Certificate',
  OTHER: 'Other',
};

interface EmployeeDetailsForm {
  nationalId: string;
  dateOfBirth: string;
  personalPhone: string;
  personalEmail: string;
  physicalAddress: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  kraPIN: string;
  shifNhifNumber: string;
  nssfNumber: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankBranch: string;
  helbNumber: string;
}

const emptyDetailsForm: EmployeeDetailsForm = {
  nationalId: '', dateOfBirth: '', personalPhone: '', personalEmail: '', physicalAddress: '',
  emergencyName: '', emergencyRelation: '', emergencyPhone: '',
  kraPIN: '', shifNhifNumber: '', nssfNumber: '', bankName: '', accountName: '', accountNumber: '', bankBranch: '', helbNumber: '',
};

function detailsFormFrom(p: EmployeeProfile): EmployeeDetailsForm {
  return {
    nationalId: p.nationalId ?? '',
    dateOfBirth: p.dateOfBirth?.slice(0, 10) ?? '',
    personalPhone: p.personalPhone ?? '',
    personalEmail: p.personalEmail ?? '',
    physicalAddress: p.physicalAddress ?? '',
    emergencyName: p.emergencyName ?? '',
    emergencyRelation: p.emergencyRelation ?? '',
    emergencyPhone: p.emergencyPhone ?? '',
    kraPIN: p.kraPIN ?? '',
    shifNhifNumber: p.shifNhifNumber ?? '',
    nssfNumber: p.nssfNumber ?? '',
    bankName: p.bankName ?? '',
    accountName: p.accountName ?? '',
    accountNumber: p.accountNumber ?? '',
    bankBranch: p.bankBranch ?? '',
    helbNumber: p.helbNumber ?? '',
  };
}

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
  STEWARD: 'Steward',
  HOUSEKEEPING: 'Housekeeping',
  STORE_MANAGER: 'Store Manager',
  STORE_ATTENDANT: 'Store Attendant',
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
  const isDepartmentHead = useAuthStore((state) => state.isDepartmentHead);
  const departmentTag = useAuthStore((state) => state.departmentTag);
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

  // ── Self-service employee details ──
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [detailsForm, setDetailsForm] = useState<EmployeeDetailsForm>(emptyDetailsForm);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsStatus, setDetailsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── My documents ──
  const [myDocuments, setMyDocuments] = useState<HrDocument[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<HrDocumentType>('ID_COPY');
  const [docUploading, setDocUploading] = useState(false);

  const loadEmployeeProfile = useCallback(async (): Promise<void> => {
    if (!user || !accessToken || !hasEmployeeProfile(role)) return;
    try {
      const [p, docs] = await Promise.all([
        getEmployeeProfile(user.id, accessToken),
        getHrDocuments(user.id, accessToken),
      ]);
      setEmployeeProfile(p);
      setDetailsForm(detailsFormFrom(p));
      setMyDocuments(docs);
    } catch {
      // No employee profile (or no access) — hide the section rather than error
      setEmployeeProfile(null);
    }
  }, [user, accessToken, role]);

  useEffect(() => { void loadEmployeeProfile(); }, [loadEmployeeProfile]);

  const handleSaveEmployeeDetails = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) return;
    setDetailsSaving(true);
    setDetailsStatus(null);
    try {
      // Empty inputs are sent as null (clear); the backend rejects empty strings
      const toNullable = (v: string): string | null => (v.trim() === '' ? null : v.trim());
      const payload: SelfServiceProfileInput = {
        nationalId: toNullable(detailsForm.nationalId),
        dateOfBirth: detailsForm.dateOfBirth ? new Date(detailsForm.dateOfBirth).toISOString() : null,
        personalPhone: toNullable(detailsForm.personalPhone),
        personalEmail: toNullable(detailsForm.personalEmail),
        physicalAddress: toNullable(detailsForm.physicalAddress),
        emergencyName: toNullable(detailsForm.emergencyName),
        emergencyRelation: toNullable(detailsForm.emergencyRelation),
        emergencyPhone: toNullable(detailsForm.emergencyPhone),
        kraPIN: toNullable(detailsForm.kraPIN),
        shifNhifNumber: toNullable(detailsForm.shifNhifNumber),
        nssfNumber: toNullable(detailsForm.nssfNumber),
        bankName: toNullable(detailsForm.bankName),
        accountName: toNullable(detailsForm.accountName),
        accountNumber: toNullable(detailsForm.accountNumber),
        bankBranch: toNullable(detailsForm.bankBranch),
        helbNumber: toNullable(detailsForm.helbNumber),
      };
      const updated = await updateMyEmployeeProfile(payload, accessToken);
      setEmployeeProfile(updated);
      setDetailsForm(detailsFormFrom(updated));
      setDetailsStatus({ type: 'success', message: 'Your employee details have been saved.' });
    } catch (error: unknown) {
      const message = error instanceof ApiError ? error.message : 'Failed to save employee details.';
      setDetailsStatus({ type: 'error', message });
    } finally {
      setDetailsSaving(false);
    }
  };

  const handleUploadDocument = async (): Promise<void> => {
    if (!user || !accessToken || !docFile) return;
    setDocUploading(true);
    try {
      await uploadHrDocument(
        { file: docFile, employeeUserId: user.id, documentType: docType },
        accessToken,
      );
      setDocFile(null);
      setMyDocuments(await getHrDocuments(user.id, accessToken));
    } catch {
      setDetailsStatus({ type: 'error', message: 'Document upload failed. Only PDF, JPG, or PNG up to 10 MB.' });
    } finally {
      setDocUploading(false);
    }
  };

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

  const departmentLabels: Record<string, string> = {
    KITCHEN: 'Kitchen',
    PASTRY: 'Pastry',
    BARISTA: 'Barista',
    SERVICE: 'Service',
    HOUSEKEEPING: 'Housekeeping',
  };
  const displayName = profile?.name ?? user?.name ?? '';
  const baseRoleLabel = role ? (roleLabels[role] ?? role) : '—';
  const displayRole =
    isDepartmentHead && departmentTag
      ? `${baseRoleLabel} · Department Head (${departmentLabels[departmentTag] ?? departmentTag})`
      : baseRoleLabel;
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

          {/* ── Employee Details (self-service) ── */}
          {employeeProfile && (
            <SectionCard>
              <SectionHeader
                icon={<ContactRound size={18} />}
                title="Employee Details"
                subtitle="Fill in your personal, emergency, and banking details for HR"
              />
              <form className="px-8 py-6 space-y-6" onSubmit={handleSaveEmployeeDetails}>
                {detailsStatus && (
                  <div className={`rounded-lg border px-4 py-3 text-body-sm ${
                    detailsStatus.type === 'success'
                      ? 'border-[#86EFAC] bg-[#EDFAF1] text-[#1A6B3C]'
                      : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
                  }`}>
                    {detailsStatus.message}
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-label-sm font-semibold uppercase tracking-wide text-stone-500">Personal</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="National ID" value={detailsForm.nationalId} onChange={(e) => setDetailsForm((p) => ({ ...p, nationalId: e.target.value }))} />
                    <Input label="Date of Birth" type="date" value={detailsForm.dateOfBirth} onChange={(e) => setDetailsForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
                    <Input label="Personal Phone" value={detailsForm.personalPhone} onChange={(e) => setDetailsForm((p) => ({ ...p, personalPhone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
                    <Input label="Personal Email" type="email" value={detailsForm.personalEmail} onChange={(e) => setDetailsForm((p) => ({ ...p, personalEmail: e.target.value }))} />
                  </div>
                  <Input label="Physical Address" value={detailsForm.physicalAddress} onChange={(e) => setDetailsForm((p) => ({ ...p, physicalAddress: e.target.value }))} />
                </div>

                <div className="space-y-4">
                  <p className="text-label-sm font-semibold uppercase tracking-wide text-stone-500">Emergency Contact</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input label="Name" value={detailsForm.emergencyName} onChange={(e) => setDetailsForm((p) => ({ ...p, emergencyName: e.target.value }))} />
                    <Input label="Relationship" value={detailsForm.emergencyRelation} onChange={(e) => setDetailsForm((p) => ({ ...p, emergencyRelation: e.target.value }))} />
                    <Input label="Phone" value={detailsForm.emergencyPhone} onChange={(e) => setDetailsForm((p) => ({ ...p, emergencyPhone: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-label-sm font-semibold uppercase tracking-wide text-stone-500">Banking & Statutory</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="KRA PIN" value={detailsForm.kraPIN} onChange={(e) => setDetailsForm((p) => ({ ...p, kraPIN: e.target.value }))} />
                    <Input label="SHIF / NHIF Number" value={detailsForm.shifNhifNumber} onChange={(e) => setDetailsForm((p) => ({ ...p, shifNhifNumber: e.target.value }))} />
                    <Input label="NSSF Number" value={detailsForm.nssfNumber} onChange={(e) => setDetailsForm((p) => ({ ...p, nssfNumber: e.target.value }))} />
                    <Input label="HELB Number (if any)" value={detailsForm.helbNumber} onChange={(e) => setDetailsForm((p) => ({ ...p, helbNumber: e.target.value }))} />
                    <Input label="Bank Name" value={detailsForm.bankName} onChange={(e) => setDetailsForm((p) => ({ ...p, bankName: e.target.value }))} />
                    <Input label="Bank Branch" value={detailsForm.bankBranch} onChange={(e) => setDetailsForm((p) => ({ ...p, bankBranch: e.target.value }))} />
                    <Input label="Account Name" value={detailsForm.accountName} onChange={(e) => setDetailsForm((p) => ({ ...p, accountName: e.target.value }))} />
                    <Input label="Account Number" value={detailsForm.accountNumber} onChange={(e) => setDetailsForm((p) => ({ ...p, accountNumber: e.target.value }))} />
                  </div>
                </div>

                <div className="pt-1">
                  <Button type="submit" isLoading={detailsSaving}>
                    Save employee details
                  </Button>
                </div>
              </form>
            </SectionCard>
          )}

          {/* ── My Documents (self-service uploads) ── */}
          {employeeProfile && (
            <SectionCard>
              <SectionHeader
                icon={<FileText size={18} />}
                title="My Documents"
                subtitle="Upload your ID copy, certificates, or medical documents for your HR file"
              />
              <div className="px-8 py-6 space-y-5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-52">
                    <Select
                      label="Document Type"
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as HrDocumentType)}
                      options={SELF_UPLOADABLE_DOCUMENT_TYPES.map((t) => ({
                        value: t,
                        label: SELF_DOC_TYPE_LABELS[t] ?? t,
                      }))}
                    />
                  </div>
                  <div className="min-w-48 flex-1">
                    <label className="mb-1.5 block text-label-sm font-medium text-stone-700">File (PDF, JPG, or PNG — max 10 MB)</label>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-body-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-parchment file:px-3 file:py-2 file:text-label-sm file:font-semibold file:text-stone-700 hover:file:bg-stone-100"
                    />
                  </div>
                  <Button
                    onClick={() => void handleUploadDocument()}
                    isLoading={docUploading}
                    disabled={!docFile}
                    leftIcon={<Upload size={14} />}
                  >
                    Upload
                  </Button>
                </div>

                {myDocuments.length === 0 ? (
                  <p className="text-body-sm text-stone-400">No documents on file yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100">
                    {myDocuments.map((doc) => (
                      <li key={doc.id}>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50"
                        >
                          <FileText size={16} className="shrink-0 text-stone-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-medium text-stone-800">{doc.fileName}</p>
                            <p className="text-caption text-stone-400">
                              {doc.documentType.replace(/_/g, ' ')} · {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SectionCard>
          )}

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
