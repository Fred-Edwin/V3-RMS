'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Pencil, Shield, FileText, Image as ImageIcon, Calendar, User,
  AlertTriangle, Lock, ArrowLeftRight, ScrollText, Upload, Trash2, Link2, Eye,
} from 'lucide-react';
import {
  PageLayout, Button, Modal, Input, Select, ExcelTable, ConfirmDialog, type ExcelColumn,
} from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import {
  getEmployeeProfile, updateEmployeeProfile,
  getDisciplinaryRecords, getHrDocuments,
  listContractTypes, assignContract, uploadHrDocument, deleteHrDocument,
} from '@/services/hrService';
import { staffService } from '@/services/staffService';
import type { StaffDto } from '@/services/staffService';
import type {
  EmployeeProfile, DisciplinaryRecord, HrDocument, EmploymentType,
  ContractType, HrDocumentType,
} from '@/types/hr';
import {
  roleLabel, employmentTypeLabel,
} from '@/components/hr/LeaveTypeBadge';
import { LeaveTab } from './LeaveTab';
import { DisciplinaryTab } from './DisciplinaryTab';
import { staffTransferService, type StaffTransfer } from '@/services/staffTransferService';
import type { AppRole } from '@/types/auth';

type Tab = 'overview' | 'leave' | 'disciplinary' | 'documents' | 'transfers';

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
  const [transfers, setTransfers] = useState<StaffTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── Contract assignment (HR only) ──
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [assigningContract, setAssigningContract] = useState(false);

  // ── Document upload ──
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<HrDocumentType>('CONTRACT');
  const [uploading, setUploading] = useState(false);
  const [documentFilter, setDocumentFilter] = useState<'ALL' | HrDocumentType>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<HrDocument | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);

  const [editForm, setEditForm] = useState({
    jobTitle: '',
    employmentType: '' as EmploymentType | '',
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
      const [p, d, docs, staff, transferHistory] = await Promise.all([
        getEmployeeProfile(userId, accessToken),
        getDisciplinaryRecords(userId, accessToken),
        getHrDocuments(userId, accessToken),
        staffService.listStaff(accessToken, { isActive: true }),
        staffTransferService.getTransferHistory(userId, accessToken),
      ]);
      setProfile(p);
      setDisciplinaryRecords(d);
      setDocuments(docs);
      setTransfers(transferHistory);
      // Only roles that can be a reporting manager
      setManagers(staff.filter((s) => ['MANAGER', 'HR_MANAGER', 'DIRECTOR'].includes(s.role)));
      setSelectedContractId(p.contractTypeId ?? '');
      setEditForm({
        jobTitle: p.jobTitle ?? '',
        employmentType: p.employmentType ?? '',
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

  // Contract types are HR-only; include inactive so a currently-assigned but
  // deactivated contract still resolves to its policy details.
  useEffect(() => {
    if (!accessToken || !isHrAuth) return;
    void listContractTypes(accessToken, true).then(setContractTypes).catch(() => undefined);
  }, [accessToken, isHrAuth]);

  const handleAssignContract = async (): Promise<void> => {
    if (!accessToken || !userId) return;
    setAssigningContract(true);
    try {
      await assignContract(userId, selectedContractId || null, accessToken);
      toast({
        variant: 'success',
        title: selectedContractId ? 'Contract assigned' : 'Contract cleared',
        message: selectedContractId
          ? 'Leave balances for this year have been synced from the contract policy.'
          : 'Existing leave balances were left unchanged.',
      });
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to update contract', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setAssigningContract(false);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!accessToken || !userId || !uploadFile) return;
    setUploading(true);
    try {
      await uploadHrDocument(
        { file: uploadFile, employeeUserId: userId, documentType: uploadType },
        accessToken,
      );
      toast({ variant: 'success', title: 'Document uploaded' });
      setUploadFile(null);
      setDocuments(await getHrDocuments(userId, accessToken));
    } catch (err) {
      toast({ variant: 'error', title: 'Upload failed', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (): Promise<void> => {
    if (!accessToken || !userId || !deleteTarget) return;
    setDeletingDocument(true);
    try {
      await deleteHrDocument(deleteTarget.id, accessToken);
      toast({ variant: 'success', title: 'Document deleted' });
      setDeleteTarget(null);
      setDocuments(await getHrDocuments(userId, accessToken));
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to delete document', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setDeletingDocument(false);
    }
  };

  const handleEdit = async () => {
    if (!accessToken || !userId) return;
    setEditSubmitting(true);
    try {
      await updateEmployeeProfile(userId, {
        jobTitle: editForm.jobTitle || undefined,
        employmentType: editForm.employmentType || undefined,
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

  const isImageDocument = (doc: HrDocument): boolean => /\.(jpe?g|png)$/i.test(doc.fileName);
  const isLinkedDocument = (doc: HrDocument): boolean =>
    Boolean(doc.disciplinaryRecordId || doc.leaveRequestId);

  const filteredDocuments = documents.filter((d) => {
    if (documentFilter === 'ALL') return true;
    if (documentFilter === 'WARNING_LETTER' || documentFilter === 'INCIDENT_REPORT') {
      return d.documentType === 'WARNING_LETTER' || d.documentType === 'INCIDENT_REPORT';
    }
    return d.documentType === documentFilter;
  });

  const documentColumns: ExcelColumn<HrDocument>[] = [
    {
      key: 'file',
      label: 'File',
      render: (d) => (
        <div className="flex items-center gap-2 min-w-[160px]">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F5F0E8]">
            {isImageDocument(d)
              ? <ImageIcon size={13} className="text-[#2C1810]" />
              : <FileText size={13} className="text-[#2C1810]" />}
          </div>
          <span className="truncate font-medium text-stone-800">{d.fileName}</span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (d) => <span className="whitespace-nowrap">{d.documentType.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'uploadedBy',
      label: 'Uploaded By',
      render: (d) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>{d.uploadedBy.name}</span>
          {d.uploadedBy.id === profile.userId && (
            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              Self
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (d) => (
        <span className="whitespace-nowrap text-stone-600">
          {new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'linkedTo',
      label: 'Linked To',
      render: (d) =>
        isLinkedDocument(d) ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-label-sm font-medium text-[#92400E]">
            <Link2 size={11} />
            {d.disciplinaryRecordId ? 'Disciplinary' : 'Leave request'}
          </span>
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      width: 70,
      render: (d) => (
        <div className="flex items-center justify-end gap-0.5">
          <a
            href={d.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label={`View ${d.fileName}`}
            title="View"
          >
            <Eye size={13} />
          </a>
          {isHrAuth && (
            <button
              type="button"
              onClick={() => !isLinkedDocument(d) && setDeleteTarget(d)}
              disabled={isLinkedDocument(d)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-stone-400"
              aria-label={`Delete ${d.fileName}`}
              title={isLinkedDocument(d) ? 'Linked documents cannot be deleted' : 'Delete'}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'disciplinary', label: 'Disciplinary', icon: Shield },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
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
                {profile.contractType ? (
                  <span className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-label-sm text-stone-600">
                    <ScrollText size={11} />
                    {profile.contractType.name}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-[#FDF3DC] px-2.5 py-0.5 text-label-sm text-[#92650A]">
                    <ScrollText size={11} />
                    No contract assigned
                  </span>
                )}
                {profile.employmentType && (
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-label-sm text-stone-600">
                    {employmentTypeLabel(profile.employmentType)}
                  </span>
                )}
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
          <InfoCard title="Banking & Statutory">
            <InfoRow label="KRA PIN" value={profile.kraPIN} />
            <InfoRow label="Bank" value={profile.bankName} />
            <InfoRow label="Account Name" value={profile.accountName} />
            <InfoRow label="Account Number" value={profile.accountNumber} />
            <InfoRow label="Bank Branch" value={profile.bankBranch} />
            <InfoRow label="HELB Number" value={profile.helbNumber} />
          </InfoCard>

          {/* ── Contract & Leave Policy (HR-only management) ─────────────── */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <ScrollText size={15} className="text-stone-500" />
              <h3 className="text-label-md font-semibold text-stone-700">Contract & Leave Policy</h3>
            </div>
            {isHrAuth ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-64">
                    <Select
                      label="Contract Type"
                      value={selectedContractId}
                      onChange={(e) => setSelectedContractId(e.target.value)}
                      options={[
                        { value: '', label: '— No contract —' },
                        ...contractTypes
                          .filter((ct) => ct.isActive || ct.id === profile.contractTypeId)
                          .map((ct) => ({
                            value: ct.id,
                            label: `${ct.name}${ct.durationMonths ? ` (${ct.durationMonths} mo)` : ''}${ct.isActive ? '' : ' — inactive'}`,
                          })),
                      ]}
                    />
                  </div>
                  <Button
                    onClick={() => void handleAssignContract()}
                    isLoading={assigningContract}
                    disabled={selectedContractId === (profile.contractTypeId ?? '')}
                  >
                    {selectedContractId ? 'Assign Contract' : 'Clear Contract'}
                  </Button>
                  {contractTypes.length === 0 && (
                    <button
                      onClick={() => router.push('/app/hr/contract-types')}
                      className="text-label-sm font-medium text-stone-500 underline underline-offset-2 hover:text-stone-700"
                    >
                      No contract types defined yet — create one
                    </button>
                  )}
                </div>

                {(() => {
                  const selected = contractTypes.find((ct) => ct.id === selectedContractId);
                  if (!selected) return null;
                  return (
                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                      <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-stone-400">
                        Leave entitlement under {selected.name}
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {selected.leavePolicies.map((p) => (
                          <span key={p.id} className="text-body-sm text-stone-700">
                            <span className="font-semibold tabular-nums">{p.totalDays}</span>{' '}
                            <span className="text-stone-500">{p.leaveType.toLowerCase()} days</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <p className="text-caption text-stone-400">
                  Assigning a contract syncs this year&apos;s leave balances to the contract&apos;s policy (used and pending
                  days are preserved). For one-off adjustments, use the pencil icon on the balance cards in the Leave tab.
                </p>
              </div>
            ) : (
              <p className="text-body-sm text-stone-600">
                {profile.contractType
                  ? `${profile.contractType.name}${profile.contractType.durationMonths ? ` (${profile.contractType.durationMonths} months)` : ''}`
                  : 'No contract assigned yet.'}
              </p>
            )}
          </div>
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
          {/* Upload form — page is only reachable by HR and managers, both may upload */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Upload size={15} className="text-stone-500" />
              <h3 className="text-label-md font-semibold text-stone-700">Upload Document</h3>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-56">
                <Select
                  label="Document Type"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as HrDocumentType)}
                  options={[
                    { value: 'CONTRACT', label: 'Contract' },
                    { value: 'ID_COPY', label: 'ID Copy' },
                    { value: 'CERTIFICATE', label: 'Certificate' },
                    { value: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
                    { value: 'INCIDENT_REPORT', label: 'Incident Report' },
                    { value: 'WARNING_LETTER', label: 'Warning Letter' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
              </div>
              <div className="min-w-52 flex-1">
                <label className="mb-1.5 block text-label-sm font-medium text-stone-700">File (PDF, JPG, or PNG — max 10 MB)</label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-body-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#F5F0E8] file:px-3 file:py-2 file:text-label-sm file:font-semibold file:text-[#2C1810] hover:file:bg-[#EDE7DC]"
                />
              </div>
              <Button
                onClick={() => void handleUpload()}
                isLoading={uploading}
                disabled={!uploadFile}
                className="flex items-center gap-1.5"
              >
                <Upload size={13} />
                Upload
              </Button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'CONTRACT', label: 'Contract' },
                { id: 'ID_COPY', label: 'ID' },
                { id: 'CERTIFICATE', label: 'Certificates' },
                { id: 'MEDICAL_CERTIFICATE', label: 'Medical' },
                { id: 'WARNING_LETTER', label: 'Disciplinary' },
                { id: 'INCIDENT_REPORT', label: 'Disciplinary' },
                { id: 'OTHER', label: 'Other' },
              ] as { id: 'ALL' | HrDocumentType; label: string }[]
            )
              .filter((f, i, arr) => arr.findIndex((x) => x.label === f.label) === i)
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDocumentFilter(f.id)}
                  className={`rounded-full px-3 py-1 text-label-sm font-medium transition-colors ${
                    documentFilter === f.id
                      ? 'bg-[#2C1810] text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
          </div>

          <ExcelTable
            columns={documentColumns}
            rows={filteredDocuments}
            rowKey={(d) => d.id}
            numbered
            headerTone="navy"
            emptyState={
              <div className="text-center">
                <FileText size={28} className="mx-auto mb-2 text-stone-300" />
                <p className="text-heading-sm font-semibold text-stone-700">No documents</p>
                <p className="mt-1 text-body-sm text-stone-400">
                  {documentFilter === 'ALL'
                    ? 'No documents have been attached to this profile.'
                    : 'No documents match this filter.'}
                </p>
              </div>
            }
          />
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-heading-sm font-semibold text-stone-900">Transfer History</h3>
            <p className="mt-0.5 text-body-sm text-stone-400">All branch transfers for this staff member.</p>
          </div>
          {transfers.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <ArrowLeftRight size={24} className="mx-auto mb-2 text-stone-300" />
              <p className="text-heading-sm font-semibold text-stone-700">No transfers yet</p>
              <p className="mt-1 text-body-sm text-stone-400">This staff member has not been transferred between branches.</p>
            </div>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">From</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">To</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Date</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Authorized By</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3.5 font-medium text-stone-800">{t.fromOrganization.name}</td>
                    <td className="px-4 py-3.5 font-medium text-stone-800">{t.toOrganization.name}</td>
                    <td className="px-4 py-3.5 text-stone-500">
                      {new Date(t.transferredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3.5 text-stone-500">{t.authorizedBy.name}</td>
                    <td className="px-4 py-3.5 text-stone-400">{t.notes ?? <span className="text-stone-200">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              onChange={(e) => setEditForm((p) => ({ ...p, employmentType: e.target.value as EmploymentType | '' }))}
              options={[
                { value: '', label: '— Not set —' },
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

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteDocument()}
        title="Delete document?"
        description={`Delete ${deleteTarget?.fileName ?? 'this document'}? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deletingDocument}
      />
    </PageLayout>
  );
}
