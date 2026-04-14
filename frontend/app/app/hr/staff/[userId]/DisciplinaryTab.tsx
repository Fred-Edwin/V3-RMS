'use client';

import { useState } from 'react';
import {
  Shield, Plus, X, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, User, Calendar, FileText,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { createDisciplinaryRecord } from '@/services/hrService';
import type {
  DisciplinaryRecord, DisciplinaryAction, DisciplinaryCategory,
  CreateDisciplinaryRecordInput,
} from '@/types/hr';
import { DisciplinaryActionBadge } from '@/components/hr/LeaveTypeBadge';
import type { AppRole } from '@/types/auth';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<DisciplinaryAction, {
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  timelineBorder: string;
}> = {
  VERBAL_WARNING:  {
    label: 'Verbal Warning',
    description: 'Informal oral warning documented on record',
    color: '#92400E', bg: '#FFFBEB', border: '#FCD34D', timelineBorder: '#F59E0B',
  },
  WRITTEN_WARNING: {
    label: 'Written Warning',
    description: 'Formal written notice issued to the employee',
    color: '#A04F0A', bg: '#FFF4E6', border: '#F5B87A', timelineBorder: '#F97316',
  },
  FINAL_WARNING:   {
    label: 'Final Warning',
    description: 'Last formal warning before suspension or termination',
    color: '#991B1B', bg: '#FEF2F2', border: '#FCA5A5', timelineBorder: '#DC2626',
  },
  SUSPENSION:      {
    label: 'Suspension',
    description: 'Temporary removal from duty without pay',
    color: '#FEF2F2', bg: '#3B0000', border: '#991B1B', timelineBorder: '#7F1D1D',
  },
  TERMINATION:     {
    label: 'Termination',
    description: 'Permanent end of employment',
    color: '#FEE2E2', bg: '#1C0000', border: '#7F1D1D', timelineBorder: '#450A0A',
  },
};

const CATEGORY_LABELS: Record<DisciplinaryCategory, string> = {
  INSUBORDINATION:  'Insubordination',
  ATTENDANCE:       'Attendance',
  MISCONDUCT:       'Misconduct',
  PERFORMANCE:      'Performance',
  POLICY_VIOLATION: 'Policy Violation',
  OTHER:            'Other',
};

const CATEGORIES: DisciplinaryCategory[] = [
  'ATTENDANCE', 'MISCONDUCT', 'INSUBORDINATION',
  'PERFORMANCE', 'POLICY_VIOLATION', 'OTHER',
];

const ACTIONS: DisciplinaryAction[] = [
  'VERBAL_WARNING', 'WRITTEN_WARNING', 'FINAL_WARNING', 'SUSPENSION', 'TERMINATION',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Record Drawer ────────────────────────────────────────────────────────────

type FormState = {
  category: DisciplinaryCategory | '';
  actionTaken: DisciplinaryAction | '';
  incidentDate: string;
  actionDate: string;
  description: string;
  outcome: string;
  witnesses: string;
  expiresAt: string;
};

const EMPTY_FORM: FormState = {
  category: '',
  actionTaken: '',
  incidentDate: new Date().toISOString().slice(0, 10),
  actionDate: new Date().toISOString().slice(0, 10),
  description: '',
  outcome: '',
  witnesses: '',
  expiresAt: '',
};

function RecordDrawer({
  employeeUserId,
  employeeName,
  onClose,
  onSaved,
}: {
  employeeUserId: string;
  employeeName: string;
  onClose: () => void;
  onSaved: (record: DisciplinaryRecord) => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // step 1 = category+action, step 2 = details

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const canProceed = form.category !== '' && form.actionTaken !== '';
  const canSave =
    canProceed &&
    form.incidentDate &&
    form.actionDate &&
    form.description.trim().length >= 10 &&
    form.outcome.trim().length >= 1;

  const handleSave = async () => {
    if (!accessToken || !canSave) return;
    setSaving(true);
    try {
      const input: CreateDisciplinaryRecordInput = {
        employeeUserId,
        category: form.category as DisciplinaryCategory,
        actionTaken: form.actionTaken as DisciplinaryAction,
        incidentDate: new Date(form.incidentDate).toISOString(),
        actionDate: new Date(form.actionDate).toISOString(),
        description: form.description.trim(),
        outcome: form.outcome.trim(),
        witnesses: form.witnesses.trim() || undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      };
      const record = await createDisciplinaryRecord(input, accessToken);
      toast({ variant: 'success', title: 'Disciplinary record created' });
      onSaved(record);
      onClose();
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to save', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedAction = form.actionTaken ? ACTION_CONFIG[form.actionTaken as DisciplinaryAction] : null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-heading-sm font-bold text-stone-900">Record Disciplinary Action</h2>
            <p className="text-caption text-stone-400">{employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
          >
            <X size={15} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 border-b border-stone-100 px-6 py-3">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
            step >= 1 ? 'bg-[#2C1810] text-white' : 'bg-stone-200 text-stone-500'
          }`}>1</div>
          <span className={`text-label-sm font-medium ${step === 1 ? 'text-stone-900' : 'text-stone-400'}`}>
            Category & Action
          </span>
          <ChevronRight size={13} className="text-stone-300" />
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
            step >= 2 ? 'bg-[#2C1810] text-white' : 'bg-stone-200 text-stone-500'
          }`}>2</div>
          <span className={`text-label-sm font-medium ${step === 2 ? 'text-stone-900' : 'text-stone-400'}`}>
            Details
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {step === 1 && (
            <>
              {/* Category */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Incident Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => set('category', cat)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-label-sm font-semibold transition-all ${
                        form.category === cat
                          ? 'border-[#2C1810] bg-[#F5F0E8] text-[#2C1810]'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Action Taken
                </label>
                <div className="space-y-2">
                  {ACTIONS.map((action) => {
                    const cfg = ACTION_CONFIG[action];
                    const isSelected = form.actionTaken === action;
                    return (
                      <button
                        key={action}
                        onClick={() => set('actionTaken', action)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? 'border-current ring-2 ring-offset-1'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                        style={isSelected ? {
                          backgroundColor: cfg.bg,
                          borderColor: cfg.border,
                          color: cfg.color,
                        } : {}}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-label-sm font-bold"
                            style={isSelected ? { color: cfg.color } : { color: '#374151' }}>
                            {cfg.label}
                          </span>
                          {isSelected && (
                            <CheckCircle2 size={15} style={{ color: cfg.color }} />
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px]"
                          style={isSelected ? { color: cfg.color, opacity: 0.75 } : { color: '#9CA3AF' }}>
                          {cfg.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Selected action recap */}
              {selectedAction && (
                <div
                  className="rounded-xl border px-4 py-3"
                  style={{ backgroundColor: selectedAction.bg, borderColor: selectedAction.border }}
                >
                  <p className="text-label-sm font-bold" style={{ color: selectedAction.color }}>
                    {selectedAction.label}
                    {form.category && (
                      <span className="ml-2 font-normal opacity-75">
                        · {CATEGORY_LABELS[form.category as DisciplinaryCategory]}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Incident Date *
                  </label>
                  <input
                    type="date"
                    value={form.incidentDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => set('incidentDate', e.target.value)}
                    className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Action Date *
                  </label>
                  <input
                    type="date"
                    value={form.actionDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => set('actionDate', e.target.value)}
                    className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Incident Description *
                  <span className="ml-1 normal-case font-normal text-stone-400">(min 10 chars)</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the incident in detail — what happened, when, where, and who was involved…"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-body-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
                />
                <p className={`mt-1 text-[10px] ${form.description.length < 10 && form.description.length > 0 ? 'text-red-500' : 'text-stone-400'}`}>
                  {form.description.length} / min 10 characters
                </p>
              </div>

              {/* Outcome */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Outcome / Resolution *
                </label>
                <textarea
                  rows={3}
                  placeholder="What was agreed or decided? e.g. Employee was warned that a repeat occurrence will result in suspension."
                  value={form.outcome}
                  onChange={(e) => set('outcome', e.target.value)}
                  className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-body-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
                />
              </div>

              {/* Optional fields */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Witnesses <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Mwangi (Manager), John Doe (Waiter)"
                  value={form.witnesses}
                  onChange={(e) => set('witnesses', e.target.value)}
                  className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Warning Expiry Date <span className="normal-case font-normal">(optional — leave blank if permanent)</span>
                </label>
                <input
                  type="date"
                  value={form.expiresAt}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => set('expiresAt', e.target.value)}
                  className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-100 px-6 py-4">
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!canProceed}
              className="w-full rounded-xl bg-[#2C1810] py-3 text-label-sm font-bold text-white transition-colors hover:bg-[#4A2C1A] disabled:opacity-40"
            >
              Continue to Details
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="rounded-xl border border-stone-200 px-4 py-3 text-label-sm font-semibold text-stone-600 transition-colors hover:bg-stone-50"
              >
                Back
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!canSave || saving}
                className="flex-1 rounded-xl bg-[#2C1810] py-3 text-label-sm font-bold text-white transition-colors hover:bg-[#4A2C1A] disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Record'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Timeline Record Card ──────────────────────────────────────────────────────

function RecordCard({ record, isLast }: { record: DisciplinaryRecord; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_CONFIG[record.actionTaken];
  const isExpired = record.expiresAt ? new Date(record.expiresAt) < new Date() : false;

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-10 bottom-0 w-px -mb-4" style={{ backgroundColor: cfg.timelineBorder, opacity: 0.3 }} />
      )}

      {/* Timeline dot */}
      <div
        className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
        style={{ backgroundColor: cfg.bg, borderColor: cfg.timelineBorder }}
      >
        <AlertTriangle size={13} style={{ color: cfg.timelineBorder }} />
      </div>

      {/* Card */}
      <div
        className="mb-4 flex-1 rounded-xl border bg-white shadow-sm overflow-hidden"
        style={{ borderLeftWidth: '3px', borderLeftColor: cfg.timelineBorder, borderColor: '#E7E5E4', borderLeftStyle: 'solid' }}
      >
        {/* Card header */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-4 py-3 text-left"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DisciplinaryActionBadge action={record.actionTaken} />
              {isExpired && (
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-400">
                  Expired
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-caption text-stone-400">{fmt(record.actionDate)}</span>
              <ChevronRight
                size={14}
                className={`text-stone-300 transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            </div>
          </div>
          <p className="mt-1.5 text-body-sm font-semibold text-stone-700">
            {CATEGORY_LABELS[record.category]}
          </p>
          <p className="mt-0.5 text-caption text-stone-400 line-clamp-1">
            {record.description}
          </p>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-stone-100 px-4 py-3 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Description</p>
              <p className="text-body-sm text-stone-700 leading-relaxed">{record.description}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Outcome</p>
              <p className="text-body-sm text-stone-700 leading-relaxed">{record.outcome}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-caption">
              <div className="flex items-center gap-1.5 text-stone-500">
                <Calendar size={11} className="text-stone-400" />
                Incident: {fmt(record.incidentDate)}
              </div>
              <div className="flex items-center gap-1.5 text-stone-500">
                <FileText size={11} className="text-stone-400" />
                Action: {fmt(record.actionDate)}
              </div>
              {record.witnesses && (
                <div className="col-span-2 flex items-start gap-1.5 text-stone-500">
                  <User size={11} className="mt-0.5 shrink-0 text-stone-400" />
                  Witnesses: {record.witnesses}
                </div>
              )}
              {record.expiresAt && (
                <div className={`col-span-2 flex items-center gap-1.5 ${isExpired ? 'text-stone-400' : 'text-[#92400E]'}`}>
                  <Clock size={11} className="shrink-0" />
                  {isExpired ? 'Expired' : 'Expires'}: {fmt(record.expiresAt)}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-stone-100 pt-2">
              <span className="text-caption text-stone-400">Issued by {record.issuedBy.name}</span>
              {record.acknowledged ? (
                <span className="flex items-center gap-1 text-label-sm font-medium text-[#1A6B3C]">
                  <CheckCircle2 size={12} /> Acknowledged {record.acknowledgedAt ? fmt(record.acknowledgedAt) : ''}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-label-sm font-medium text-[#92650A]">
                  <Clock size={12} /> Awaiting acknowledgement
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────

function SummaryBar({ records }: { records: DisciplinaryRecord[] }) {
  const active = records.filter((r) => !r.expiresAt || new Date(r.expiresAt) > new Date());
  const counts: Partial<Record<DisciplinaryAction, number>> = {};
  for (const r of active) {
    counts[r.actionTaken] = (counts[r.actionTaken] ?? 0) + 1;
  }

  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
        <AlertTriangle size={12} />
        Active (unexpired)
      </div>
      {(Object.entries(counts) as [DisciplinaryAction, number][]).map(([action, count]) => {
        const cfg = ACTION_CONFIG[action];
        return (
          <span
            key={action}
            className="rounded-full border px-2.5 py-0.5 text-label-sm font-semibold"
            style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }}
          >
            {count}× {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  employeeName: string;
  records: DisciplinaryRecord[];
  role: AppRole | null;
  onRecordAdded: (record: DisciplinaryRecord) => void;
}

export function DisciplinaryTab({ userId, employeeName, records, role, onRecordAdded }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isHrAuth = role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-body-sm text-stone-500">
            {records.length === 0
              ? 'No disciplinary actions on record.'
              : `${records.length} action${records.length > 1 ? 's' : ''} on record`}
          </p>
        </div>
        {isHrAuth && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#2C1810] px-3 py-2 text-label-sm font-semibold text-white transition-colors hover:bg-[#4A2C1A]"
          >
            <Plus size={13} />
            Record Action
          </button>
        )}
      </div>

      {/* Active summary */}
      <SummaryBar records={records} />

      {/* Timeline */}
      {records.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
          <Shield size={32} className="mx-auto mb-3 text-stone-300" />
          <p className="text-heading-sm font-semibold text-stone-700">Clean record</p>
          <p className="mt-1 text-body-sm text-stone-400">No disciplinary actions on file for this employee.</p>
        </div>
      ) : (
        <div className="pl-1">
          {records.map((record, idx) => (
            <RecordCard key={record.id} record={record} isLast={idx === records.length - 1} />
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <RecordDrawer
          employeeUserId={userId}
          employeeName={employeeName}
          onClose={() => setDrawerOpen(false)}
          onSaved={onRecordAdded}
        />
      )}
    </div>
  );
}
