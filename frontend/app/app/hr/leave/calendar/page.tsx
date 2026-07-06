'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageLayout, PageHeader } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { getLeaveCalendar } from '@/services/hrService';
import type { LeaveCalendarEntry, LeaveType } from '@/types/hr';
import { LeaveTypeBadge } from '@/components/hr/LeaveTypeBadge';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAVE_COLORS: Record<LeaveType, string> = {
  ANNUAL:    '#059669',
  SICK:      '#D97706',
  EMERGENCY: '#DC2626',
  UNPAID:    '#64748B',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView({
  year,
  month,
  entries,
}: {
  year: number;
  month: number;
  entries: LeaveCalendarEntry[];
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayDay = new Date().getDate();
  const isCurrentMonth =
    new Date().getFullYear() === year && new Date().getMonth() === month;

  // Group entries by employee (deduplicate by userId)
  const employeeMap = new Map<string, { name: string; role: string; leaves: LeaveCalendarEntry[] }>();
  for (const entry of entries) {
    const uid = entry.employeeProfile.user.id;
    if (!employeeMap.has(uid)) {
      employeeMap.set(uid, {
        name: entry.employeeProfile.user.name,
        role: entry.employeeProfile.user.role,
        leaves: [],
      });
    }
    employeeMap.get(uid)!.leaves.push(entry);
  }
  const employees = Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-x-auto">
      <table className="min-w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '160px' }} />
          {days.map((d) => (
            <col key={d} style={{ width: '32px' }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border-b border-r border-stone-100 bg-stone-50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Employee
            </th>
            {days.map((d) => {
              const iso = isoDate(year, month, d);
              const dow = new Date(iso).getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isToday = iso === todayIso;
              return (
                <th
                  key={d}
                  className={`border-b border-r border-stone-100 py-2 text-center text-[11px] font-semibold ${
                    isToday
                      ? 'bg-[#FDF8F4] text-[#2C1810] font-extrabold'
                      : isWeekend
                      ? 'bg-stone-50 text-stone-300'
                      : 'bg-stone-50 text-stone-400'
                  }`}
                >
                  {d}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 ? (
            <tr>
              <td colSpan={daysInMonth + 1} className="px-5 py-10 text-center text-body-sm text-stone-400">
                No approved leave this month.
              </td>
            </tr>
          ) : (
            employees.map((emp) => (
              <tr key={emp.name} className="group">
                <td className="border-b border-r border-stone-100 px-4 py-2.5 bg-white">
                  <p className="text-body-sm font-semibold text-stone-900 truncate">{emp.name}</p>
                  <p className="text-[10px] text-stone-400">{emp.role.charAt(0) + emp.role.slice(1).toLowerCase()}</p>
                </td>
                {days.map((d) => {
                  const iso = isoDate(year, month, d);
                  const dow = new Date(iso).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const isToday = isCurrentMonth && d === todayDay;

                  // Find a leave entry that covers this day
                  const match = emp.leaves.find((l) => {
                    const start = l.startDate.slice(0, 10);
                    const end = l.endDate.slice(0, 10);
                    return iso >= start && iso <= end;
                  });

                  return (
                    <td
                      key={d}
                      className={`border-b border-r border-stone-100 p-0 relative ${
                        isWeekend ? 'bg-stone-50' : isToday ? 'bg-[#FDF8F4]' : 'bg-white'
                      }`}
                      style={{ height: '40px' }}
                    >
                      {match && (
                        <div
                          className="absolute inset-y-1.5 inset-x-0.5 rounded-sm"
                          style={{ backgroundColor: LEAVE_COLORS[match.leaveType] }}
                          title={`${emp.name} · ${match.leaveType}`}
                        />
                      )}
                      {isToday && !match && (
                        <div className="absolute inset-y-0 left-1/2 w-px bg-[#2C1810] opacity-20" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Month Grid View ──────────────────────────────────────────────────────────

function MonthGridView({
  year,
  month,
  entries,
}: {
  year: number;
  month: number;
  entries: LeaveCalendarEntry[];
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build calendar grid
  const days: { date: number; currentMonth: boolean; iso: string }[] = [];
  const prevMonthDays = getDaysInMonth(year, month === 0 ? 11 : month - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    days.push({ date: d, currentMonth: false, iso: isoDate(y, m, d) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: d, currentMonth: true, iso: isoDate(year, month, d) });
  }
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: d, currentMonth: false, iso: isoDate(ny, nm, d) });
    }
  }

  // Map entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, LeaveCalendarEntry[]>();
    for (const entry of entries) {
      const cur = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(entry);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [entries]);

  const selectedEntries = selectedDay ? (entriesByDate.get(selectedDay) ?? []) : [];

  return (
    <>
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50">
          {DAY_NAMES.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-[10px] font-bold uppercase tracking-wider ${
                i === 0 || i === 6 ? 'text-stone-300' : 'text-stone-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayEntries = entriesByDate.get(day.iso) ?? [];
            const isToday = day.iso === todayIso;
            const isSelected = day.iso === selectedDay;
            const isWeekend = idx % 7 === 0 || idx % 7 === 6;

            return (
              <button
                key={day.iso + idx}
                onClick={() => setSelectedDay(day.iso === selectedDay ? null : day.iso)}
                className={`relative min-h-[72px] border-b border-r border-stone-100 p-1.5 text-left transition-colors ${
                  !day.currentMonth
                    ? 'bg-stone-50'
                    : isWeekend
                    ? 'bg-[#FDFAF6]'
                    : 'bg-white'
                } ${isSelected ? 'ring-2 ring-inset ring-[#2C1810]' : 'hover:bg-stone-50'}`}
              >
                <span
                  className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    isToday
                      ? 'bg-[#2C1810] text-white'
                      : day.currentMonth
                      ? 'text-stone-700'
                      : 'text-stone-300'
                  }`}
                >
                  {day.date}
                </span>
                <div className="space-y-0.5">
                  {dayEntries.slice(0, 2).map((entry, ei) => (
                    <div
                      key={entry.id + ei}
                      className="truncate rounded px-1 text-[9px] font-semibold leading-4 text-white"
                      style={{ backgroundColor: LEAVE_COLORS[entry.leaveType] }}
                    >
                      {entry.employeeProfile.user.name.split(' ')[0]}
                    </div>
                  ))}
                  {dayEntries.length > 2 && (
                    <p className="px-1 text-[9px] font-medium text-stone-400">+{dayEntries.length - 2} more</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-heading-sm font-semibold text-stone-900">
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>
          {selectedEntries.length === 0 ? (
            <p className="text-body-sm text-stone-400">No approved leave on this day.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] text-label-sm font-semibold text-[#2C1810]">
                      {entry.employeeProfile.user.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-body-sm font-semibold text-stone-900">
                        {entry.employeeProfile.user.name}
                      </p>
                      <p className="text-caption text-stone-500">
                        {new Date(entry.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(entry.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <LeaveTypeBadge type={entry.leaveType} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type CalendarView = 'timeline' | 'month';

export default function LeaveCalendarPage(): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<LeaveCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CalendarView>('timeline');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await getLeaveCalendar({ year, month: month + 1 }, accessToken);
      setEntries(result);
    } catch {
      toast({ variant: 'error', title: 'Failed to load leave calendar' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, year, month, toast]);

  useEffect(() => { void load(); }, [load]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  return (
    <PageLayout className="animate-fade-up space-y-5">
      <PageHeader
        title="Leave Calendar"
        subtitle="Visual overview of approved leave by month."
        titleClassName="font-display text-display-lg font-semibold text-espresso"
      />

      {/* Toolbar: month nav + view toggle + legend */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[110px] text-center font-sans text-heading-sm font-semibold text-[#2C1810]">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* View toggle */}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-stone-200">
          <button
            onClick={() => setView('timeline')}
            className={`px-3.5 py-1.5 text-label-sm font-semibold transition-colors ${
              view === 'timeline' ? 'bg-[#2C1810] text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setView('month')}
            className={`border-l border-stone-200 px-3.5 py-1.5 text-label-sm font-semibold transition-colors ${
              view === 'month' ? 'bg-[#2C1810] text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(LEAVE_COLORS) as [LeaveType, string][]).map(([type, color]) => (
          <span
            key={type}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {type.charAt(0) + type.slice(1).toLowerCase()} leave
          </span>
        ))}
      </div>

      {/* View */}
      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-body-sm text-stone-400">Loading calendar…</p>
        </div>
      ) : view === 'timeline' ? (
        <TimelineView year={year} month={month} entries={entries} />
      ) : (
        <MonthGridView year={year} month={month} entries={entries} />
      )}
    </PageLayout>
  );
}
