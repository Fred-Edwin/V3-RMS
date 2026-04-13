'use client';

import { useState, useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import { Input, Textarea, Select } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { branchService, type BranchDto } from '@/services/branchService';
import { useAuthStore } from '@/store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onIssued: () => void;
}

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'WAITER', label: 'Waiters' },
  { value: 'CHEF', label: 'Chefs' },
  { value: 'BARISTA', label: 'Baristas' },
  { value: 'MANAGER', label: 'Managers' },
  { value: 'ACCOUNTANT', label: 'Accountants' },
];

export function IssueNoticeModal({ isOpen, onClose, onIssued }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchDto[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setTargetBranchId('');
    setTargetRole('');
    setSubject('');
    setBody('');
    setError(null);
    if (accessToken) {
      branchService.listBranches(accessToken).then(setBranches).catch(() => {/* ignore */});
    }
  }, [isOpen, accessToken]);

  const audienceHint = (): string => {
    const rolePart = ROLE_OPTIONS.find((r) => r.value === targetRole)?.label ?? 'All roles';
    if (targetBranchId) {
      const b = branches.find((br) => br.id === targetBranchId);
      return `${rolePart} at ${b?.name ?? 'selected branch'}`;
    }
    return 'Select a branch to continue';
  };

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !!targetBranchId;

  const handleIssue = async () => {
    if (!accessToken || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await commsService.issueNotice(accessToken, {
        targetBranchId: targetBranchId || undefined,
        targetRole: targetRole || undefined,
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
      {/* Header */}
      <div className="bg-[#92650A] px-4 py-3 flex items-center shrink-0">
        <button type="button" onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <span className="flex-1 text-center text-white font-semibold text-base">Issue Notice</span>
        <button
          type="button"
          onClick={() => void handleIssue()}
          disabled={!canSubmit || submitting}
          className="text-white text-sm font-semibold disabled:opacity-40"
        >
          {submitting ? 'Issuing…' : 'Issue'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Notice type explainer */}
        <div className="rounded-lg bg-[#FDF3DC] border border-[#F0D080] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-[#92650A]" />
            <p className="text-sm font-medium text-[#92650A]">Formal Notice</p>
          </div>
          <p className="text-xs text-[#92650A] opacity-80">
            Notices are permanently retained on the recipient&apos;s HR record and require explicit acknowledgement.
          </p>
        </div>

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

        <p className="text-xs text-[#8B7355]">→ {audienceHint()}</p>
      </div>
    </div>
  );
}
