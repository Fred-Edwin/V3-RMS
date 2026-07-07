'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, X, CheckCircle2,
  AlertTriangle, Clock, XCircle, Download, Users,
} from 'lucide-react';
import { PageLayout, PageHeader, ExcelTable, Badge, type ExcelColumn } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { getAttendanceSummary, getStaffAttendanceDetail } from '@/services/hrService';
import { branchService, type BranchDto } from '@/services/branchService';
import { listEmployeeProfiles } from '@/services/hrService';
import type { AttendanceStaffRow, AttendanceDayRow, EmployeeProfile } from '@/types/hr';
import { roleLabel } from '@/components/hr/LeaveTypeBadge';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

function thisWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // ISO Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function startOfLastMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
}

function endOfLastMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const PRESETS = [
  { label: 'This Week',    start: thisWeekStart(),    end: today() },
  { label: 'This Month',   start: startOfMonth(),     end: today() },
  { label: 'Last Month',   start: startOfLastMonth(), end: endOfLastMonth() },
] as const;

type PresetLabel = typeof PRESETS[number]['label'];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, minutesLate }: { status: AttendanceDayRow['status']; minutesLate: number }) {
  if (status === 'PRESENT') {
    return (
      <Badge tone="success">
        <CheckCircle2 size={11} className="mr-1" /> Present
      </Badge>
    );
  }
  if (status === 'LATE') {
    return (
      <Badge tone="warning">
        <Clock size={11} className="mr-1" /> Late {minutesLate > 0 ? `(${minutesLate}m)` : ''}
      </Badge>
    );
  }
  return (
    <Badge tone="danger">
      <XCircle size={11} className="mr-1" /> Absent
    </Badge>
  );
}

// ─── Attendance rate chip ─────────────────────────────────────────────────────
// Thresholds per spec: amber < 85%, red < 70%

function RateChip({ rate }: { rate: number }) {
  const color =
    rate >= 85 ? 'text-success bg-success-bg' :
    rate >= 70 ? 'text-warning bg-warning-bg' :
                 'text-danger bg-danger-bg';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-bold ${color}`}>
      {rate}%
    </span>
  );
}

// ─── Drill-down drawer ────────────────────────────────────────────────────────

function DetailDrawer({
  row,
  filters,
  onClose,
}: {
  row: AttendanceStaffRow;
  filters: { startDate: string; endDate: string };
  onClose: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const [days, setDays] = useState<AttendanceDayRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getStaffAttendanceDetail(row.userId, filters, accessToken)
      .then(setDays)
      .catch(() => toast({ variant: 'error', title: 'Failed to load detail' }))
      .finally(() => setLoading(false));
  }, [accessToken, row.userId, filters, toast]);

  const dayOfWeek = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const rateColorClass =
    row.attendanceRate >= 85 ? 'text-success' :
    row.attendanceRate >= 70 ? 'text-warning' : 'text-danger';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-heading-sm font-bold text-stone-900">{row.name}</h2>
            <p className="text-caption text-stone-400">
              {roleLabel(row.role)}{row.organizationName ? ` · ${row.organizationName}` : ''} ·{' '}
              {fmtDate(filters.startDate)} – {fmtDate(filters.endDate)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
          >
            <X size={15} />
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-5 border-b border-stone-100 px-6 py-3">
          {[
            { label: 'Scheduled', value: row.scheduled, color: 'text-stone-700' },
            { label: 'Present',   value: row.present,   color: 'text-success' },
            { label: 'Absent',    value: row.absent,    color: 'text-danger' },
            { label: 'Late',      value: row.late,      color: 'text-warning' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-[22px] font-extrabold leading-none ${color}`}>{value}</p>
              <p className="mt-0.5 text-[10px] text-stone-400">{label}</p>
            </div>
          ))}
          <div className="ml-auto text-center">
            <p className={`text-[22px] font-extrabold leading-none ${rateColorClass}`}>
              {row.attendanceRate}%
            </p>
            <p className="mt-0.5 text-[10px] text-stone-400">Rate</p>
          </div>
        </div>

        {/* Day-by-day list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-stone-100" />
              ))}
            </div>
          ) : days.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <CalendarDays size={28} className="mx-auto mb-3 text-stone-300" />
              <p className="text-body-sm text-stone-400">No shift assignments in this period.</p>
            </div>
          ) : (
            <div className="px-6 py-4">
              <ExcelTable<AttendanceDayRow>
                headerTone="gray"
                rowKey={(d) => `${d.date}-${d.shiftId}`}
                rows={days}
                columns={[
                  { key: 'date', label: 'Date', render: (d) => dayOfWeek(d.date) },
                  {
                    key: 'shift',
                    label: 'Shift',
                    render: (d) => (
                      <>
                        <span>{d.shiftName}</span>
                        <span className="ml-1.5 text-caption text-stone-400">
                          {d.shiftStart}–{d.shiftEnd}
                        </span>
                      </>
                    ),
                  },
                  { key: 'clockIn', label: 'Clock In', render: (d) => fmtTime(d.clockInAt) },
                  { key: 'clockOut', label: 'Clock Out', render: (d) => fmtTime(d.clockOutAt) },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (d) => <StatusBadge status={d.status} minutesLate={d.minutesLate} />,
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(rows: AttendanceStaffRow[], startDate: string, endDate: string) {
  const headers = ['Name', 'Role', 'Branch', 'Scheduled', 'Present', 'Absent', 'Late', 'Attendance %'];
  const lines = rows.map((r) => [
    r.name,
    roleLabel(r.role),
    r.organizationName ?? '',
    r.scheduled,
    r.present,
    r.absent,
    r.late,
    `${r.attendanceRate}%`,
  ].join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${startDate}_${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AttendancePage(): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const organizationId = useAuthStore((s) => s.organizationId);
  const { toast } = useToast();

  const isMultiBranch = role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';

  // Filters
  const [startDate, setStartDate]       = useState(startOfMonth());
  const [endDate, setEndDate]           = useState(today());
  const [activePreset, setActivePreset] = useState<PresetLabel | ''>('This Month');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [staffFilter, setStaffFilter]   = useState<string>('');

  // Reference data
  const [branches, setBranches]         = useState<BranchDto[]>([]);
  const [profiles, setProfiles]         = useState<EmployeeProfile[]>([]);

  // Attendance data
  const [rows, setRows]                 = useState<AttendanceStaffRow[]>([]);
  const [loading, setLoading]           = useState(false);
  const [drawerRow, setDrawerRow]       = useState<AttendanceStaffRow | null>(null);

  // Load branches and profiles for filter dropdowns
  useEffect(() => {
    if (!accessToken) return;
    if (isMultiBranch) {
      branchService.listBranches(accessToken).then(setBranches).catch(() => {/* ignore */});
    }
    listEmployeeProfiles(accessToken).then(setProfiles).catch(() => {/* ignore */});
  }, [isMultiBranch, accessToken]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await getAttendanceSummary(
        {
          startDate,
          endDate,
          organizationId: isMultiBranch ? (branchFilter || undefined) : (organizationId ?? undefined),
          userId: staffFilter || undefined,
        },
        accessToken,
      );
      setRows(data);
    } catch {
      toast({ variant: 'error', title: 'Failed to load attendance data' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, startDate, endDate, branchFilter, staffFilter, isMultiBranch, organizationId, toast]);

  useEffect(() => { void load(); }, [load]);

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setActivePreset(preset.label);
    setStartDate(preset.start);
    setEndDate(preset.end);
  };

  // Totals across all rows
  const totals = useMemo(() => {
    const scheduled = rows.reduce((s, r) => s + r.scheduled, 0);
    const present   = rows.reduce((s, r) => s + r.present, 0);
    const absent    = rows.reduce((s, r) => s + r.absent, 0);
    const late      = rows.reduce((s, r) => s + r.late, 0);
    const rate      = scheduled > 0 ? Math.round((present / scheduled) * 100) : 0;
    return { scheduled, present, absent, late, rate };
  }, [rows]);

  const drawerFilters = useMemo(
    () => ({ startDate, endDate }),
    [startDate, endDate],
  );

  const rateColorClass =
    totals.rate >= 85 ? 'text-success' :
    totals.rate >= 70 ? 'text-warning' : 'text-danger';

  return (
    <PageLayout className="animate-fade-up space-y-5">
      <PageHeader
        title="Attendance"
        subtitle="Days worked vs. days scheduled."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
      />

      {/* ── Zone 1: Filter bar ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        {/* Row 1: Preset pills + Export CSV */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`rounded-full border px-3 py-1 text-label-sm font-medium transition-colors ${
                activePreset === p.label
                  ? 'border-espresso bg-espresso text-white'
                  : 'border-stone-200 text-stone-600 hover:border-stone-400'
              }`}
            >
              {p.label}
            </button>
          ))}

          {/* Divider */}
          <span className="mx-1 h-5 w-px bg-stone-200" />

          {/* Custom date range */}
          <div className="flex items-center gap-1.5">
            <span className="text-label-sm text-stone-400">Custom:</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => { setStartDate(e.target.value); setActivePreset(''); }}
              className="h-8 rounded-lg border border-stone-200 bg-stone-50 px-2.5 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
            />
            <span className="text-stone-400">→</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today()}
              onChange={(e) => { setEndDate(e.target.value); setActivePreset(''); }}
              className="h-8 rounded-lg border border-stone-200 bg-stone-50 px-2.5 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
            />
          </div>

          {/* Export — pushed to the right */}
          <div className="ml-auto">
            <button
              onClick={() => exportCsv(rows, startDate, endDate)}
              disabled={rows.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-label-sm font-semibold text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* Row 2: Branch + Staff dropdowns */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {isMultiBranch && branches.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Branch</label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 rounded-lg border border-stone-200 bg-stone-50 px-2.5 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              <Users size={11} className="inline mr-1" />Staff
            </label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="h-8 min-w-[160px] rounded-lg border border-stone-200 bg-stone-50 px-2.5 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
            >
              <option value="">All staff</option>
              {profiles.map((p) => (
                <option key={p.userId} value={p.userId}>{p.user.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Zone 2: Summary bar ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Days Scheduled', value: totals.scheduled, textClass: 'text-espresso', borderClass: 'border-l-espresso',  sub: 'total shifts' },
          { label: 'Days Present',   value: totals.present,   textClass: 'text-success',  borderClass: 'border-l-success',   sub: 'showed up' },
          { label: 'Absences',       value: totals.absent,    textClass: 'text-danger',   borderClass: 'border-l-danger',    sub: 'no-shows' },
          {
            label: 'Attendance Rate',
            value: totals.scheduled > 0 ? `${totals.rate}%` : '—',
            textClass: rateColorClass,
            borderClass: rateColorClass === 'text-success' ? 'border-l-success' : rateColorClass === 'text-warning' ? 'border-l-warning' : 'border-l-danger',
            sub: totals.rate >= 85 ? 'On target' : totals.rate >= 70 ? 'Needs attention' : 'Critical',
          },
        ].map(({ label, value, textClass, borderClass, sub }) => (
          <div
            key={label}
            className={`rounded-xl border border-stone-200 bg-white p-4 shadow-sm border-l-[3px] ${borderClass}`}
          >
            <p className="text-label-sm text-stone-400">{label}</p>
            <p className={`mt-1 font-sans text-display-lg font-semibold tabular-nums ${textClass}`}>
              {loading
                ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-stone-200" />
                : value}
            </p>
            {!loading && sub && (
              <p className="mt-0.5 text-caption text-stone-400">{sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Late count below summary — subtle */}
      {!loading && totals.late > 0 && (
        <p className="flex items-center gap-1.5 text-body-sm text-warning">
          <Clock size={13} />
          {totals.late} {totals.late === 1 ? 'late arrival' : 'late arrivals'} in this period
        </p>
      )}

      {/* ── Zone 3: Staff table ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-9 w-9 animate-pulse rounded-full bg-stone-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 animate-pulse rounded bg-stone-200" />
                  <div className="h-3 w-24 animate-pulse rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CalendarDays size={28} className="mx-auto mb-3 text-stone-300" />
            <p className="text-heading-sm font-semibold text-stone-700">No data</p>
            <p className="mt-1 text-body-sm text-stone-400">
              No shift assignments found for the selected period and filters.
            </p>
          </div>
        ) : (
          <ExcelTable<AttendanceStaffRow>
            headerTone="gray"
            rowKey={(row) => row.userId}
            rows={rows}
            expandable={{
              isExpanded: () => false,
              onToggle: (row) => setDrawerRow(row),
              childRows: () => [],
            }}
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-crema text-label-sm font-bold text-espresso">
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                    <p className="font-semibold text-stone-900">{row.name}</p>
                  </div>
                ),
              },
              ...(isMultiBranch
                ? [{
                    key: 'branch',
                    label: 'Branch',
                    render: (row: AttendanceStaffRow) =>
                      row.organizationName ?? <span className="text-stone-300">—</span>,
                  } as ExcelColumn<AttendanceStaffRow>]
                : []),
              { key: 'role', label: 'Role', render: (row) => roleLabel(row.role) },
              { key: 'scheduled', label: 'Scheduled', align: 'center', render: (row) => row.scheduled },
              {
                key: 'present',
                label: 'Present',
                align: 'center',
                render: (row) => <span className="font-medium text-success">{row.present}</span>,
              },
              {
                key: 'absent',
                label: 'Absent',
                align: 'center',
                render: (row) =>
                  row.absent > 0
                    ? <span className="font-medium text-danger">{row.absent}</span>
                    : <span className="font-medium text-stone-400">0</span>,
              },
              {
                key: 'late',
                label: 'Late',
                align: 'center',
                render: (row) =>
                  row.late > 0
                    ? <span className="font-medium text-warning">{row.late}</span>
                    : <span className="font-medium text-stone-400">0</span>,
              },
              {
                key: 'rate',
                label: 'Att. %',
                align: 'center',
                render: (row) => (
                  <span className="inline-flex items-center gap-1.5">
                    {row.attendanceRate < 85 && <AlertTriangle size={13} className="text-warning" />}
                    <RateChip rate={row.attendanceRate} />
                  </span>
                ),
              },
            ]}
          />
        )}
      </div>

      {/* ── Drill-down drawer ─────────────────────────────────────────────────── */}
      {drawerRow && (
        <DetailDrawer
          row={drawerRow}
          filters={drawerFilters}
          onClose={() => setDrawerRow(null)}
        />
      )}
    </PageLayout>
  );
}
