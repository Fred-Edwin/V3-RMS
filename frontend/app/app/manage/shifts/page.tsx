'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Copy, MapPin, Search, ShieldAlert, Trash2, Users, X } from 'lucide-react';
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
import { getTodayYmdInTimeZone, toYmdInTimeZone } from '@/lib/date';
import { shiftService } from '@/services/shiftService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  ClockOverrideInput,
  CopyWeekInput,
  CreateShiftAssignmentInput,
  Shift,
  ShiftAssignment,
  ShiftRole,
} from '@/types/shift';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month';
type BatchMode = 'recurrence' | 'specific';

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
  reasonCode: string;
  notes: string;
}

interface CopyWeekModalState {
  isOpen: boolean;
  sourceWeekStart: string; // YYYY-MM-DD (Monday)
  targetWeekStart: string; // YYYY-MM-DD (Monday)
}

interface BatchModalState {
  isOpen: boolean;
  mode: BatchMode;
  shiftId: string;
  selectedUserIds: Set<string>;
  // recurrence
  selectedDaysOfWeek: Set<number>; // 0=Sun … 6=Sat
  recurrenceMonth: string; // YYYY-MM
  // specific dates
  specificDates: Set<string>; // YYYY-MM-DD
}

// ─── Constants ───────────────────────────────────────────────────────────────

const emptyShiftForm: ShiftFormState = { name: '', startTime: '06:00', endTime: '14:00' };

const roleOrder: ShiftRole[] = ['WAITER', 'CHEF', 'BARISTA'];

const overrideReasonOptions = [
  { value: 'GPS permission denied', label: 'GPS permission denied' },
  { value: 'Device GPS unavailable', label: 'Device GPS unavailable' },
  { value: 'Weak indoor GPS signal', label: 'Weak indoor GPS signal' },
  { value: 'Network issue during clocking', label: 'Network issue during clocking' },
  { value: 'Other', label: 'Other' },
] as const;

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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Date helpers ─────────────────────────────────────────────────────────────

const dateToYmd = (value: Date): string => toYmdInTimeZone(value);

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

const getMonthStart = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const getMonthEnd = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

const formatWeekRange = (startDate: Date): string => {
  const endDate = addDays(startDate, 6);
  const startLabel = startDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const endLabel = endDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
};

const formatMonthLabel = (date: Date): string =>
  date.toLocaleDateString([], { month: 'long', year: 'numeric' });

/** All calendar cells for a month view (padding with prev/next month days). */
const buildMonthGrid = (monthStart: Date): Date[] => {
  const firstDow = monthStart.getDay(); // 0 = Sun
  const cells: Date[] = [];
  for (let i = firstDow; i > 0; i--) cells.push(addDays(monthStart, -i));
  const lastDay = getMonthEnd(monthStart).getDate();
  for (let d = 0; d < lastDay; d++) cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d + 1));
  while (cells.length % 7 !== 0) cells.push(addDays(cells[cells.length - 1], 1));
  return cells;
};

/** All YYYY-MM-DD dates matching the given days-of-week within a month. */
const getRecurrenceDates = (yearMonth: string, daysOfWeek: Set<number>): string[] => {
  if (!yearMonth || daysOfWeek.size === 0) return [];
  const [year, month] = yearMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = getMonthEnd(start);
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (daysOfWeek.has(cur.getDay())) dates.push(dateToYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const formatTime = (value: string | null): string => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getShiftColor = (shiftId: string, allShifts: Shift[]) => {
  const index = allShifts.findIndex((s) => s.id === shiftId);
  return shiftCardColors[index >= 0 ? index % shiftCardColors.length : 0];
};

// ─── Default batch modal state ────────────────────────────────────────────────

const defaultBatchModal = (): BatchModalState => {
  const now = new Date();
  return {
    isOpen: false,
    mode: 'recurrence',
    shiftId: '',
    selectedUserIds: new Set(),
    selectedDaysOfWeek: new Set(),
    recurrenceMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    specificDates: new Set(),
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftManagementPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [viewAssignments, setViewAssignments] = useState<ShiftAssignment[]>([]);
  const [todayAssignments, setTodayAssignments] = useState<ShiftAssignment[]>([]);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [monthStart, setMonthStart] = useState<Date>(() => getMonthStart(new Date()));

  // Schedule filters
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleRole, setScheduleRole] = useState<ShiftRole | ''>('');
  const [scheduleShiftId, setScheduleShiftId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState<ShiftFormState>(emptyShiftForm);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftPendingDelete, setShiftPendingDelete] = useState<Shift | null>(null);
  const [assignmentPendingDelete, setAssignmentPendingDelete] = useState<ShiftAssignment | null>(null);

  const [assignmentModal, setAssignmentModal] = useState<AssignmentModalState>({
    isOpen: false, userId: '', date: '', shiftId: '',
  });
  const [overrideModal, setOverrideModal] = useState<OverrideModalState>({
    isOpen: false, assignment: null, action: 'CLOCK_IN', reasonCode: '', notes: '',
  });
  const [batchModal, setBatchModal] = useState<BatchModalState>(defaultBatchModal);

  const [copyWeekModal, setCopyWeekModal] = useState<CopyWeekModalState>(() => {
    const thisMonday = dateToYmd(getMonday(new Date()));
    const prevMonday = dateToYmd(addDays(getMonday(new Date()), -7));
    return { isOpen: false, sourceWeekStart: prevMonday, targetWeekStart: thisMonday };
  });
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);

  // Batch-delete selection mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const todayDateKey = useMemo(() => getTodayYmdInTimeZone(), []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const monthGridDays = useMemo(() => buildMonthGrid(monthStart), [monthStart]);

  const viewStartDate = viewMode === 'week' ? dateToYmd(weekStart) : dateToYmd(monthStart);
  const viewEndDate = viewMode === 'week'
    ? dateToYmd(addDays(weekStart, 6))
    : dateToYmd(getMonthEnd(monthStart));

  const assignmentsBySlot = useMemo(() => {
    const map = new Map<string, ShiftAssignment[]>();
    for (const assignment of viewAssignments) {
      const key = `${assignment.userId}|${assignment.date}`;
      const existing = map.get(key);
      if (existing) existing.push(assignment);
      else map.set(key, [assignment]);
    }
    return map;
  }, [viewAssignments]);

  const shiftRows = useMemo<ShiftRow[]>(() => shifts.map((s) => ({ ...s })), [shifts]);
  const attendanceRows = useMemo<AttendanceRow[]>(() => todayAssignments.map((a) => ({ ...a })), [todayAssignments]);

  const filteredStaff = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase();
    return staff.filter((person) => {
      if (q && !person.name.toLowerCase().includes(q) && !person.email.toLowerCase().includes(q)) return false;
      if (scheduleRole && person.role !== scheduleRole) return false;
      if (scheduleShiftId) {
        // keep person only if they have at least one assignment matching this shift in the current view window
        const hasMatch = Array.from(assignmentsBySlot.entries()).some(
          ([key, assignments]) => key.startsWith(`${person.id}|`) && assignments.some((a) => a.shiftId === scheduleShiftId),
        );
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [staff, scheduleSearch, scheduleRole, scheduleShiftId, assignmentsBySlot]);

  const hasScheduleFilter = scheduleSearch !== '' || scheduleRole !== '' || scheduleShiftId !== '';

  // Dates that will be created by the current batch modal config — past dates silently excluded
  const batchPreviewDates = useMemo((): string[] => {
    if (!batchModal.isOpen) return [];
    const raw =
      batchModal.mode === 'recurrence'
        ? getRecurrenceDates(batchModal.recurrenceMonth, batchModal.selectedDaysOfWeek)
        : Array.from(batchModal.specificDates).sort();
    return raw.filter((d) => d >= todayDateKey);
  }, [batchModal.isOpen, batchModal.mode, batchModal.recurrenceMonth, batchModal.selectedDaysOfWeek, batchModal.specificDates, todayDateKey]);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadCoreData = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [shiftResponse, staffResponse] = await Promise.all([
        shiftService.listShifts(accessToken),
        staffService.listStaff(accessToken, { isActive: true }),
      ]);
      setShifts(shiftResponse);
      setStaff(
        staffResponse
          .filter((p) => p.role === 'WAITER' || p.role === 'CHEF' || p.role === 'BARISTA')
          .sort((a, b) => {
            const ai = roleOrder.indexOf(a.role as ShiftRole);
            const bi = roleOrder.indexOf(b.role as ShiftRole);
            return ai !== bi ? ai - bi : a.name.localeCompare(b.name);
          }),
      );
    } catch (error) {
      toast({ variant: 'error', title: 'Load failed', message: error instanceof ApiError ? error.message : 'Failed to load shift setup data.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  const loadAssignments = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    try {
      const today = getTodayYmdInTimeZone();
      const [viewData, todayData] = await Promise.all([
        shiftService.listAssignments({ startDate: viewStartDate, endDate: viewEndDate }, accessToken),
        shiftService.listAssignments({ startDate: today, endDate: today }, accessToken),
      ]);
      setViewAssignments(viewData);
      setTodayAssignments(todayData);
    } catch (error) {
      toast({ variant: 'error', title: 'Load failed', message: error instanceof ApiError ? error.message : 'Failed to load shift assignments.' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- viewStartDate/viewEndDate are derived from state, safe
  }, [accessToken, toast, viewStartDate, viewEndDate]);

  useEffect(() => { void loadCoreData(); }, [loadCoreData]);
  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  // ── Shift CRUD ─────────────────────────────────────────────────────────────

  const openCreateShiftModal = () => { setEditingShift(null); setShiftForm(emptyShiftForm); setIsShiftModalOpen(true); };
  const openEditShiftModal = (shift: Shift) => { setEditingShift(shift); setShiftForm({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime }); setIsShiftModalOpen(true); };

  const handleSaveShift = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) return;
    setIsSavingShift(true);
    try {
      if (editingShift) {
        const updated = await shiftService.updateShift(editingShift.id, shiftForm, accessToken);
        setShifts((cur) => cur.map((s) => (s.id === updated.id ? updated : s)));
        toast({ variant: 'success', title: 'Shift updated' });
      } else {
        const created = await shiftService.createShift(shiftForm, accessToken);
        setShifts((cur) => [...cur, created].sort((a, b) => a.startTime.localeCompare(b.startTime)));
        toast({ variant: 'success', title: 'Shift created' });
      }
      setIsShiftModalOpen(false); setEditingShift(null); setShiftForm(emptyShiftForm);
    } catch (error) {
      toast({ variant: 'error', title: 'Save failed', message: error instanceof ApiError ? error.message : 'Unable to save shift.' });
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteShift = async (): Promise<void> => {
    if (!accessToken || !shiftPendingDelete) return;
    setIsSubmitting(true);
    try {
      await shiftService.deleteShift(shiftPendingDelete.id, accessToken);
      setShifts((cur) => cur.filter((s) => s.id !== shiftPendingDelete.id));
      setShiftPendingDelete(null);
      toast({ variant: 'success', title: 'Shift deleted' });
    } catch (error) {
      toast({ variant: 'error', title: 'Delete blocked', message: error instanceof ApiError ? error.message : 'Unable to delete shift.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Single assignment ──────────────────────────────────────────────────────

  const openAssignModal = (userId: string, date: string) => {
    if (date < todayDateKey) {
      toast({ variant: 'warning', title: 'Cannot assign a past date', message: 'Choose today or a future date.' });
      return;
    }
    setAssignmentModal({ isOpen: true, userId, date, shiftId: shifts[0]?.id ?? '' });
  };

  const handleCreateAssignment = async (): Promise<void> => {
    if (!accessToken || !assignmentModal.userId || !assignmentModal.date || !assignmentModal.shiftId) return;
    setIsSubmitting(true);
    try {
      await shiftService.createAssignment(
        { userId: assignmentModal.userId, date: assignmentModal.date, shiftId: assignmentModal.shiftId } satisfies CreateShiftAssignmentInput,
        accessToken,
      );
      setAssignmentModal((c) => ({ ...c, isOpen: false }));
      await loadAssignments();
      toast({ variant: 'success', title: 'Shift assigned' });
    } catch (error) {
      toast({ variant: 'error', title: 'Assignment failed', message: error instanceof ApiError ? error.message : 'Unable to assign shift.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (): Promise<void> => {
    if (!accessToken || !assignmentPendingDelete) return;
    setIsSubmitting(true);
    try {
      await shiftService.deleteAssignment(assignmentPendingDelete.id, accessToken);
      setAssignmentPendingDelete(null);
      await loadAssignments();
      toast({ variant: 'success', title: 'Assignment removed' });
    } catch (error) {
      toast({ variant: 'error', title: 'Remove failed', message: error instanceof ApiError ? error.message : 'Unable to remove assignment.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Batch assignment ───────────────────────────────────────────────────────

  const openBatchModal = () => {
    setBatchModal({ ...defaultBatchModal(), isOpen: true, shiftId: shifts[0]?.id ?? '' });
  };

  const toggleBatchUser = (userId: string) => {
    setBatchModal((cur) => {
      const next = new Set(cur.selectedUserIds);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return { ...cur, selectedUserIds: next };
    });
  };

  const toggleBatchDayOfWeek = (dow: number) => {
    setBatchModal((cur) => {
      const next = new Set(cur.selectedDaysOfWeek);
      if (next.has(dow)) next.delete(dow); else next.add(dow);
      return { ...cur, selectedDaysOfWeek: next };
    });
  };

  const toggleSpecificDate = (dateKey: string) => {
    setBatchModal((cur) => {
      const next = new Set(cur.specificDates);
      if (next.has(dateKey)) next.delete(dateKey); else next.add(dateKey);
      return { ...cur, specificDates: next };
    });
  };

  const handleBatchSubmit = async (): Promise<void> => {
    if (!accessToken) return;
    if (batchModal.selectedUserIds.size === 0) {
      toast({ variant: 'warning', title: 'Select at least one staff member' }); return;
    }
    if (batchPreviewDates.length === 0) {
      toast({ variant: 'warning', title: batchModal.mode === 'recurrence' ? 'Select days of the week and a month' : 'Select at least one date' }); return;
    }

    // Warn if some dates are in the past but let backend validate per-row
    setIsBatchSubmitting(true);
    try {
      const result = await shiftService.batchCreateAssignments(
        { shiftId: batchModal.shiftId, userIds: Array.from(batchModal.selectedUserIds), dates: batchPreviewDates },
        accessToken,
      );
      setBatchModal(defaultBatchModal());
      await loadAssignments();
      const detail = result.skipped > 0 ? ` (${result.skipped} skipped — conflicts or duplicates)` : '';
      toast({ variant: result.created > 0 ? 'success' : 'warning', title: `${result.created} assignment${result.created === 1 ? '' : 's'} created${detail}` });
    } catch (error) {
      toast({ variant: 'error', title: 'Batch assign failed', message: error instanceof ApiError ? error.message : 'Unable to create assignments.' });
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  // ── Override ───────────────────────────────────────────────────────────────

  const buildOverrideReason = (reasonCode: string, notes: string): string => {
    const trimmedNotes = notes.trim();
    if (reasonCode === 'Other') return trimmedNotes;
    return trimmedNotes ? `${reasonCode}: ${trimmedNotes}` : reasonCode;
  };

  const getOverrideActionLabel = (action: ClockOverrideInput['action']): string => {
    if (action === 'CLOCK_IN') return 'Clock In';
    if (action === 'VOID_CLOCK_OUT') return 'Void Clock-Out';
    return 'Clock Out';
  };

  const handleApplyOverride = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !overrideModal.assignment) return;
    const resolvedReason = buildOverrideReason(overrideModal.reasonCode, overrideModal.notes);
    if (!resolvedReason.trim()) {
      toast({ variant: 'warning', title: 'Reason required', message: 'Choose or enter the reason for this attendance override.' }); return;
    }
    setIsSavingOverride(true);
    try {
      const response = await shiftService.clockOverride(
        { userId: overrideModal.assignment.userId, shiftAssignmentId: overrideModal.assignment.id, action: overrideModal.action, reason: resolvedReason },
        accessToken,
      );
      setOverrideModal({ isOpen: false, assignment: null, action: 'CLOCK_IN', reasonCode: '', notes: '' });
      await loadAssignments();
      toast({ variant: 'success', title: response.message ?? `${getOverrideActionLabel(overrideModal.action)} override applied` });
    } catch (error) {
      toast({ variant: 'error', title: 'Override failed', message: error instanceof ApiError ? error.message : 'Unable to apply override.' });
    } finally {
      setIsSavingOverride(false);
    }
  };

  // ── Copy week ──────────────────────────────────────────────────────────────

  const handleCopyWeek = async (): Promise<void> => {
    if (!accessToken) return;
    setIsCopyingWeek(true);
    try {
      const result = await shiftService.copyWeek(
        { sourceWeekStart: copyWeekModal.sourceWeekStart, targetWeekStart: copyWeekModal.targetWeekStart } satisfies CopyWeekInput,
        accessToken,
      );
      setCopyWeekModal((c) => ({ ...c, isOpen: false }));
      await loadAssignments();
      const detail = result.skipped > 0 ? ` (${result.skipped} skipped — duplicates or inactive shifts)` : '';
      toast({ variant: result.created > 0 ? 'success' : 'warning', title: `${result.created} assignment${result.created === 1 ? '' : 's'} copied${detail}` });
    } catch (error) {
      toast({ variant: 'error', title: 'Copy failed', message: error instanceof ApiError ? error.message : 'Unable to copy schedule.' });
    } finally {
      setIsCopyingWeek(false);
    }
  };

  // ── Batch delete ───────────────────────────────────────────────────────────

  const toggleSelectMode = () => {
    setIsSelectMode((v) => !v);
    setSelectedAssignmentIds(new Set());
  };

  const toggleAssignmentSelection = (id: string) => {
    setSelectedAssignmentIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async (): Promise<void> => {
    if (!accessToken || selectedAssignmentIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      const result = await shiftService.batchDeleteAssignments({ ids: Array.from(selectedAssignmentIds) }, accessToken);
      setSelectedAssignmentIds(new Set());
      setIsSelectMode(false);
      await loadAssignments();
      toast({ variant: 'success', title: `${result.deleted} assignment${result.deleted === 1 ? '' : 's'} deleted` });
    } catch (error) {
      toast({ variant: 'error', title: 'Delete failed', message: error instanceof ApiError ? error.message : 'Unable to delete assignments.' });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────

  const shiftColumns: TableColumn<ShiftRow>[] = [
    { key: 'name', label: 'Shift' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    {
      key: 'actions', label: 'Actions', className: 'w-[160px]',
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditShiftModal(row)}>Edit</Button>
          <IconButton icon={<Trash2 size={16} />} label={`Delete ${row.name}`} size="sm" variant="destructive" onClick={() => setShiftPendingDelete(row)} />
        </div>
      ),
    },
  ];

  const attendanceColumns: TableColumn<AttendanceRow>[] = [
    {
      key: 'user', label: 'Staff',
      render: (_value, row) => (
        <div>
          <p className="text-body-sm font-medium text-stone-900">{row.user.name}</p>
          <p className="text-caption text-stone-500">{row.shift.name}</p>
        </div>
      ),
    },
    {
      key: 'role', label: 'Role',
      render: (_value, row) => (
        <span className="inline-flex rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-label-sm text-stone-700">{row.user.role}</span>
      ),
    },
    { key: 'clockIn', label: 'Clock In', render: (_value, row) => formatTime(row.clockRecord?.clockInAt ?? null) },
    { key: 'clockOut', label: 'Clock Out', render: (_value, row) => formatTime(row.clockRecord?.clockOutAt ?? null) },
    {
      key: 'method', label: 'Method',
      render: (_value, row) => {
        const isOverride = row.clockRecord?.clockInMethod === 'OVERRIDE' || row.clockRecord?.clockOutMethod === 'OVERRIDE';
        if (!row.clockRecord) return <span className="text-stone-500">-</span>;
        if (isOverride) {
          return (
            <div className="inline-flex items-center gap-2">
              <ShieldAlert size={16} className="text-[#A04F0A]" />
              <span className="text-body-sm text-[#A04F0A]">Override</span>
              {row.clockRecord.overrideNote ? (
                <Popover trigger={<button type="button" className="text-caption text-stone-500 underline">Reason</button>}>
                  <div className="max-w-[220px] p-2 text-body-sm text-stone-700">{row.clockRecord.overrideNote}</div>
                </Popover>
              ) : null}
            </div>
          );
        }
        return <span className="inline-flex items-center gap-1 text-body-sm text-stone-700"><MapPin size={14} />GPS</span>;
      },
    },
    {
      key: 'override', label: 'Override', className: 'w-[200px]',
      render: (_value, row) => {
        const hasClockedIn = !!row.clockRecord?.clockInAt;
        const hasClockedOut = !!row.clockRecord?.clockOutAt;
        if (hasClockedIn && hasClockedOut) {
          return (
            <Button size="sm" variant="secondary" onClick={() => {
              setOverrideModal({ isOpen: true, assignment: row, action: 'VOID_CLOCK_OUT', reasonCode: '', notes: '' });
            }}>
              Void Clock-Out
            </Button>
          );
        }
        return (
          <Button size="sm" variant="secondary" onClick={() => {
            const nextAction = hasClockedIn ? 'CLOCK_OUT' : 'CLOCK_IN';
            setOverrideModal({ isOpen: true, assignment: row, action: nextAction, reasonCode: '', notes: '' });
          }}>
            {hasClockedIn ? 'Override Clock Out' : 'Override Clock In'}
          </Button>
        );
      },
    },
  ];

  // ── Schedule grid helpers ──────────────────────────────────────────────────

  const renderAssignmentCell = (personId: string, dateKey: string, isPastDate: boolean, isWeekend = false) => {
    const cellAssignments = assignmentsBySlot.get(`${personId}|${dateKey}`);
    return (
      <>
        {cellAssignments && cellAssignments.length > 0 ? (
          <div className="space-y-1.5">
            {cellAssignments.map((assignment) => {
              const color = getShiftColor(assignment.shiftId, shifts);
              const isSelected = selectedAssignmentIds.has(assignment.id);
              return (
                <div
                  key={assignment.id}
                  className={`group relative rounded-md border-l-[3px] ${color.border} ${color.bg} px-2 py-1.5 transition-shadow duration-fast hover:shadow-md ${isSelectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-[#991B1B]' : ''}`}
                  onClick={isSelectMode ? () => toggleAssignmentSelection(assignment.id) : undefined}
                >
                  {isSelectMode && (
                    <span className={`absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${isSelected ? 'border-[#991B1B] bg-[#991B1B]' : 'border-stone-400 bg-white'}`}>
                      {isSelected && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                    </span>
                  )}
                  <p className={`text-label-sm font-semibold ${color.text}`}>{assignment.shift.name}</p>
                  <p className="text-[10px] text-stone-500">{assignment.shift.startTime} – {assignment.shift.endTime}</p>
                  {!isSelectMode && (
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
            {!isPastDate && !isSelectMode && (
              <button
                type="button"
                className={`flex w-full items-center justify-center rounded-md border border-dashed py-1 text-[10px] font-medium transition-colors duration-fast ${
                  isWeekend
                    ? 'border-stone-100 text-stone-300 hover:border-stone-200 hover:text-stone-400'
                    : 'border-stone-200 text-stone-400 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-600'
                }`}
                onClick={() => openAssignModal(personId, dateKey)}
              >
                +
              </button>
            )}
          </div>
        ) : (
          isPastDate || isSelectMode ? (
            <div className="flex h-10 items-center justify-center">
              <span className="text-[11px] text-stone-200">—</span>
            </div>
          ) : (
            <button
              type="button"
              className={`flex h-10 w-full items-center justify-center rounded-md border border-dashed border-transparent text-caption font-medium transition-all duration-fast ${
                isWeekend
                  ? 'text-stone-200 hover:border-stone-100 hover:bg-stone-50/50 hover:text-stone-400'
                  : 'text-stone-300 hover:border-stone-200 hover:bg-stone-50 hover:text-stone-500'
              }`}
              onClick={() => openAssignModal(personId, dateKey)}
            >
              + Assign
            </button>
          )
        )}
      </>
    );
  };

  // ── Month view: single-staff day cell ─────────────────────────────────────

  const renderMonthCell = (day: Date, personId: string, isCurrentMonth: boolean) => {
    const dateKey = dateToYmd(day);
    const isPastDate = dateKey < todayDateKey;
    const isToday = dateKey === todayDateKey;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const cellAssignments = assignmentsBySlot.get(`${personId}|${dateKey}`);

    return (
      <div
        key={dateKey}
        className={`relative min-h-[72px] rounded-lg border p-1.5 transition-colors duration-fast ${
          !isCurrentMonth
            ? 'border-stone-100 bg-stone-50/30 opacity-40'
            : isToday
              ? 'border-[#C4862A]/30 bg-crema/30'
              : isPastDate
                ? 'border-stone-100 bg-stone-50/40'
                : isWeekend
                  ? 'border-stone-100 bg-stone-50/20'
                  : 'border-stone-100 bg-white hover:border-stone-200'
        }`}
      >
        <div className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
          isToday ? 'bg-espresso text-crema' : isCurrentMonth ? 'text-stone-500' : 'text-stone-300'
        }`}>
          {day.getDate()}
        </div>
        {isCurrentMonth && (
          <div className="space-y-0.5">
            {cellAssignments?.map((a) => {
              const color = getShiftColor(a.shiftId, shifts);
              const isSelected = selectedAssignmentIds.has(a.id);
              return (
                <div
                  key={a.id}
                  className={`group relative flex items-center gap-1 rounded px-1 py-0.5 ${color.bg} ${isSelectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-1 ring-[#991B1B]' : ''}`}
                  onClick={isSelectMode ? () => toggleAssignmentSelection(a.id) : undefined}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color.dot}`} />
                  <span className={`truncate text-[9px] font-medium leading-tight ${color.text}`}>{a.shift.name}</span>
                  {!isSelectMode && (
                    <button
                      type="button"
                      className="ml-auto hidden shrink-0 text-[#991B1B] group-hover:block"
                      onClick={() => setAssignmentPendingDelete(a)}
                      aria-label={`Remove ${a.shift.name}`}
                    >
                      <Trash2 size={8} />
                    </button>
                  )}
                </div>
              );
            })}
            {isCurrentMonth && !isPastDate && (
              <button
                type="button"
                className="flex w-full items-center justify-center rounded py-0.5 text-[9px] text-stone-300 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-500"
                onClick={() => openAssignModal(personId, dateKey)}
              >
                +
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Shift Management"
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        subtitle="Manage shift definitions, schedule assignments, and daily attendance."
        action={<Button onClick={openCreateShiftModal}>Add Shift</Button>}
      />

      {/* ── Shift Definitions ────────────────────────────────────────────── */}
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

      {/* ── Schedule Section ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-heading-md font-semibold text-stone-900">
              {viewMode === 'week' ? 'Weekly Schedule' : 'Monthly Schedule'}
            </h2>
            <p className="mt-0.5 text-body-sm text-stone-500">
              {viewMode === 'week' ? formatWeekRange(weekStart) : formatMonthLabel(monthStart)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-stone-200 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`rounded-md px-3 py-1.5 text-label-sm font-medium transition-colors duration-fast ${
                  viewMode === 'week' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`rounded-md px-3 py-1.5 text-label-sm font-medium transition-colors duration-fast ${
                  viewMode === 'month' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Month
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <IconButton
                icon={<ChevronLeft size={18} />}
                label={viewMode === 'week' ? 'Previous week' : 'Previous month'}
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (viewMode === 'week') setWeekStart((c) => addDays(c, -7));
                  else setMonthStart((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
                }}
              />
              <IconButton
                icon={<ChevronRight size={18} />}
                label={viewMode === 'week' ? 'Next week' : 'Next month'}
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (viewMode === 'week') setWeekStart((c) => addDays(c, 7));
                  else setMonthStart((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
                }}
              />
            </div>

            {/* Copy week */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCopyWeekModal((c) => ({ ...c, isOpen: true }))}
              disabled={shifts.length === 0 || staff.length === 0}
            >
              <Copy size={14} className="mr-1.5" />
              Copy Week
            </Button>

            {/* Batch assign */}
            <Button
              variant="secondary"
              size="sm"
              onClick={openBatchModal}
              disabled={shifts.length === 0 || staff.length === 0}
            >
              <Users size={14} className="mr-1.5" />
              Batch Assign
            </Button>

            {/* Select / batch delete */}
            {isSelectMode ? (
              <div className="flex items-center gap-2">
                <span className="text-label-sm text-stone-500">{selectedAssignmentIds.size} selected</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleBatchDelete()}
                  isLoading={isBatchDeleting}
                  disabled={selectedAssignmentIds.size === 0}
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Delete
                </Button>
                <Button size="sm" variant="secondary" onClick={toggleSelectMode} disabled={isBatchDeleting}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleSelectMode}
                disabled={viewAssignments.length === 0}
              >
                <Trash2 size={14} className="mr-1.5" />
                Select &amp; Delete
              </Button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50/50 px-5 py-3">
          {/* Name / email search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search staff…"
              value={scheduleSearch}
              onChange={(e) => setScheduleSearch(e.target.value)}
              className="h-8 rounded-lg border border-stone-200 bg-white pl-7 pr-3 text-label-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
            />
          </div>

          {/* Role filter */}
          <select
            value={scheduleRole}
            onChange={(e) => setScheduleRole(e.target.value as ShiftRole | '')}
            className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-label-sm text-stone-700 focus:border-stone-400 focus:outline-none"
          >
            <option value="">All roles</option>
            <option value="WAITER">Waiter</option>
            <option value="CHEF">Chef</option>
            <option value="BARISTA">Barista</option>
          </select>

          {/* Shift filter */}
          <select
            value={scheduleShiftId}
            onChange={(e) => setScheduleShiftId(e.target.value)}
            className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-label-sm text-stone-700 focus:border-stone-400 focus:outline-none"
          >
            <option value="">All shifts</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Clear */}
          {hasScheduleFilter && (
            <button
              type="button"
              onClick={() => { setScheduleSearch(''); setScheduleRole(''); setScheduleShiftId(''); }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-label-sm text-stone-500 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={12} />
              Clear
            </button>
          )}

          {/* Result count */}
          {hasScheduleFilter && (
            <span className="ml-auto text-caption text-stone-400">
              {filteredStaff.length} of {staff.length} staff
            </span>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {isLoading ? (
            <SkeletonTable rows={5} columns={viewMode === 'week' ? 8 : 7} />
          ) : staff.length === 0 ? (
            <EmptyState
              icon={<Calendar size={24} />}
              heading="No active staff found"
              body="Add active staff members first to create shift assignments."
            />
          ) : filteredStaff.length === 0 ? (
            <EmptyState
              icon={<Search size={24} />}
              heading="No staff match your filters"
              body="Try adjusting the search, role, or shift filter."
            />
          ) : viewMode === 'week' ? (
            /* ── WEEK GRID ── */
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
                        <th key={dateKey} className={`pb-3 text-center text-label-sm font-semibold uppercase tracking-wider ${
                          isToday ? 'text-espresso' : isWeekend ? 'text-stone-300' : 'text-stone-400'
                        }`}>
                          <div className="text-[11px]">{day.toLocaleDateString([], { weekday: 'short' })}</div>
                          <div className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-caption font-semibold ${
                            isToday ? 'bg-espresso text-crema shadow-sm' : ''
                          }`}>
                            {day.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((person, personIndex) => (
                    <tr key={person.id}>
                      <td className={`sticky left-0 z-10 bg-white py-3 pl-1 pr-3 ${personIndex > 0 ? 'border-t border-stone-100' : ''}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-sm font-semibold ${roleAvatarStyle[person.role] ?? 'bg-stone-100 text-stone-600'}`}>
                            {person.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-body-sm font-medium text-stone-900">{person.name}</p>
                            <span className={`mt-0.5 inline-flex rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight ${roleBadgeStyle[person.role] ?? 'border-stone-200 bg-stone-100 text-stone-600'}`}>
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
                        return (
                          <td
                            key={dateKey}
                            className={`px-1.5 py-2 align-top ${personIndex > 0 ? 'border-t border-stone-100' : ''} ${
                              isToday
                                ? 'bg-crema/50'
                                : isPastDate
                                  ? 'bg-stone-50/60'
                                  : isWeekend
                                    ? 'bg-stone-50/30'
                                    : ''
                            }`}
                          >
                            {renderAssignmentCell(person.id, dateKey, isPastDate, isWeekend)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── MONTH GRID — one staff member at a time with tab strip ── */
            <MonthScheduleView
              staff={filteredStaff}
              monthGridDays={monthGridDays}
              monthStart={monthStart}
              renderMonthCell={renderMonthCell}
            />
          )}
        </div>

        {/* Shift legend */}
        {shifts.length > 0 && !isLoading && (
          <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 bg-stone-50 px-5 py-3">
            {shifts.map((shift, index) => {
              const color = shiftCardColors[index % shiftCardColors.length];
              return (
                <div key={shift.id} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                  <span className="text-caption text-stone-500">{shift.name} ({shift.startTime}–{shift.endTime})</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Today's Attendance ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-heading-md font-semibold text-stone-900">Today&apos;s Attendance</h2>
        {isLoading ? (
          <SkeletonTable rows={4} columns={7} />
        ) : attendanceRows.length === 0 ? (
          <EmptyState icon={<Calendar size={24} />} heading="No one scheduled today" body="There are no assignments for today." />
        ) : (
          <Table columns={attendanceColumns} data={attendanceRows} keyField="id" />
        )}
      </section>

      {/* ── Modals ───────────────────────────────────────────────────────── */}

      {/* Shift CRUD modal */}
      <Modal
        isOpen={isShiftModalOpen}
        onClose={() => { if (!isSavingShift) setIsShiftModalOpen(false); }}
        title={editingShift ? 'Edit Shift' : 'Create Shift'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsShiftModalOpen(false)} disabled={isSavingShift}>Cancel</Button>
            <Button form="shift-form" type="submit" isLoading={isSavingShift}>{editingShift ? 'Save Changes' : 'Create Shift'}</Button>
          </div>
        }
      >
        <form id="shift-form" className="space-y-4" onSubmit={(e) => void handleSaveShift(e)}>
          <Input label="Shift Name" value={shiftForm.name} onChange={(e) => setShiftForm((c) => ({ ...c, name: e.target.value }))} placeholder="e.g. Morning" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Start Time" type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm((c) => ({ ...c, startTime: e.target.value }))} />
            <Input label="End Time" type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm((c) => ({ ...c, endTime: e.target.value }))} />
          </div>
        </form>
      </Modal>

      {/* Single assign modal */}
      <Modal
        isOpen={assignmentModal.isOpen}
        onClose={() => { if (!isSubmitting) setAssignmentModal((c) => ({ ...c, isOpen: false })); }}
        title="Assign Shift"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAssignmentModal((c) => ({ ...c, isOpen: false }))} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={() => void handleCreateAssignment()} isLoading={isSubmitting}>Assign</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Date" value={assignmentModal.date} disabled />
          <Select label="Shift" value={assignmentModal.shiftId} onChange={(e) => setAssignmentModal((c) => ({ ...c, shiftId: e.target.value }))} options={shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.startTime} – ${s.endTime})` }))} />
          <Select label="Staff" value={assignmentModal.userId} onChange={(e) => setAssignmentModal((c) => ({ ...c, userId: e.target.value }))} options={staff.map((p) => ({ value: p.id, label: `${p.name} (${p.role})` }))} />
        </div>
      </Modal>

      {/* Batch assign modal */}
      <Modal
        isOpen={batchModal.isOpen}
        onClose={() => { if (!isBatchSubmitting) setBatchModal(defaultBatchModal()); }}
        title="Batch Assign Shifts"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-stone-500">
              {batchPreviewDates.length > 0 && batchModal.selectedUserIds.size > 0
                ? `${batchPreviewDates.length} date${batchPreviewDates.length === 1 ? '' : 's'} × ${batchModal.selectedUserIds.size} staff = up to ${batchPreviewDates.length * batchModal.selectedUserIds.size} assignments`
                : 'Select staff and dates to preview'}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setBatchModal(defaultBatchModal())} disabled={isBatchSubmitting}>Cancel</Button>
              <Button onClick={() => void handleBatchSubmit()} isLoading={isBatchSubmitting}>Create Assignments</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Shift picker */}
          <Select
            label="Shift"
            value={batchModal.shiftId}
            onChange={(e) => setBatchModal((c) => ({ ...c, shiftId: e.target.value }))}
            options={shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.startTime} – ${s.endTime})` }))}
          />

          {/* Staff multi-select */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-label-sm font-medium text-stone-700">Staff Members</label>
              <button
                type="button"
                onClick={() => setBatchModal((c) => ({
                  ...c,
                  selectedUserIds: c.selectedUserIds.size === staff.length ? new Set() : new Set(staff.map((p) => p.id)),
                }))}
                className="text-caption text-stone-400 underline hover:text-stone-600"
              >
                {batchModal.selectedUserIds.size === staff.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {staff.map((person) => {
                const selected = batchModal.selectedUserIds.has(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggleBatchUser(person.id)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-fast ${
                      selected
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-sm font-semibold ${
                      selected ? 'bg-white/20 text-white' : roleAvatarStyle[person.role] ?? 'bg-stone-100 text-stone-600'
                    }`}>
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium">{person.name}</p>
                      <p className={`text-caption ${selected ? 'text-white/70' : 'text-stone-500'}`}>{person.role}</p>
                    </div>
                    <div className={`ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected ? 'border-white bg-white' : 'border-stone-300'
                    }`}>
                      {selected && <span className="h-2 w-2 rounded-sm bg-stone-900" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <label className="mb-2 block text-label-sm font-medium text-stone-700">Date Selection Mode</label>
            <div className="flex rounded-lg border border-stone-200 p-0.5">
              <button
                type="button"
                onClick={() => setBatchModal((c) => ({ ...c, mode: 'recurrence' }))}
                className={`flex-1 rounded-md py-2 text-label-sm font-medium transition-colors duration-fast ${
                  batchModal.mode === 'recurrence' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Recurring Days
              </button>
              <button
                type="button"
                onClick={() => setBatchModal((c) => ({ ...c, mode: 'specific' }))}
                className={`flex-1 rounded-md py-2 text-label-sm font-medium transition-colors duration-fast ${
                  batchModal.mode === 'specific' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Specific Dates
              </button>
            </div>
          </div>

          {batchModal.mode === 'recurrence' ? (
            /* Recurrence */
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-label-sm font-medium text-stone-700">Days of Week</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, dow) => {
                    const selected = batchModal.selectedDaysOfWeek.has(dow);
                    return (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => toggleBatchDayOfWeek(dow)}
                        className={`flex h-9 w-12 items-center justify-center rounded-lg border text-label-sm font-medium transition-all duration-fast ${
                          selected
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Month</label>
                <input
                  type="month"
                  value={batchModal.recurrenceMonth}
                  onChange={(e) => setBatchModal((c) => ({ ...c, recurrenceMonth: e.target.value }))}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
                />
              </div>
              {batchPreviewDates.length > 0 && (
                <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
                  <p className="mb-1.5 text-label-sm font-medium text-stone-600">
                    {batchPreviewDates.length} date{batchPreviewDates.length === 1 ? '' : 's'} will be scheduled
                  </p>
                  <p className="text-caption text-stone-400">{batchPreviewDates.join('  ·  ')}</p>
                </div>
              )}
            </div>
          ) : (
            /* Specific dates — mini calendar */
            <SpecificDatePicker
              selectedDates={batchModal.specificDates}
              todayDateKey={todayDateKey}
              onToggle={toggleSpecificDate}
            />
          )}
        </div>
      </Modal>

      {/* Override modal */}
      <Modal
        isOpen={overrideModal.isOpen}
        onClose={() => { if (!isSavingOverride) setOverrideModal({ isOpen: false, assignment: null, action: 'CLOCK_IN', reasonCode: '', notes: '' }); }}
        title={`${getOverrideActionLabel(overrideModal.action)} Attendance Override`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOverrideModal({ isOpen: false, assignment: null, action: 'CLOCK_IN', reasonCode: '', notes: '' })} disabled={isSavingOverride}>Cancel</Button>
            <Button type="submit" form="override-form" isLoading={isSavingOverride}>{getOverrideActionLabel(overrideModal.action)}</Button>
          </div>
        }
      >
        <form id="override-form" className="space-y-4" onSubmit={(e) => void handleApplyOverride(e)}>
          <Input label="Staff Member" value={overrideModal.assignment?.user.name ?? ''} disabled />
          <Input label="Action" value={getOverrideActionLabel(overrideModal.action)} disabled />
          <p className="text-body-sm text-stone-500">
            {overrideModal.action === 'CLOCK_IN'
              ? 'Use this when a staff member should be starting their shift but GPS failed.'
              : overrideModal.action === 'VOID_CLOCK_OUT'
                ? 'Use this when a staff member accidentally clocked out. This will clear the clock-out so they can continue their shift.'
                : 'Use this when a staff member already clocked in and needs help closing the shift.'}
          </p>
          <Select
            label="Reason"
            value={overrideModal.reasonCode}
            onChange={(e) => setOverrideModal((c) => ({ ...c, reasonCode: e.target.value }))}
            options={[{ value: '', label: 'Select a reason' }, ...overrideReasonOptions.map((o) => ({ value: o.value, label: o.label }))]}
          />
          <Input
            label={overrideModal.reasonCode === 'Other' ? 'Reason details' : 'Additional note'}
            value={overrideModal.notes}
            onChange={(e) => setOverrideModal((c) => ({ ...c, notes: e.target.value }))}
            placeholder={overrideModal.reasonCode === 'Other' ? 'Describe why the override is needed' : 'Optional note for the audit trail'}
          />
        </form>
      </Modal>

      {/* Copy week modal */}
      <Modal
        isOpen={copyWeekModal.isOpen}
        onClose={() => { if (!isCopyingWeek) setCopyWeekModal((c) => ({ ...c, isOpen: false })); }}
        title="Copy Week Schedule"
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-stone-500">Existing assignments in the target week are kept — duplicates are skipped.</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setCopyWeekModal((c) => ({ ...c, isOpen: false }))} disabled={isCopyingWeek}>Cancel</Button>
              <Button onClick={() => void handleCopyWeek()} isLoading={isCopyingWeek} disabled={copyWeekModal.sourceWeekStart === copyWeekModal.targetWeekStart}>Copy Schedule</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-body-sm text-stone-600">
            Pick a source week and a target week. Every assignment is copied to the same day of the target week.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Copy from</label>
              <input
                type="date"
                value={copyWeekModal.sourceWeekStart}
                onChange={(e) => {
                  const monday = dateToYmd(getMonday(new Date(e.target.value + 'T00:00:00')));
                  setCopyWeekModal((c) => ({ ...c, sourceWeekStart: monday }));
                }}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
              />
              {copyWeekModal.sourceWeekStart && (
                <p className="mt-1 text-caption text-stone-400">{formatWeekRange(new Date(copyWeekModal.sourceWeekStart + 'T00:00:00'))}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Copy to</label>
              <input
                type="date"
                value={copyWeekModal.targetWeekStart}
                onChange={(e) => {
                  const monday = dateToYmd(getMonday(new Date(e.target.value + 'T00:00:00')));
                  setCopyWeekModal((c) => ({ ...c, targetWeekStart: monday }));
                }}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-body-sm text-stone-900 focus:border-stone-400 focus:outline-none"
              />
              {copyWeekModal.targetWeekStart && (
                <p className="mt-1 text-caption text-stone-400">{formatWeekRange(new Date(copyWeekModal.targetWeekStart + 'T00:00:00'))}</p>
              )}
            </div>
          </div>
          {copyWeekModal.sourceWeekStart === copyWeekModal.targetWeekStart && (
            <p className="text-label-sm text-[#991B1B]">Source and target week must be different.</p>
          )}
        </div>
      </Modal>

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={Boolean(shiftPendingDelete)}
        onClose={() => { if (!isSubmitting) setShiftPendingDelete(null); }}
        onConfirm={() => void handleDeleteShift()}
        title="Delete shift?"
        description={shiftPendingDelete ? `Delete "${shiftPendingDelete.name}"? This will also remove all associated assignments.` : 'Delete this shift?'}
        confirmLabel="Delete"
        isLoading={isSubmitting}
      />
      <ConfirmDialog
        isOpen={Boolean(assignmentPendingDelete)}
        onClose={() => { if (!isSubmitting) setAssignmentPendingDelete(null); }}
        onConfirm={() => void handleDeleteAssignment()}
        title="Remove shift assignment?"
        description={assignmentPendingDelete ? `Remove ${assignmentPendingDelete.user.name} from ${assignmentPendingDelete.shift.name} on ${assignmentPendingDelete.date}?` : 'Remove this shift assignment?'}
        confirmLabel="Remove"
        isLoading={isSubmitting}
      />
    </PageLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MonthScheduleViewProps {
  staff: StaffDto[];
  monthGridDays: Date[];
  monthStart: Date;
  renderMonthCell: (day: Date, personId: string, isCurrentMonth: boolean) => JSX.Element;
}

function MonthScheduleView({ staff, monthGridDays, monthStart, renderMonthCell }: MonthScheduleViewProps): JSX.Element {
  const [activePersonIndex, setActivePersonIndex] = useState(0);
  const currentMonth = monthStart.getMonth();
  const activePerson = staff[activePersonIndex];

  return (
    <div className="space-y-4">
      {/* Staff tab strip — single scrolling row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {staff.map((person, index) => {
          const isActive = index === activePersonIndex;
          const roleColorMap: Record<string, string> = {
            WAITER: '#C4862A',
            CHEF: '#A04F0A',
            BARISTA: '#1A6B3C',
          };
          const accentColor = roleColorMap[person.role] ?? '#78716C';
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => setActivePersonIndex(index)}
              style={isActive ? { borderLeftColor: accentColor } : {}}
              className={`flex shrink-0 items-center gap-2 rounded-lg border border-l-[3px] px-3 py-2 text-left transition-all duration-fast ${
                isActive
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                {person.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-label-sm font-medium">{person.name}</span>
            </button>
          );
        })}
      </div>

      {activePerson && (
        <>
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-400">{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
            {monthGridDays.map((day) => {
              const isCurrentMonth = day.getMonth() === currentMonth;
              return renderMonthCell(day, activePerson.id, isCurrentMonth);
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface SpecificDatePickerProps {
  selectedDates: Set<string>;
  todayDateKey: string;
  onToggle: (dateKey: string) => void;
}

function SpecificDatePicker({ selectedDates, todayDateKey, onToggle }: SpecificDatePickerProps): JSX.Element {
  const [pickerMonth, setPickerMonth] = useState(() => getMonthStart(new Date()));
  const gridDays = useMemo(() => buildMonthGrid(pickerMonth), [pickerMonth]);
  const currentMonth = pickerMonth.getMonth();

  return (
    <div className="space-y-3">
      {/* Mini-calendar navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPickerMonth((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-700"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-label-sm font-semibold text-stone-700">
          {pickerMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => setPickerMonth((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-700"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-400">{d}</div>
        ))}
        {gridDays.map((day) => {
          const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isPast = dateKey < todayDateKey;
          const isSelected = selectedDates.has(dateKey);
          const isToday = dateKey === todayDateKey;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={isPast || !isCurrentMonth}
              onClick={() => onToggle(dateKey)}
              className={`flex h-8 w-full items-center justify-center rounded-lg text-label-sm font-medium transition-all duration-fast ${
                !isCurrentMonth || isPast
                  ? 'cursor-default text-stone-200'
                  : isSelected
                    ? 'bg-stone-900 text-white'
                    : isToday
                      ? 'border border-stone-300 text-stone-700 hover:bg-stone-100'
                      : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {selectedDates.size > 0 && (
        <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
          <p className="text-label-sm font-medium text-stone-600">
            {selectedDates.size} date{selectedDates.size === 1 ? '' : 's'} selected
          </p>
          <p className="mt-0.5 text-caption text-stone-400">
            {Array.from(selectedDates).sort().join('  ·  ')}
          </p>
        </div>
      )}
    </div>
  );
}
