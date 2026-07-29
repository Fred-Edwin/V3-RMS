'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, X, Search, User } from 'lucide-react';
import { Input, Textarea, Select, Spinner, Avatar } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { branchService, type BranchDto } from '@/services/branchService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onIssued: () => void;
}

type TargetMode = 'branch' | 'all-branches' | 'individual';

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'WAITER', label: 'Waiters' },
  { value: 'CHEF', label: 'Chefs' },
  { value: 'BARISTA', label: 'Baristas' },
  { value: 'MANAGER', label: 'Managers' },
  { value: 'ACCOUNTANT', label: 'Accountants' },
];

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  STORE_MANAGER: 'Store Manager',
  STORE_ATTENDANT: 'Store Attendant',
};

const ALLOWED_ROLES = new Set(['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'WAITER', 'CHEF', 'BARISTA', 'STORE_MANAGER', 'STORE_ATTENDANT']);

export function IssueNoticeModal({ isOpen, onClose, onIssued }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const [targetMode, setTargetMode] = useState<TargetMode>('branch');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [selectedIndividual, setSelectedIndividual] = useState<StaffDto | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [allStaff, setAllStaff] = useState<StaffDto[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  // Load branches + staff on open
  useEffect(() => {
    if (!isOpen || !accessToken) return;
    setTargetMode('branch');
    setTargetBranchId('');
    setTargetRole('');
    setSelectedIndividual(null);
    setSubject('');
    setBody('');
    setError(null);
    setStaffSearch('');

    branchService.listBranches(accessToken).then(setBranches).catch(() => {/* ignore */});

    setStaffLoading(true);
    staffService.listStaff(accessToken, { isActive: true })
      .then((results) => setAllStaff(results.filter((s) => s.id !== currentUserId && ALLOWED_ROLES.has(s.role))))
      .catch(() => {/* ignore */})
      .finally(() => setStaffLoading(false));
  }, [isOpen, accessToken, currentUserId]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return allStaff;
    return allStaff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (ROLE_LABELS[s.role] ?? s.role).toLowerCase().includes(q) ||
        (s.organizationName ?? '').toLowerCase().includes(q),
    );
  }, [allStaff, staffSearch]);

  const audienceHint = useCallback((): string => {
    if (targetMode === 'individual') {
      return selectedIndividual
        ? `${selectedIndividual.name} (${ROLE_LABELS[selectedIndividual.role] ?? selectedIndividual.role})`
        : 'Select a staff member below';
    }
    if (targetMode === 'all-branches') {
      const rolePart = ROLE_OPTIONS.find((r) => r.value === targetRole)?.label ?? 'All roles';
      return `${rolePart} across all branches`;
    }
    const rolePart = ROLE_OPTIONS.find((r) => r.value === targetRole)?.label ?? 'All roles';
    if (targetBranchId) {
      const b = branches.find((br) => br.id === targetBranchId);
      return `${rolePart} at ${b?.name ?? 'selected branch'}`;
    }
    return 'Select a branch to continue';
  }, [targetMode, targetBranchId, targetRole, selectedIndividual, branches]);

  const canSubmit =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (targetMode === 'all-branches' ||
      (targetMode === 'branch' && !!targetBranchId) ||
      (targetMode === 'individual' && !!selectedIndividual));

  const handleIssue = async () => {
    if (!accessToken || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await commsService.issueNotice(accessToken, {
        ...(targetMode === 'individual' && selectedIndividual
          ? { targetUserId: selectedIndividual.id }
          : targetMode === 'all-branches'
          ? { allBranches: true, targetRole: targetRole || undefined }
          : { targetBranchId: targetBranchId || undefined, targetRole: targetRole || undefined }),
        subject: subject.trim(),
        bodyHtml: `<p>${body.trim().replace(/\n/g, '</p><p>')}</p>`,
      });
      onIssued();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to issue notice';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }));

  return (
    <div className="flex flex-col h-full bg-[#F5F0E8]">
      {/* Header — espresso, consistent with broadcasts */}
      <div className="bg-[#2C1810] px-4 py-3 flex items-center shrink-0">
        <button type="button" onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <span className="flex-1 text-center text-white font-semibold text-base">Issue Notice</span>
        <div className="w-6" /> {/* spacer to keep title centred */}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Notice type explainer — espresso palette */}
        <div className="rounded-lg bg-[#EDE7DC] border border-[#D6D3D1] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-[#2C1810]" />
            <p className="text-sm font-medium text-[#2C1810]">Formal Notice</p>
          </div>
          <p className="text-xs text-[#2C1810]/70">
            Notices are permanently retained on the recipient&apos;s HR record and require explicit acknowledgement.
          </p>
        </div>

        {/* Targeting mode selector */}
        <div>
          <p className="text-xs font-semibold text-[#44403C] mb-2">Who should receive this notice?</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'branch', label: 'One branch' },
              { value: 'all-branches', label: 'All branches' },
              { value: 'individual', label: 'One person' },
            ] as { value: TargetMode; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTargetMode(value)}
                className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                  targetMode === value
                    ? 'bg-[#2C1810] border-[#2C1810] text-white'
                    : 'bg-white border-[#E8E0D5] text-[#44403C] hover:bg-[#F5F0E8]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Branch + role filter */}
        {targetMode === 'branch' && (
          <>
            <Select
              label="Target branch *"
              placeholder="Select a branch…"
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
              options={branchOptions}
            />
            <Select
              label="Target role"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              options={ROLE_OPTIONS}
            />
          </>
        )}

        {/* All-branches — optional role filter */}
        {targetMode === 'all-branches' && (
          <Select
            label="Target role (optional)"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            options={ROLE_OPTIONS}
          />
        )}

        {/* Individual picker */}
        {targetMode === 'individual' && (
          <div>
            <p className="text-xs font-semibold text-[#44403C] mb-2">Select staff member *</p>

            {selectedIndividual ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#2C1810]/30 bg-[#EDE7DC] px-3 py-2.5">
                <Avatar name={selectedIndividual.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2C1810] truncate">{selectedIndividual.name}</p>
                  <p className="text-xs text-[#8B7355]">
                    {ROLE_LABELS[selectedIndividual.role] ?? selectedIndividual.role}
                    {selectedIndividual.organizationName ? ` · ${selectedIndividual.organizationName}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIndividual(null)}
                  className="text-[#8B7355] hover:text-[#2C1810] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-[#E8E0D5] bg-white overflow-hidden">
                <div className="relative px-3 py-2 border-b border-[#E8E0D5]">
                  <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#C4B49A] pointer-events-none" />
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="Search by name or role…"
                    className="w-full pl-7 pr-3 py-1.5 text-sm bg-transparent text-[#2C1810] placeholder:text-[#C4B49A] focus:outline-none"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {staffLoading ? (
                    <div className="flex justify-center py-6"><Spinner /></div>
                  ) : filteredStaff.length === 0 ? (
                    <p className="text-center text-sm text-[#8B7355] py-6">
                      {staffSearch ? 'No staff match your search' : 'No colleagues found'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[#F0EBE3]">
                      {filteredStaff.map((person) => (
                        <li key={person.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedIndividual(person)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F5F0E8] transition-colors text-left"
                          >
                            <Avatar name={person.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#2C1810] truncate">{person.name}</p>
                              <p className="text-xs text-[#8B7355]">
                                {ROLE_LABELS[person.role] ?? person.role}
                                {person.organizationName ? ` · ${person.organizationName}` : ''}
                              </p>
                            </div>
                            <User size={14} className="text-[#C4B49A] shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audience hint */}
        <p className="text-xs text-[#8B7355]">→ {audienceHint()}</p>

        <Input
          label="Subject *"
          placeholder="e.g. First Written Warning — Attendance"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />

        <Textarea
          label="Notice content *"
          placeholder="Write the formal notice content here…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
        />

        {/* Issue button — positioned below content for natural reading flow */}
        <button
          type="button"
          onClick={() => void handleIssue()}
          disabled={!canSubmit || submitting}
          className="w-full rounded-xl bg-[#2C1810] text-white text-sm font-semibold py-3 disabled:opacity-40 hover:bg-[#3D2315] transition-colors active:bg-[#1A0F0A]"
        >
          {submitting ? 'Issuing notice…' : 'Issue formal notice'}
        </button>

        <div className="h-2" />
      </div>
    </div>
  );
}
