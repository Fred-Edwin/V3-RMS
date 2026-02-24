'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, History } from 'lucide-react';
import { EmptyState, PageHeader, PageLayout, SkeletonTable } from '@/components/ui';
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
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
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
    if (!accessToken || (role !== 'WAITER' && role !== 'CHEF' && role !== 'BARISTA')) {
      return;
    }

    setIsLoading(true);
    try {
      const today = new Date();
      const todayKey = dateToYmd(today);
      const upcomingEndKey = dateToYmd(addDays(today, 7));
      const historyStartKey = dateToYmd(addDays(today, -30));
      const yesterdayKey = dateToYmd(addDays(today, -1));

      const [upcoming, history] = await Promise.all([
        shiftService.listAssignments(
          {
            startDate: todayKey,
            endDate: upcomingEndKey,
          },
          accessToken,
        ),
        shiftService.listAssignments(
          {
            startDate: historyStartKey,
            endDate: yesterdayKey,
          },
          accessToken,
        ),
      ]);

      const orderedUpcoming = [...upcoming].sort((left, right) =>
        `${left.date} ${left.shift.startTime}`.localeCompare(`${right.date} ${right.shift.startTime}`),
      );

      setUpcomingAssignments(orderedUpcoming);
      setHistoryAssignments(
        [...history].sort((left, right) =>
          `${right.date} ${right.shift.startTime}`.localeCompare(`${left.date} ${left.shift.startTime}`),
        ),
      );
      setTodayAssignment(orderedUpcoming.find((assignment) => assignment.date === todayKey) ?? null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load shifts.';
      toast({
        variant: 'error',
        title: 'Load failed',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, role, toast]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const todayKey = useMemo(() => dateToYmd(new Date()), []);

  const handleClockUpdated = useCallback((record: ShiftAssignmentClockRecord) => {
    setTodayAssignment((current) =>
      current
        ? {
            ...current,
            clockRecord: record,
          }
        : current,
    );
    setUpcomingAssignments((current) =>
      current.map((assignment) =>
        assignment.id === todayAssignment?.id
          ? {
              ...assignment,
              clockRecord: record,
            }
          : assignment,
      ),
    );
  }, [todayAssignment?.id]);

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader title="Shifts" subtitle="Your upcoming schedule and attendance history." />

      <ClockWidget assignment={todayAssignment} onUpdated={handleClockUpdated} />

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-heading-sm font-semibold text-stone-900">Upcoming 7 Days</h2>
        {isLoading ? (
          <SkeletonTable rows={4} columns={3} />
        ) : upcomingAssignments.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={24} />}
            heading="No upcoming shifts scheduled"
            body="Your next shifts will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {upcomingAssignments.map((assignment) => {
              const isToday = assignment.date === todayKey;
              return (
                <article
                  key={assignment.id}
                  className={`rounded-lg border p-4 ${
                    isToday ? 'border-[#F0D080] bg-[#FDF3DC]' : 'border-stone-200 bg-stone-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-body-sm text-stone-500">{formatDateLabel(assignment.date)}</p>
                      <h3 className="text-heading-sm font-semibold text-stone-900">{assignment.shift.name}</h3>
                      <p className="text-body-sm text-stone-600">
                        {assignment.shift.startTime} - {assignment.shift.endTime}
                      </p>
                    </div>
                    <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-label-sm text-stone-600">
                      {assignment.user.role}
                    </span>
                  </div>
                  {isToday && assignment.clockRecord ? (
                    <p className="mt-2 text-caption text-stone-600">
                      Clock In: {formatTime(assignment.clockRecord.clockInAt)} | Clock Out:{' '}
                      {formatTime(assignment.clockRecord.clockOutAt)}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-heading-sm font-semibold text-stone-900">Attendance History (Past 30 Days)</h2>
        {isLoading ? (
          <SkeletonTable rows={5} columns={5} />
        ) : historyAssignments.length === 0 ? (
          <EmptyState
            icon={<History size={24} />}
            heading="No attendance history yet"
            body="Your completed shift records will appear here."
          />
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="h-11 border-b-2 border-stone-200 px-3 text-left text-label-sm uppercase tracking-wider text-stone-500">
                    Date
                  </th>
                  <th className="h-11 border-b-2 border-stone-200 px-3 text-left text-label-sm uppercase tracking-wider text-stone-500">
                    Shift
                  </th>
                  <th className="h-11 border-b-2 border-stone-200 px-3 text-left text-label-sm uppercase tracking-wider text-stone-500">
                    Clock In
                  </th>
                  <th className="h-11 border-b-2 border-stone-200 px-3 text-left text-label-sm uppercase tracking-wider text-stone-500">
                    Clock Out
                  </th>
                  <th className="h-11 border-b-2 border-stone-200 px-3 text-left text-label-sm uppercase tracking-wider text-stone-500">
                    Method
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyAssignments.map((assignment) => (
                  <tr key={assignment.id} className="h-[52px] border-b border-stone-100">
                    <td className="px-3 text-body-sm text-stone-900">{formatDateLabel(assignment.date)}</td>
                    <td className="px-3 text-body-sm text-stone-900">{assignment.shift.name}</td>
                    <td className="px-3 text-body-sm text-stone-900">
                      {formatTime(assignment.clockRecord?.clockInAt ?? null)}
                    </td>
                    <td className="px-3 text-body-sm text-stone-900">
                      {formatTime(assignment.clockRecord?.clockOutAt ?? null)}
                    </td>
                    <td className="px-3 text-body-sm text-stone-900">
                      {assignment.clockRecord?.clockInMethod ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageLayout>
  );
}
