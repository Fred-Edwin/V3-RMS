'use client';

import type { LeaveType, LeaveStatus, DisciplinaryAction } from '@/types/hr';

// ─── Leave Type Badge ─────────────────────────────────────────────────────────

const leaveTypeStyles: Record<LeaveType, { bg: string; text: string; border: string; label: string }> = {
  ANNUAL:    { bg: '#EDFAF1', text: '#059669', border: '#A7F3D0', label: 'Annual Leave' },
  SICK:      { bg: '#FFF7ED', text: '#D97706', border: '#FED7AA', label: 'Sick Leave' },
  EMERGENCY: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Emergency Leave' },
  UNPAID:    { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: 'Unpaid Leave' },
};

export function LeaveTypeBadge({ type }: { type: LeaveType }) {
  const s = leaveTypeStyles[type];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm font-medium"
      style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

// ─── Leave Status Badge ───────────────────────────────────────────────────────

const leaveStatusStyles: Record<LeaveStatus, { bg: string; text: string; border: string; label: string }> = {
  PENDING:   { bg: '#FDF3DC', text: '#92650A', border: '#F0D080', label: 'Pending' },
  APPROVED:  { bg: '#EDFAF1', text: '#1A6B3C', border: '#86EFAC', label: 'Approved' },
  REJECTED:  { bg: '#FDF2F0', text: '#9B3A2A', border: '#F5A898', label: 'Rejected' },
  CANCELLED: { bg: '#F4F4F5', text: '#71717A', border: '#D4D4D8', label: 'Cancelled' },
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const s = leaveStatusStyles[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm font-medium"
      style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

// ─── Disciplinary Action Badge ────────────────────────────────────────────────

const disciplinaryStyles: Record<DisciplinaryAction, { bg: string; text: string; border: string; label: string }> = {
  VERBAL_WARNING:  { bg: '#FFFBEB', text: '#92400E', border: '#FCD34D', label: 'Verbal Warning' },
  WRITTEN_WARNING: { bg: '#FFF4E6', text: '#A04F0A', border: '#F5B87A', label: 'Written Warning' },
  FINAL_WARNING:   { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5', label: 'Final Warning' },
  SUSPENSION:      { bg: '#3B0000', text: '#FEF2F2', border: '#991B1B', label: 'Suspension' },
  TERMINATION:     { bg: '#1C0000', text: '#FEE2E2', border: '#7F1D1D', label: 'Termination' },
};

export function DisciplinaryActionBadge({ action }: { action: DisciplinaryAction }) {
  const s = disciplinaryStyles[action];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm font-medium"
      style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
  }
  return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    WAITER: 'Waiter', CHEF: 'Chef', BARISTA: 'Barista',
    MANAGER: 'Manager', DIRECTOR: 'Director', HR_MANAGER: 'HR Manager',
    ACCOUNTANT: 'Accountant', SYSTEM_ADMIN: 'System Admin',
    KITCHEN_DISPLAY: 'Kitchen Display', BARISTA_DISPLAY: 'Barista Display',
    STEWARD: 'Steward', HOUSEKEEPING: 'Housekeeping',
  };
  return map[role] ?? role;
}

export function employmentTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Not set';
  return type === 'FULL_TIME' ? 'Full-time' : type === 'PART_TIME' ? 'Part-time' : 'Casual';
}
