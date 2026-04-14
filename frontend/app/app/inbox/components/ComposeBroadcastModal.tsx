'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Input, Textarea, Select, Toggle } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { branchService, type BranchDto } from '@/services/branchService';
import { useAuthStore } from '@/store/authStore';
import type { BroadcastScope } from '@/types/comms';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
}

type AppRole = 'WAITER' | 'CHEF' | 'BARISTA' | 'MANAGER' | 'ACCOUNTANT';

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'WAITER', label: 'Waiters' },
  { value: 'CHEF', label: 'Chefs' },
  { value: 'BARISTA', label: 'Baristas' },
  { value: 'MANAGER', label: 'Managers' },
  { value: 'ACCOUNTANT', label: 'Accountants' },
];

export function ComposeBroadcastModal({ isOpen, onClose, onSent }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const organizationId = useAuthStore((s) => s.organizationId);
  const organizationName = useAuthStore((s) => s.user?.organizationName);

  // Both DIRECTOR and HR_MANAGER can broadcast company-wide and across branches.
  // MANAGER is restricted to their own branch only.
  const isMultiBranch = role === 'DIRECTOR' || role === 'HR_MANAGER';

  const [scope, setScope] = useState<BroadcastScope>(isMultiBranch ? 'COMPANY' : 'BRANCH');
  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [targetRole, setTargetRole] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [requiresAck, setRequiresAck] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchDto[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setScope(isMultiBranch ? 'COMPANY' : 'BRANCH');
    setTargetBranchId('');
    setTargetRole('');
    setSubject('');
    setBody('');
    setRequiresAck(false);
    setError(null);

    if (isMultiBranch && accessToken) {
      branchService.listBranches(accessToken).then(setBranches).catch(() => {/* ignore */});
    }
  }, [isOpen, isMultiBranch, accessToken]);

  const availableScopes: { value: BroadcastScope; label: string }[] = isMultiBranch
    ? [
        { value: 'COMPANY', label: 'Company-wide' },
        { value: 'BRANCH', label: 'Branch' },
        { value: 'ROLE_GROUP', label: 'Role group' },
      ]
    : [
        { value: 'BRANCH', label: 'My branch' },
        { value: 'ROLE_GROUP', label: 'Role group' },
      ];

  const audienceHint = (): string => {
    if (scope === 'COMPANY') return 'All active staff across all branches';
    if (scope === 'BRANCH') {
      if (isMultiBranch) {
        const b = branches.find((br) => br.id === targetBranchId);
        return b ? `All staff at ${b.name}` : 'Select a branch';
      }
      return organizationName ? `All staff at ${organizationName}` : 'All staff at your branch';
    }
    if (scope === 'ROLE_GROUP') {
      const rLabel = ROLE_OPTIONS.find((r) => r.value === targetRole)?.label ?? 'selected role';
      if (isMultiBranch && targetBranchId) {
        const b = branches.find((br) => br.id === targetBranchId);
        return `${rLabel} at ${b?.name ?? 'selected branch'}`;
      }
      if (isMultiBranch && !targetBranchId) return `${rLabel} across all branches`;
      return `${rLabel} at your branch`;
    }
    return '';
  };

  const canSend = (): boolean => {
    if (!subject.trim() || !body.trim()) return false;
    if (scope === 'BRANCH' && isMultiBranch && !targetBranchId) return false;
    if (scope === 'ROLE_GROUP' && !targetRole) return false;
    return true;
  };

  const handleSend = async () => {
    if (!accessToken || !canSend()) return;
    setSending(true);
    setError(null);
    try {
      await commsService.sendBroadcast(accessToken, {
        scope,
        targetBranchId: (scope === 'BRANCH' || scope === 'ROLE_GROUP') && isMultiBranch && targetBranchId
          ? targetBranchId
          : (scope !== 'COMPANY' && !isMultiBranch && organizationId)
            ? organizationId
            : undefined,
        targetRole: scope === 'ROLE_GROUP' && targetRole ? targetRole : undefined,
        subject: subject.trim(),
        bodyHtml: `<p>${body.trim().replace(/\n/g, '</p><p>')}</p>`,
        requiresAck,
      });
      onSent();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send broadcast';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }));

  return (
    <div className="flex flex-col h-full bg-[#F5F0E8]">
      {/* Header */}
      <div className="bg-[#2C1810] px-4 py-3 flex items-center shrink-0">
        <button type="button" onClick={onClose} className="text-[#F5F0E8]/80 hover:text-[#F5F0E8] transition-colors">
          <X size={20} />
        </button>
        <span className="flex-1 text-center text-[#F5F0E8] font-semibold text-base">New Broadcast</span>
        <div className="w-6" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Scope pills */}
        <div>
          <p className="text-xs font-medium text-[#44403C] mb-2">Audience scope *</p>
          <div className="flex gap-2 flex-wrap">
            {availableScopes.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setScope(s.value);
                  setTargetBranchId('');
                  setTargetRole('');
                }}
                className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                  scope === s.value
                    ? 'bg-[#2C1810] text-[#F5F0E8] border-[#2C1810]'
                    : 'bg-transparent text-[#78716C] border-[#D6D3D1] hover:border-[#2C1810] hover:text-[#2C1810]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {isMultiBranch && scope === 'BRANCH' && (
          <Select
            label="Branch *"
            placeholder="Select a branch…"
            value={targetBranchId}
            onChange={(e) => setTargetBranchId(e.target.value)}
            options={branchOptions}
          />
        )}

        {isMultiBranch && scope === 'ROLE_GROUP' && (
          <Select
            label="Branch (optional — leave blank for all branches)"
            placeholder="All branches"
            value={targetBranchId}
            onChange={(e) => setTargetBranchId(e.target.value)}
            options={[{ value: '', label: 'All branches' }, ...branchOptions]}
          />
        )}

        {scope === 'ROLE_GROUP' && (
          <Select
            label="Role group *"
            placeholder="Select a role…"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            options={ROLE_OPTIONS}
          />
        )}

        <Input
          label="Title *"
          placeholder="e.g. Updated Closing Procedure — All Staff"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />

        <Textarea
          label="Message *"
          placeholder="Write your broadcast message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
        />

        <div className="bg-white border border-[#E8E0D5] rounded-lg px-4 divide-y divide-[#E8E0D5]">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[#44403C]">Require acknowledgement</p>
              <p className="text-xs text-[#8B7355] mt-0.5">
                Recipients must confirm they have read and understood the message
              </p>
            </div>
            <Toggle checked={requiresAck} onChange={setRequiresAck} />
          </div>
        </div>

        <p className="text-xs text-[#8B7355]">→ {audienceHint()}</p>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend() || sending}
          className="w-full py-3 rounded-xl bg-[#2C1810] text-[#F5F0E8] text-sm font-semibold disabled:opacity-40 hover:bg-[#3D2318] transition-colors active:scale-[0.98]"
        >
          {sending ? 'Sending…' : 'Send Broadcast'}
        </button>
      </div>
    </div>
  );
}
