'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calendar, ChevronLeft, ChevronRight, MapPin, ShieldAlert, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Popover,
  Select,
  SkeletonTable,
  Table,
  type TableColumn,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { shiftService } from '@/services/shiftService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  ClockOverrideInput,
  CreateShiftAssignmentInput,
  Shift,
  ShiftAssignment,
  ShiftRole,
} from '@/types/shift';

type ShiftRow = Record<string, unknown> & Shift;
type AttendanceRow = Record<string, unknown> & ShiftAssignment;

interface ShiftFormState {
  name: string;
  startTime: string;
  endTime: string;
}

interface AssignmentModalState {
  isOpen: boolean;
  userId: string;
  date: string;
  shiftId: string;
}

interface OverrideModalState {
  isOpen: boolean;
  assignment: ShiftAssignment | null;
  action: ClockOverrideInput['action'];
  reason: string;
}

const emptyShiftForm: ShiftFormState = {
  name: '',
  startTime: '06:00',
  endTime: '14:00',
};

const roleOrder: ShiftRole[] = ['WAITER', 'CHEF', 'BARISTA'];

const roleBadgeStyle: Record<string, string> = {
  WAITER: 'bg-[#FDF3DC] text-[#92650A] border-[#F0D080]',
  CHEF: 'bg-[#FEF0E0] text-[#A04F0A] border-[#F5B87A]',
  BARISTA: 'bg-[#EDFAF1] text-[#1A6B3C] border-[#86EFAC]',
};

const roleAvatarStyle: Record<string, string> = {
  WAITER: 'bg-[#FDF3DC] text-[#92650A]',
  CHEF: 'bg-[#FEF0E0] text-[#A04F0A]',
  BARISTA: 'bg-[#EDFAF1] text-[#1A6B3C]',
};

const shiftCardColors = [
  { bg: 'bg-[#FDF3DC]', border: 'border-l-[#C4862A]', text: 'text-[#92650A]', dot: 'bg-[#C4862A]' },
  { bg: 'bg-[#FEF0E0]', border: 'border-l-[#D97706]', text: 'text-[#A04F0A]', dot: 'bg-[#D97706]' },
  { bg: 'bg-[#EDFAF1]', border: 'border-l-[#16A34A]', text: 'text-[#1A6B3C]', dot: 'bg-[#16A34A]' },
  { bg: 'bg-[#EFF6FF]', border: 'border-l-[#3B82F6]', text: 'text-[#1E40AF]', dot: 'bg-[#3B82F6]' },
  { bg: 'bg-[#F5F3FF]', border: 'border-l-[#8B5CF6]', text: 'text-[#5B21B6]', dot: 'bg-[#8B5CF6]' },
];

const getShiftColor = (shiftId: string, allShifts: Shift[]) => {
  const index = allShifts.findIndex((s) => s.id === shiftId);
  return shiftCardColors[index >= 0 ? index % shiftCardColors.length : 0];
};

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

const getMonday = (date: Date): Date => {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = current.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + offset);
  return current;
};

const formatWeekRange = (startDate: Date): string => {
  const endDate = addDays(startDate, 6);
  const startLabel = startDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const endLabel = endDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
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

export default function ShiftManagementPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [weekAssignments, setWeekAssignments] = useState<ShiftAssignment[]>([]);
  const [todayAssignments, setTodayAssignments] = useState<ShiftAssignment[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState<ShiftFormState>(emptyShiftForm);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftPendingDelete, setShiftPendingDelete] = useState<Shift | null>(null);
  const [assignmentPendingDelete, setAssignmentPendingDelete] = useState<ShiftAssignment | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<AssignmentModalState>({
    isOpen: false,
    userId: '',
    date: '',
    shiftId: '',
  });
  const [overrideModal, setOverrideModal] = useState<OverrideModalState>({
    isOpen: false,
    assignment: null,
    action: 'CLOCK_IN',
    reason: '',
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const todayDateKey = useMemo(() => dateToYmd(new Date()), []);

  const loadCoreData = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const [shiftResponse, staffResponse] = await Promise.all([
        shiftService.listShifts(accessToken),
        staffService.listStaff(accessToken, { isActive: true }),
      ]);

      setShifts(shiftResponse);
      setStaff(
        staffResponse
          .filter((person) => person.role === 'WAITER' || person.role === 'CHEF' || person.role === 'BARISTA')
          .sort((left, right) => {
            const leftRoleOrder = roleOrder.indexOf(left.role as ShiftRole);
            const rightRoleOrder = roleOrder.indexOf(right.role as ShiftRole);
            if (leftRoleOrder !== rightRoleOrder) {
              return leftRoleOrder - rightRoleOrder;
            }
            return left.name.localeCompare(right.name);
          }),
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load shift setup data.';
      toast({
        variant: 'error',
        title: 'Load failed',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  const loadAssignments = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    try {
      const today = dateToYmd(new Date());
      const [weekly, todayData] = await Promise.all([
        shiftService.listAssignments(
          {
            startDate: dateToYmd(weekStart),
            endDate: dateToYmd(addDays(weekStart, 6)),
          },
          accessToken,
        ),
        shiftService.listAssignments(
          {
            startDate: today,
            endDate: today,
          },
          accessToken,
        ),
      ]);

      setWeekAssignments(weekly);
      setTodayAssignments(todayData);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load shift assignments.';
      toast({
        variant: 'error',
        title: 'Load failed',
        message,
      });
    }
  }, [accessToken, toast, weekStart]);

  useEffect(() => {
    void loadCoreData();
  }, [loadCoreData]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const assignmentsBySlot = useMemo(() => {
    const map = new Map<string, ShiftAssignment[]>();
    for (const assignment of weekAssignments) {
      const key = `${assignment.userId}|${assignment.date}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(assignment);
      } else {
        map.set(key, [assignment]);
      }
    }
    return map;
  }, [weekAssignments]);

  const shiftRows = useMemo<ShiftRow[]>(() => {
    return shifts.map((shift) => ({ ...shift }));
  }, [shifts]);

  const attendanceRows = useMemo<AttendanceRow[]>(() => {
    return todayAssignments.map((assignment) => ({ ...assignment }));
  }, [todayAssignments]);

  const openCreateShiftModal = () => {
    setEditingShift(null);
    setShiftForm(emptyShiftForm);
    setIsShiftModalOpen(true);
  };

  const openEditShiftModal = (shift: Shift) => {
    setEditingShift(shift);
    setShiftForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    setIsSavingShift(true);
    try {
      if (editingShift) {
        const updated = await shiftService.updateShift(editingShift.id, shiftForm, accessToken);
        setShifts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast({
          variant: 'success',
          title: 'Shift updated',
        });
      } else {
        const created = await shiftService.createShift(shiftForm, accessToken);
        setShifts((current) => [...current, created].sort((left, right) => left.startTime.localeCompare(right.startTime)));
        toast({
          variant: 'success',
          title: 'Shift created',
        });
      }

      setIsShiftModalOpen(false);
      setEditingShift(null);
      setShiftForm(emptyShiftForm);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to save shift.';
      toast({
        variant: 'error',
        title: 'Save failed',
        message,
      });
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteShift = async (): Promise<void> => {
    if (!accessToken || !shiftPendingDelete) {
      return;
    }

    setIsSubmitting(true);
    try {
      await shiftService.deleteShift(shiftPendingDelete.id, accessToken);
      setShifts((current) => current.filter((item) => item.id !== shiftPendingDelete.id));
      setShiftPendingDelete(null);
      toast({
        variant: 'success',
        title: 'Shift deleted',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to delete shift.';
      toast({
        variant: 'error',
        title: 'Delete blocked',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAssignModal = (userId: string, date: string) => {
    if (date < todayDateKey) {
      toast({
        variant: 'warning',
        title: 'Cannot assign a past date',
        message: 'Choose today or a future date for new shift assignments.',
      });
      return;
    }

    setAssignmentModal({
      isOpen: true,
      userId,
      date,
      shiftId: shifts[0]?.id ?? '',
    });
  };

  const handleCreateAssignment = async (): Promise<void> => {
    if (!accessToken || !assignmentModal.userId || !assignmentModal.date || !assignmentModal.shiftId) {
      return;
    }

    setIsSubmitting(true);
    try {
      await shiftService.createAssignment(
        {
          userId: assignmentModal.userId,
          date: assignmentModal.date,
          shiftId: assignmentModal.shiftId,
        } satisfies CreateShiftAssignmentInput,
        accessToken,
      );
      setAssignmentModal((current) => ({ ...current, isOpen: false }));
      await loadAssignments();
      toast({
        variant: 'success',
        title: 'Shift assigned',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to assign shift.';
      toast({
        variant: 'error',
        title: 'Assignment failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (): Promise<void> => {
    if (!accessToken || !assignmentPendingDelete) {
      return;
    }

    setIsSubmitting(true);
    try {
      await shiftService.deleteAssignment(assignmentPendingDelete.id, accessToken);
      setAssignmentPendingDelete(null);
      await loadAssignments();
      toast({
        variant: 'success',
        title: 'Shift assignment removed',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to remove assignment.';
      toast({
        variant: 'error',
        title: 'Remove failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyOverride = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !overrideModal.assignment) {
      return;
    }

    setIsSavingOverride(true);
    try {
      await shiftService.clockOverride(
        {
          userId: overrideModal.assignment.userId,
          shiftAssignmentId: overrideModal.assignment.id,
          action: overrideModal.action,
          reason: overrideModal.reason,
        },
        accessToken,
      );

      setOverrideModal({
        isOpen: false,
        assignment: null,
        action: 'CLOCK_IN',
        reason: '',
      });
      await loadAssignments();
      toast({
        variant: 'success',
        title: 'Override applied',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to apply override.';
      toast({
        variant: 'error',
        title: 'Override failed',
        message,
      });
    } finally {
      setIsSavingOverride(false);
    }
  };

  const shiftColumns: TableColumn<ShiftRow>[] = [
    {
      key: 'name',
      label: 'Shift',
    },
    {
      key: 'startTime',
      label: 'Start',
    },
    {
      key: 'endTime',
      label: 'End',
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[160px]',
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditShiftModal(row)}>
            Edit
          </Button>
          <IconButton
            icon={<Trash2 size={16} />}
            label={`Delete ${row.name}`}
            size="sm"
            variant="destructive"
            onClick={() => setShiftPendingDelete(row)}
          />
        </div>
      ),
    },
  ];

  const attendanceColumns: TableColumn<AttendanceRow>[] = [
    {
      key: 'user',
      label: 'Staff',
      render: (_value, row) => (
        <div>
          <p className="text-body-sm font-medium text-stone-900">{row.user.name}</p>
          <p className="text-caption text-stone-500">{row.shift.name}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (_value, row) => (
        <span className="inline-flex rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-label-sm text-stone-700">
          {row.user.role}
        </span>
      ),
    },
    {
      key: 'clockIn',
      label: 'Clock In',
      render: (_value, row) => formatTime(row.clockRecord?.clockInAt ?? null),
    },
    {
      key: 'clockOut',
      label: 'Clock Out',
      render: (_value, row) => formatTime(row.clockRecord?.clockOutAt ?? null),
    },
    {
      key: 'method',
      label: 'Method',
      render: (_value, row) => {
        const isOverride =
          row.clockRecord?.clockInMethod === 'OVERRIDE' || row.clockRecord?.clockOutMethod === 'OVERRIDE';
        if (!row.clockRecord) {
          return <span className="text-stone-500">-</span>;
        }

        if (isOverride) {
          return (
            <div className="inline-flex items-center gap-2">
              <ShieldAlert size={16} className="text-[#A04F0A]" />
              <span className="text-body-sm text-[#A04F0A]">Override</span>
              {row.clockRecord.overrideNote ? (
                <Popover
                  trigger={
                    <button type="button" className="text-caption text-stone-500 underline">
                      Reason
                    </button>
                  }
                >
                  <div className="max-w-[220px] p-2 text-body-sm text-stone-700">{row.clockRecord.overrideNote}</div>
                </Popover>
              ) : null}
            </div>
          );
        }

        return (
          <span className="inline-flex items-center gap-1 text-body-sm text-stone-700">
            <MapPin size={14} />
            GPS
          </span>
        );
      },
    },
    {
      key: 'override',
      label: 'Override',
      className: 'w-[120px]',
      render: (_value, row) => {
        const isComplete = row.clockRecord?.clockInAt && row.clockRecord?.clockOutAt;
        if (isComplete) {
          return <span className="text-label-sm text-stone-400">Complete</span>;
        }
        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setOverrideModal({
                isOpen: true,
                assignment: row,
                action: row.clockRecord?.clockInAt && !row.clockRecord.clockOutAt ? 'CLOCK_OUT' : 'CLOCK_IN',
                reason: '',
              })
            }
          >
            Override
          </Button>
        );
      },
    },
  ];

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Shift Management"
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        subtitle="Manage shift definitions, weekly assignments, and daily attendance."
        action={<Button onClick={openCreateShiftModal}>Add Shift</Button>}
      />

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-heading-md font-semibold text-stone-900">Shift Definitions</h2>
        {isLoading ? (
          <SkeletonTable rows={4} columns={4} />
        ) : shifts.length === 0 ? (
          <EmptyState
            icon={<Calendar size={24} />}
            heading="No shifts yet"
            body="Create your first shift definition to start scheduling."
            action={<Button onClick={openCreateShiftModal}>Add Shift</Button>}
          />
        ) : (
          <Table columns={shiftColumns} data={shiftRows} keyField="id" />
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-heading-md font-semibold text-stone-900">Weekly Schedule</h2>
            <p className="mt-0.5 text-body-sm text-stone-500">{formatWeekRange(weekStart)}</p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<ChevronLeft size={18} />}
              label="Previous week"
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart((current) => addDays(current, -7))}
            />
            <IconButton
              icon={<ChevronRight size={18} />}
              label="Next week"
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart((current) => addDays(current, 7))}
            />
          </div>
        </div>

        <div className="p-4 sm:p-5">
        {isLoading ? (
          <SkeletonTable rows={5} columns={8} />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={<Calendar size={24} />}
            heading="No active staff found"
            body="Add active staff members first to create shift assignments."
          />
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[960px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-[180px] bg-white pb-3 pl-1 pr-3 text-left text-label-sm font-semibold uppercase tracking-wider text-stone-400">
                    Staff
                  </th>
                  {weekDays.map((day) => {
                    const dateKey = dateToYmd(day);
                    const isToday = dateKey === todayDateKey;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <th
                        key={dateKey}
                        className={`pb-3 text-center text-label-sm font-semibold uppercase tracking-wider ${
                          isToday ? 'text-espresso' : isWeekend ? 'text-stone-300' : 'text-stone-400'
                        }`}
                      >
                        <div className="text-[11px]">{day.toLocaleDateString([], { weekday: 'short' })}</div>
                        <div className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-caption font-semibold ${
                          isToday
                            ? 'bg-espresso text-crema'
                            : ''
                        }`}>
                          {day.getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staff.map((person, personIndex) => (
                  <tr key={person.id}>
                    <td className={`sticky left-0 z-10 bg-white py-3 pl-1 pr-3 ${personIndex > 0 ? 'border-t border-stone-100' : ''}`}>
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-sm font-semibold ${
                          roleAvatarStyle[person.role] ?? 'bg-stone-100 text-stone-600'
                        }`}>
                          {person.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-body-sm font-medium text-stone-900">{person.name}</p>
                          <span className={`mt-0.5 inline-flex rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight ${
                            roleBadgeStyle[person.role] ?? 'border-stone-200 bg-stone-100 text-stone-600'
                          }`}>
                            {person.role}
                          </span>
                        </div>
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const dateKey = dateToYmd(day);
                      const isPastDate = dateKey < todayDateKey;
                      const isToday = dateKey === todayDateKey;
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const cellAssignments = assignmentsBySlot.get(`${person.id}|${dateKey}`);
                      return (
                        <td
                          key={dateKey}
                          className={`px-1.5 py-2 align-top ${personIndex > 0 ? 'border-t border-stone-100' : ''} ${
                            isToday
                              ? 'bg-crema/40'
                              : isPastDate
                                ? 'bg-stone-50/40'
                                : isWeekend
                                  ? 'bg-stone-50/30'
                                  : ''
                          }`}
                        >
                          {cellAssignments && cellAssignments.length > 0 ? (
                            <div className="space-y-1.5">
                              {cellAssignments.map((assignment) => {
                                const color = getShiftColor(assignment.shiftId, shifts);
                                return (
                                  <div
                                    key={assignment.id}
                                    className={`group relative rounded-md border-l-[3px] ${color.border} ${color.bg} px-2 py-1.5 transition-shadow duration-fast hover:shadow-md`}
                                  >
                                    <p className={`text-label-sm font-semibold ${color.text}`}>
                                      {assignment.shift.name}
                                    </p>
                                    <p className="text-[10px] text-stone-500">
                                      {assignment.shift.startTime} – {assignment.shift.endTime}
                                    </p>
                                    {dateKey > todayDateKey && (
                                      <button
                                        type="button"
                                        className="absolute -right-0.5 -top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-[#991B1B] text-white group-hover:flex"
                                        onClick={() => setAssignmentPendingDelete(assignment)}
                                        aria-label={`Remove ${assignment.shift.name}`}
                                      >
                                        <Trash2 size={9} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                              {!isPastDate && (
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-center rounded-md border border-dashed border-stone-200 py-1 text-[10px] font-medium text-stone-400 transition-colors duration-fast hover:border-stone-300 hover:bg-stone-50 hover:text-stone-600"
                                  onClick={() => openAssignModal(person.id, dateKey)}
                                >
                                  +
                                </button>
                              )}
                            </div>
                          ) : (
                            isPastDate ? (
                              <div className="flex h-10 items-center justify-center">
                                <span className="text-caption text-stone-300">—</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="flex h-10 w-full items-center justify-center rounded-md border border-dashed border-transparent text-caption font-medium text-stone-300 transition-all duration-fast hover:border-stone-200 hover:bg-stone-50 hover:text-stone-500"
                                onClick={() => openAssignModal(person.id, dateKey)}
                              >
                                + Assign
                              </button>
                            )
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>

        {/* Shift color legend */}
        {shifts.length > 0 && !isLoading && (
          <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 px-5 py-3">
            {shifts.map((shift, index) => {
              const color = shiftCardColors[index % shiftCardColors.length];
              return (
                <div key={shift.id} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                  <span className="text-caption text-stone-500">
                    {shift.name} ({shift.startTime}–{shift.endTime})
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-heading-md font-semibold text-stone-900">Today&apos;s Attendance</h2>
        {isLoading ? (
          <SkeletonTable rows={4} columns={7} />
        ) : attendanceRows.length === 0 ? (
          <EmptyState
            icon={<Calendar size={24} />}
            heading="No one scheduled for this shift"
            body="There are no assignments for today."
          />
        ) : (
          <Table columns={attendanceColumns} data={attendanceRows} keyField="id" />
        )}
      </section>

      <Modal
        isOpen={isShiftModalOpen}
        onClose={() => {
          if (!isSavingShift) {
            setIsShiftModalOpen(false);
          }
        }}
        title={editingShift ? 'Edit Shift' : 'Create Shift'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsShiftModalOpen(false)} disabled={isSavingShift}>
              Cancel
            </Button>
            <Button form="shift-form" type="submit" isLoading={isSavingShift}>
              {editingShift ? 'Save Changes' : 'Create Shift'}
            </Button>
          </div>
        }
      >
        <form id="shift-form" className="space-y-4" onSubmit={(event) => void handleSaveShift(event)}>
          <Input
            label="Shift Name"
            value={shiftForm.name}
            onChange={(event) => setShiftForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Morning"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Start Time"
              type="time"
              value={shiftForm.startTime}
              onChange={(event) => setShiftForm((current) => ({ ...current, startTime: event.target.value }))}
            />
            <Input
              label="End Time"
              type="time"
              value={shiftForm.endTime}
              onChange={(event) => setShiftForm((current) => ({ ...current, endTime: event.target.value }))}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={assignmentModal.isOpen}
        onClose={() => {
          if (!isSubmitting) {
            setAssignmentModal((current) => ({ ...current, isOpen: false }));
          }
        }}
        title="Assign Shift"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setAssignmentModal((current) => ({ ...current, isOpen: false }))}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreateAssignment()} isLoading={isSubmitting}>
              Assign
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Date" value={assignmentModal.date} disabled />
          <Select
            label="Shift"
            value={assignmentModal.shiftId}
            onChange={(event) =>
              setAssignmentModal((current) => ({ ...current, shiftId: event.target.value }))
            }
            options={shifts.map((shift) => ({
              value: shift.id,
              label: `${shift.name} (${shift.startTime} - ${shift.endTime})`,
            }))}
          />
          <Select
            label="Staff"
            value={assignmentModal.userId}
            onChange={(event) =>
              setAssignmentModal((current) => ({ ...current, userId: event.target.value }))
            }
            options={staff.map((person) => ({
              value: person.id,
              label: `${person.name} (${person.role})`,
            }))}
          />
        </div>
      </Modal>

      <Modal
        isOpen={overrideModal.isOpen}
        onClose={() => {
          if (!isSavingOverride) {
            setOverrideModal({
              isOpen: false,
              assignment: null,
              action: 'CLOCK_IN',
              reason: '',
            });
          }
        }}
        title="Apply Attendance Override"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() =>
                setOverrideModal({
                  isOpen: false,
                  assignment: null,
                  action: 'CLOCK_IN',
                  reason: '',
                })
              }
              disabled={isSavingOverride}
            >
              Cancel
            </Button>
            <Button type="submit" form="override-form" isLoading={isSavingOverride}>
              Apply Override
            </Button>
          </div>
        }
      >
        <form id="override-form" className="space-y-4" onSubmit={(event) => void handleApplyOverride(event)}>
          <Input label="Staff Member" value={overrideModal.assignment?.user.name ?? ''} disabled />
          <Select
            label="Action"
            value={overrideModal.action}
            onChange={(event) =>
              setOverrideModal((current) => ({
                ...current,
                action: event.target.value as ClockOverrideInput['action'],
              }))
            }
            options={[
              { value: 'CLOCK_IN', label: 'Clock In' },
              { value: 'CLOCK_OUT', label: 'Clock Out' },
            ]}
          />
          <Input
            label="Reason"
            value={overrideModal.reason}
            onChange={(event) => setOverrideModal((current) => ({ ...current, reason: event.target.value }))}
            placeholder="e.g. GPS unavailable on device"
          />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(shiftPendingDelete)}
        onClose={() => {
          if (!isSubmitting) {
            setShiftPendingDelete(null);
          }
        }}
        onConfirm={() => void handleDeleteShift()}
        title="Delete shift?"
        description={
          shiftPendingDelete
            ? `Delete "${shiftPendingDelete.name}"? This is blocked if future assignments exist.`
            : 'Delete this shift?'
        }
        confirmLabel="Delete"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={Boolean(assignmentPendingDelete)}
        onClose={() => {
          if (!isSubmitting) {
            setAssignmentPendingDelete(null);
          }
        }}
        onConfirm={() => void handleDeleteAssignment()}
        title="Remove shift assignment?"
        description={
          assignmentPendingDelete
            ? `Remove ${assignmentPendingDelete.user.name} from ${assignmentPendingDelete.shift.name} on ${assignmentPendingDelete.date}?`
            : 'Remove this shift assignment?'
        }
        confirmLabel="Remove"
        isLoading={isSubmitting}
      />
    </PageLayout>
  );
}
