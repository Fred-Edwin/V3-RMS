'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Pencil, Shield, FileText, Calendar, User,
  AlertTriangle, Lock,
} from 'lucide-react';
import { PageLayout, Button, Modal, Input, Select } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import {
  getEmployeeProfile, updateEmployeeProfile,
  getDisciplinaryRecords, getHrDocuments,
} from '@/services/hrService';
import { staffService } from '@/services/staffService';
import type { StaffDto } from '@/services/staffService';
import type { EmployeeProfile, DisciplinaryRecord, HrDocument, EmploymentType } from '@/types/hr';
import {
  roleLabel, employmentTypeLabel,
} from '@/components/hr/LeaveTypeBadge';
import { LeaveTab } from './LeaveTab';
import { DisciplinaryTab } from './DisciplinaryTab';
import type { AppRole } from '@/types/auth';

type Tab = 'overview' | 'leave' | 'disciplinary' | 'documents';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-label-sm text-stone-500">{label}</span>
      <span className="text-right text-body-sm text-stone-800">{value ?? <span className="text-stone-400">—</span>}</span>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-[#EDE7DC] p-4 shadow-sm">
      <h3 className="mb-1 text-label-md font-semibold text-stone-700">{title}</h3>
      <div className="divide-y divide-stone-200">{children}</div>
    </div>
  );
}

export default function EmployeeProfilePage(): JSX.Element {
  const { userId } = useParams<{ userId: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role) as AppRole | null;
  const { toast } = useToast();
  const router = useRouter();

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<DisciplinaryRecord[]>([]);
  const [documents, setDocuments] = useState<HrDocument[]>([]);
  const [managers, setManagers] = useState<StaffDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [editForm, setEditForm] = useState({
    jobTitle: '',
    employmentType: 'FULL_TIME' as EmploymentType,
    startDate: '',
    probationEndDate: '',
    endDate: '',
    dateOfBirth: '',
    nationalId: '',
    personalPhone: '',
    personalEmail: '',
    physicalAddress: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    reportingManagerId: '',
    notes: '',
  });

  const isHrAuth = role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';

  const load = useCallback(async () => {
    if (!accessToken || !userId) return;
    setLoading(true);
    try {
      const [p, d, docs, staff] = await Promise.all([
        getEmployeeProfile(userId, accessToken),
        getDisciplinaryRecords(userId, accessToken),
        getHrDocuments(userId, accessToken),
        staffService.listStaff(accessToken, { isActive: true }),
      ]);
      setProfile(p);
      setDisciplinaryRecords(d);
      setDocuments(docs);
      // Only roles that can be a reporting manager
      setManagers(staff.filter((s) => ['MANAGER', 'HR_MANAGER', 'DIRECTOR'].includes(s.role)));
      setEditForm({
        jobTitle: p.jobTitle ?? '',
        employmentType: p.employmentType,
        startDate: p.startDate.slice(0, 10),
        probationEndDate: p.probationEndDate?.slice(0, 10) ?? '',
        endDate: p.endDate?.slice(0, 10) ?? '',
        dateOfBirth: p.dateOfBirth?.slice(0, 10) ?? '',
        nationalId: p.nationalId ?? '',
        personalPhone: p.personalPhone ?? '',
        personalEmail: p.personalEmail ?? '',
        physicalAddress: p.physicalAddress ?? '',
        emergencyName: p.emergencyName ?? '',
        emergencyRelation: p.emergencyRelation ?? '',
        emergencyPhone: p.emergencyPhone ?? '',
        reportingManagerId: p.reportingManagerId ?? '',
        notes: p.notes ?? '',
      });
    } catch {
      toast({ variant: 'error', title: 'Failed to load employee profile' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, userId, toast]);

  useEffect(() => { void load(); }, [load]);

  const handleEdit = async () => {
    if (!accessToken || !userId) return;
    setEditSubmitting(true);
    try {
      await updateEmployeeProfile(userId, {
        jobTitle: editForm.jobTitle || undefined,
        employmentType: editForm.employmentType,
        startDate: editForm.startDate ? new Date(editForm.startDate).toISOString() : undefined,
        dateOfBirth: editForm.dateOfBirth ? new Date(editForm.dateOfBirth).toISOString() : undefined,
        probationEndDate: editForm.probationEndDate ? new Date(editForm.probationEndDate).toISOString() : undefined,
        endDate: editForm.endDate ? new Date(editForm.endDate).toISOString() : undefined,
        nationalId: editForm.nationalId || undefined,
        personalPhone: editForm.personalPhone || undefined,
        personalEmail: editForm.personalEmail || undefined,
        physicalAddress: editForm.physicalAddress || undefined,
        emergencyName: editForm.emergencyName || undefined,
        emergencyRelation: editForm.emergencyRelation || undefined,
        emergencyPhone: editForm.emergencyPhone || undefined,
        reportingManagerId: editForm.reportingManagerId || undefined,
        notes: editForm.notes || undefined,
      }, accessToken);
      toast({ variant: 'success', title: 'Profile updated' });
      setEditOpen(false);
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to update', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-24 rounded-xl bg-stone-200" />
          <div className="h-48 rounded-xl bg-stone-100" />
        </div>
      </PageLayout>
    );
  }

  if (!profile) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-heading-md text-stone-700">Profile not found</p>
          <Button variant="secondary" onClick={() => router.back()}>Go back</Button>
        </div>
      </PageLayout>
    );
  }

  const startDate = new Date(profile.startDate);
  const now = new Date();
  const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
  const tenure = monthsDiff >= 12
    ? `${Math.floor(monthsDiff / 12)} yr${Math.floor(monthsDiff / 12) > 1 ? 's' : ''} ${monthsDiff % 12} mo`
    : `${monthsDiff} mo`;

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'disciplinary', label: 'Disciplinary', icon: Shield },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  return (
    <PageLayout className="animate-fade-up space-y-5">
      {/* Back nav */}
      <button
        onClick={() => router.push('/app/hr/staff')}
        className="flex items-center gap-1.5 text-label-sm text-stone-500 transition-colors hover:text-stone-800"
      >
        <ChevronLeft size={15} /> All Profiles
      </button>

      {/* Profile header card */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#2C1810] font-display text-display-lg font-semibold text-[#F5F0E8]">
              {profile.user.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="font-display text-display-lg font-semibold text-[#2C1810]">
                {profile.user.name}
              </h1>
              <p className="mt-0.5 text-body-sm text-stone-500">
                {profile.jobTitle ?? roleLabel(profile.user.role)}
                {profile.user.organization ? ` · ${profile.user.organization.name}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-medium ${
                  profile.user.isActive ? 'bg-[#EDFAF1] text-[#1A6B3C]' : 'bg-stone-100 text-stone-500'
                }`}>
                  {profile.user.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-label-sm text-stone-600">
                  {employmentTypeLabel(profile.employmentType)}
                </span>
                <span className="text-label-sm text-stone-400">
                  Started {startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {tenure}
                </span>
                {profile.probationEndDate && new Date(profile.probationEndDate) > now && (
                  <span className="flex items-center gap-1 rounded-full bg-[#FDF3DC] px-2.5 py-0.5 text-label-sm text-[#92650A]">
                    <AlertTriangle size={11} />
                    Probation ends {new Date(profile.probationEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          {isHrAuth && (
            <Button variant="secondary" onClick={() => setEditOpen(true)} className="flex items-center gap-1.5">
              <Pencil size={13} /> Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-label-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-white text-[#2C1810] shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <InfoCard title="Personal Details">
            <InfoRow label="National ID" value={profile.nationalId} />
            <InfoRow label="Date of Birth" value={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-GB') : null} />
            <InfoRow label="Personal Phone" value={profile.personalPhone} />
            <InfoRow label="Personal Email" value={profile.personalEmail} />
            <InfoRow label="Address" value={profile.physicalAddress} />
          </InfoCard>
          <InfoCard title="Emergency Contact">
            <InfoRow label="Name" value={profile.emergencyName} />
            <InfoRow label="Relationship" value={profile.emergencyRelation} />
            <InfoRow label="Phone" value={profile.emergencyPhone} />
          </InfoCard>
          <InfoCard title="Employment Details">
            <InfoRow label="Role" value={roleLabel(profile.user.role)} />
            <InfoRow label="Job Title" value={profile.jobTitle} />
            <InfoRow label="Employment Type" value={employmentTypeLabel(profile.employmentType)} />
            <InfoRow label="Start Date" value={startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
            {profile.endDate && <InfoRow label="End Date" value={new Date(profile.endDate).toLocaleDateString('en-GB')} />}
            <InfoRow label="Reporting Manager" value={profile.reportingManager?.name} />
            <InfoRow label="Branch" value={profile.user.organization?.name} />
          </InfoCard>
          {isHrAuth && profile.notes && (
            <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-1.5 text-label-sm font-semibold text-[#92400E]">
                <Lock size={12} /> HR Notes — only visible to HR and Directors
              </div>
              <p className="whitespace-pre-wrap text-body-sm text-[#78350F]">{profile.notes}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'leave' && (
        <LeaveTab userId={userId} profile={profile} />
      )}

      {activeTab === 'disciplinary' && (
        <DisciplinaryTab
          userId={userId}
          employeeName={profile.user.name}
          records={disciplinaryRecords}
          role={role}
          onRecordAdded={(record) => setDisciplinaryRecords((prev) => [record, ...prev])}
        />
      )}

      {activeTab === 'documents' && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-5 py-10 shadow-sm text-center">
              <FileText size={28} className="mx-auto mb-2 text-stone-300" />
              <p className="text-heading-sm font-semibold text-stone-700">No documents yet</p>
              <p className="mt-1 text-body-sm text-stone-400">No documents have been attached to this profile.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5F0E8]">
                    <FileText size={18} className="text-[#2C1810]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-stone-800">{doc.fileName}</p>
                    <p className="text-caption text-stone-500">{doc.documentType.replace(/_/g, ' ')}</p>
                    <p className="text-caption text-stone-400">
                      {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Employee Profile"
        maxWidth="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={editSubmitting}>Cancel</Button>
            <Button onClick={() => void handleEdit()} isLoading={editSubmitting}>Save Changes</Button>
          </div>
        }
      >
        <div className="space-y-5">
          <p className="text-label-sm font-semibold text-stone-500 uppercase tracking-wide">Employment Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Job Title" value={editForm.jobTitle} onChange={(e) => setEditForm((p) => ({ ...p, jobTitle: e.target.value }))} />
            <Select
              label="Employment Type"
              value={editForm.employmentType}
              onChange={(e) => setEditForm((p) => ({ ...p, employmentType: e.target.value as EmploymentType }))}
              options={[
                { value: 'FULL_TIME', label: 'Full-time' },
                { value: 'PART_TIME', label: 'Part-time' },
                { value: 'CASUAL', label: 'Casual' },
              ]}
            />
            <Input label="Start Date" type="date" value={editForm.startDate} onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))} />
            <Input label="End Date (if applicable)" type="date" value={editForm.endDate} onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))} />
            <Select
              label="Reporting Manager"
              value={editForm.reportingManagerId}
              onChange={(e) => setEditForm((p) => ({ ...p, reportingManagerId: e.target.value }))}
              options={[
                { value: '', label: '— None —' },
                ...managers.map((m) => ({ value: m.id, label: `${m.name} (${roleLabel(m.role)})` })),
              ]}
            />
          </div>
          <hr className="border-stone-200" />
          <p className="text-label-sm font-semibold text-stone-500 uppercase tracking-wide">Personal Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="National ID" value={editForm.nationalId} onChange={(e) => setEditForm((p) => ({ ...p, nationalId: e.target.value }))} />
            <Input label="Date of Birth" type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
            <Input label="Personal Phone" value={editForm.personalPhone} onChange={(e) => setEditForm((p) => ({ ...p, personalPhone: e.target.value }))} />
            <Input label="Personal Email" type="email" value={editForm.personalEmail} onChange={(e) => setEditForm((p) => ({ ...p, personalEmail: e.target.value }))} />
            <Input label="Physical Address" value={editForm.physicalAddress} onChange={(e) => setEditForm((p) => ({ ...p, physicalAddress: e.target.value }))} />
          </div>
          <hr className="border-stone-200" />
          <p className="text-label-sm font-semibold text-stone-500 uppercase tracking-wide">Emergency Contact</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Name" value={editForm.emergencyName} onChange={(e) => setEditForm((p) => ({ ...p, emergencyName: e.target.value }))} />
            <Input label="Relationship" value={editForm.emergencyRelation} onChange={(e) => setEditForm((p) => ({ ...p, emergencyRelation: e.target.value }))} />
            <Input label="Phone" value={editForm.emergencyPhone} onChange={(e) => setEditForm((p) => ({ ...p, emergencyPhone: e.target.value }))} />
          </div>
          <hr className="border-stone-200" />
          <div>
            <label className="block text-label-sm font-medium text-stone-700 mb-1">
              HR Notes <span className="ml-1 text-caption text-stone-400">(only visible to HR and Directors)</span>
            </label>
            <textarea
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full resize-none rounded-md border border-stone-200 bg-[#FFFBEB] px-3 py-2 text-body-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
