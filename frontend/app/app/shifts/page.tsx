'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { PageHeader, PageLayout, SkeletonBlock } from '@/components/ui';
import { ClockWidget } from '@/components/shifts/ClockWidget';
import { useToast } from '@/hooks/useToast';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { ShiftAssignment, ShiftAssignmentClockRecord } from '@/types/shift';

const dateToYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDateLabel = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const formatTime = (value: string | null): string => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatClockMethod = (method: string | null | undefined): string => {
  if (!method) return '—';
  if (method === 'GPS') return 'GPS';
  if (method === 'OVERRIDE') return 'Override';
  return method;
};

export default function ShiftsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const [isLoading, setIsLoading] = useState(true);
  const [upcomingAssignments, setUpcomingAssignments] = useState<ShiftAssignment[]>([]);
  const [historyAssignments, setHistoryAssignments] = useState<ShiftAssignment[]>([]);
  const [todayAssignment, setTodayAssignment] = useState<ShiftAssignment | null>(null);

  const loadAssignments = useCallback(async (): Promise<void> => {
    if (!accessToken || (role !== 'WAITER' && role !== 'CHEF' && role !== 'BARISTA')) return;

    setIsLoading(true);
    try {
      const today = new Date();
      const todayKey = dateToYmd(today);
      const upcomingEndKey = dateToYmd(addDays(today, 7));
      const historyStartKey = dateToYmd(addDays(today, -30));
      const yesterdayKey = dateToYmd(addDays(today, -1));

      const [upcoming, history] = await Promise.all([
        shiftService.listAssignments({ startDate: todayKey, endDate: upcomingEndKey }, accessToken),
        shiftService.listAssignments({ startDate: historyStartKey, endDate: yesterdayKey }, accessToken),
      ]);

      const orderedUpcoming = [...upcoming].sort((l, r) =>
        `${l.date} ${l.shift.startTime}`.localeCompare(`${r.date} ${r.shift.startTime}`),
      );

      setUpcomingAssignments(orderedUpcoming);
      setHistoryAssignments(
        [...history].sort((l, r) =>
          `${r.date} ${r.shift.startTime}`.localeCompare(`${l.date} ${l.shift.startTime}`),
        ),
      );
      setTodayAssignment(orderedUpcoming.find((a) => a.date === todayKey) ?? null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load shifts.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, role, toast]);

  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  const todayKey = useMemo(() => dateToYmd(new Date()), []);

  const handleClockUpdated = useCallback((record: ShiftAssignmentClockRecord) => {
    setTodayAssignment((current) => current ? { ...current, clockRecord: record } : current);
    setUpcomingAssignments((current) =>
      current.map((a) =>
        a.id === todayAssignment?.id ? { ...a, clockRecord: record } : a,
      ),
    );
  }, [todayAssignment?.id]);

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader title="Shifts" />

      <ClockWidget assignment={todayAssignment} onUpdated={handleClockUpdated} />

      {/* ── Upcoming 7 Days ── */}
      <section>
        <h2 className="text-heading-sm font-semibold text-stone-900 mb-3">Next 7 days</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : upcomingAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white border border-stone-200 py-12 text-center shadow-sm">
            <CalendarClock size={32} className="text-stone-300 mb-3" />
            <p className="text-body-md font-medium text-stone-600">You&apos;re all clear</p>
            <p className="text-body-sm text-stone-400 mt-1">No shifts scheduled for the next 7 days.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {upcomingAssignments.map((assignment) => {
              const isToday = assignment.date === todayKey;
              return (
                <article
                  key={assignment.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    isToday
                      ? 'border-[#F0D080] bg-[#FDF3DC]'
                      : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-label-sm font-medium uppercase tracking-wider ${isToday ? 'text-[#92650A]' : 'text-stone-400'}`}>
                        {isToday ? 'Today' : formatDateLabel(assignment.date)}
                      </p>
                      <h3 className="mt-0.5 text-heading-sm font-semibold text-stone-900">
                        {assignment.shift.name}
                      </h3>
                      <p className="text-body-sm text-stone-500 mt-0.5">
                        {assignment.shift.startTime} – {assignment.shift.endTime}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-label-sm text-stone-500">
                      {assignment.user.role}
                    </span>
                  </div>

                  {isToday && assignment.clockRecord && (
                    <div className="mt-3 flex items-center gap-4 border-t border-[#F0D080] pt-3">
                      <div>
                        <p className="text-label-sm uppercase tracking-wider text-[#92650A]/70">Clock In</p>
                        <p className="text-body-sm font-medium text-[#92650A]">
                          {formatTime(assignment.clockRecord.clockInAt)}
                        </p>
                      </div>
                      {assignment.clockRecord.clockOutAt && (
                        <div>
                          <p className="text-label-sm uppercase tracking-wider text-[#92650A]/70">Clock Out</p>
                          <p className="text-body-sm font-medium text-[#92650A]">
                            {formatTime(assignment.clockRecord.clockOutAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Attendance History ── */}
      <section>
        <h2 className="text-heading-sm font-semibold text-stone-900 mb-3">Attendance history</h2>

        {isLoading ? (
          <div className="space-y-px rounded-xl overflow-hidden border border-stone-200 bg-white shadow-sm">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="h-16" />)}
          </div>
        ) : historyAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white border border-stone-200 py-12 text-center shadow-sm">
            <div className="size-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
              <span className="text-xl">☕</span>
            </div>
            <p className="text-body-md font-medium text-stone-600">Enjoy your rest</p>
            <p className="text-body-sm text-stone-400 mt-1">Your shift records will appear here once you clock in.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            {historyAssignments.map((assignment, index) => {
              const hasClockedIn = !!assignment.clockRecord?.clockInAt;
              return (
                <div
                  key={assignment.id}
                  className={`flex items-center justify-between px-4 py-3.5 ${
                    index !== 0 ? 'border-t border-stone-100' : ''
                  }`}
                >
                  {/* Left: date + shift name */}
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-stone-900">
                      {formatDateLabel(assignment.date)}
                    </p>
                    <p className="text-label-sm text-stone-400 mt-0.5">{assignment.shift.name}</p>
                  </div>

                  {/* Right: times */}
                  {hasClockedIn ? (
                    <div className="shrink-0 text-right">
                      <p className="text-body-sm font-medium text-stone-900">
                        {formatTime(assignment.clockRecord?.clockInAt ?? null)}
                        {assignment.clockRecord?.clockOutAt && (
                          <> – {formatTime(assignment.clockRecord.clockOutAt)}</>
                        )}
                      </p>
                      <p className="text-label-sm text-stone-400 mt-0.5">
                        {formatClockMethod(assignment.clockRecord?.clockInMethod)}
                      </p>
                    </div>
                  ) : (
                    <span className="shrink-0 text-label-sm text-stone-400 italic">No record</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
