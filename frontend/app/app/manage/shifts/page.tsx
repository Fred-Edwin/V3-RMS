'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Copy, Expand, Minimize2, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageLayout,
  Select,
  SkeletonTable,
  Table,
  type TableColumn,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { getTodayYmdInTimeZone, toYmdInTimeZone } from '@/lib/date';
import { branchService, type BranchDto } from '@/services/branchService';
import { shiftService } from '@/services/shiftService';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { ClockOverrideInput, CopyWeekInput, Shift, ShiftAssignment, ShiftRole } from '@/types/shift';

type TabId = 'schedule' | 'attendance' | 'definitions';

type ShiftRow = Record<string, unknown> & Shift;
type AttendanceRow = Record<string, unknown> & ShiftAssignment;

interface ShiftFormState {
  name: string;
  startTime: string;
  endTime: string;
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
  sourceWeekStart: string;
  targetWeekStart: string;
}

type DraftValue = string | null;

const emptyShiftForm: ShiftFormState = { name: '', startTime: '06:00', endTime: '14:00' };
const roleOrder: ShiftRole[] = ['CHEF', 'WAITER', 'BARISTA'];
const OFF_VALUE = '__OFF__';

const overrideReasonOptions = [
  { value: 'GPS permission denied', label: 'GPS permission denied' },
  { value: 'Device GPS unavailable', label: 'Device GPS unavailable' },
  { value: 'Weak indoor GPS signal', label: 'Weak indoor GPS signal' },
  { value: 'Network issue during clocking', label: 'Network issue during clocking' },
  { value: 'Other', label: 'Other' },
] as const;

const shiftColorClasses = [
  'bg-[#FFF2D8] text-[#92650A]',
  'bg-[#EAF2FF] text-[#2856A3]',
  'bg-[#EFE8F8] text-[#5B2D8E]',
  'bg-[#E6F3E8] text-[#1F6E43]',
  'bg-[#FDF3DC] text-[#92650A]',
  'bg-[#FEF0E0] text-[#A04F0A]',
];

const dateToYmd = (value: Date): string => toYmdInTimeZone(value);

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getSunday = (date: Date): Date => {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  current.setDate(current.getDate() - current.getDay());
  return current;
};

const formatWeekRange = (startDate: Date): string => {
  const endDate = addDays(startDate, 6);
  const startLabel = startDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const endLabel = endDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
};

const formatTime = (value: string | null): string => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getShiftMinutes = (shift: Pick<Shift, 'startTime' | 'endTime'>): number => {
  const [startHour = 0, startMinute = 0] = shift.startTime.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = shift.endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  return end - start;
};

const formatHours = (minutes: number): string => {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
};

const getShiftColorClass = (shiftId: string, shifts: Shift[]): string => {
  const index = shifts.findIndex((shift) => shift.id === shiftId);
  return shiftColorClasses[index >= 0 ? index % shiftColorClasses.length : 0];
};

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

export default function ShiftManagementPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const canManageAllBranches = role === 'HR_MANAGER';

  const [activeTab, setActiveTab] = useState<TabId>('schedule');
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [viewAssignments, setViewAssignments] = useState<ShiftAssignment[]>([]);
  const [todayAssignments, setTodayAssignments] = useState<ShiftAssignment[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getSunday(new Date()));
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleRole, setScheduleRole] = useState<ShiftRole | ''>('');
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [multiSelectedCells, setMultiSelectedCells] = useState<Set<string>>(new Set());
  const [isSelectingCells, setIsSelectingCells] = useState(false);
  const [draftCells, setDraftCells] = useState<Map<string, DraftValue>>(new Map());
  const [cellErrors, setCellErrors] = useState<Map<string, string>>(new Map());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState<ShiftFormState>(emptyShiftForm);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftPendingDelete, setShiftPendingDelete] = useState<Shift | null>(null);
  const [overrideModal, setOverrideModal] = useState<OverrideModalState>({
    isOpen: false,
    assignment: null,
    action: 'CLOCK_IN',
    reasonCode: '',
    notes: '',
  });
  const [copyWeekModal, setCopyWeekModal] = useState<CopyWeekModalState>(() => {
    const thisWeek = dateToYmd(getSunday(new Date()));
    const prevWeek = dateToYmd(addDays(getSunday(new Date()), -7));
    return { isOpen: false, sourceWeekStart: prevWeek, targetWeekStart: thisWeek };
  });
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);
  const [autoSaveSequence, setAutoSaveSequence] = useState(0);
  const saveInFlightRef = useRef(false);
  const pendingAutoSaveRef = useRef(false);
  const shiftKeyPressedRef = useRef(false);

  const todayDateKey = useMemo(() => getTodayYmdInTimeZone(), []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const viewStartDate = dateToYmd(weekStart);
  const viewEndDate = dateToYmd(addDays(weekStart, 6));
  const dirtyCount = draftCells.size;
  const selectedCellCount = multiSelectedCells.size;

  const assignmentsBySlot = useMemo(() => {
    const map = new Map<string, ShiftAssignment[]>();
    for (const assignment of viewAssignments) {
      const key = `${assignment.userId}|${assignment.date}`;
      const current = map.get(key) ?? [];
      current.push(assignment);
      map.set(key, current);
    }
    return map;
  }, [viewAssignments]);

  const shiftMap = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);

  const filteredStaff = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase();
    return staff
      .filter((person) => {
        if (q && !person.name.toLowerCase().includes(q) && !person.email.toLowerCase().includes(q)) return false;
        if (scheduleRole && person.role !== scheduleRole) return false;
        return true;
      })
      .sort((left, right) => {
        const leftRole = roleOrder.indexOf(left.role as ShiftRole);
        const rightRole = roleOrder.indexOf(right.role as ShiftRole);
        return leftRole !== rightRole ? leftRole - rightRole : left.name.localeCompare(right.name);
      });
  }, [scheduleRole, scheduleSearch, staff]);

  const branchName = useMemo(() => {
    if (canManageAllBranches) {
      return branches.find((branch) => branch.id === selectedOrganizationId)?.name ?? 'Select branch';
    }
    return staff[0]?.organizationName ?? 'Current branch';
  }, [branches, canManageAllBranches, selectedOrganizationId, staff]);
  const scopedOrganizationId = canManageAllBranches ? selectedOrganizationId : undefined;
  const hasBranchScope = !canManageAllBranches || Boolean(selectedOrganizationId);
  const shiftRows = useMemo<ShiftRow[]>(() => shifts.map((shift) => ({ ...shift })), [shifts]);
  const attendanceRows = useMemo<AttendanceRow[]>(() => todayAssignments.map((assignment) => ({ ...assignment })), [todayAssignments]);

  const loadCoreData = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    if (canManageAllBranches && !selectedOrganizationId) {
      setIsLoading(false);
      setShifts([]);
      setStaff([]);
      return;
    }
    setIsLoading(true);
    try {
      const [shiftResponse, staffResponse] = await Promise.all([
        shiftService.listShifts(accessToken, scopedOrganizationId),
        staffService.listStaff(accessToken, { isActive: true, organizationId: scopedOrganizationId }),
      ]);
      setShifts(shiftResponse);
      setStaff(staffResponse.filter((person) => person.role === 'WAITER' || person.role === 'CHEF' || person.role === 'BARISTA'));
    } catch (error) {
      toast({ variant: 'error', title: 'Load failed', message: error instanceof ApiError ? error.message : 'Failed to load shift setup data.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, canManageAllBranches, scopedOrganizationId, selectedOrganizationId, toast]);

  const loadAssignments = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    if (canManageAllBranches && !selectedOrganizationId) {
      setViewAssignments([]);
      setTodayAssignments([]);
      setDraftCells(new Map());
      setCellErrors(new Map());
      setSelectedCell(null);
      setMultiSelectedCells(new Set());
      return;
    }
    try {
      const today = getTodayYmdInTimeZone();
      const [viewData, todayData] = await Promise.all([
        shiftService.listAssignments({ startDate: viewStartDate, endDate: viewEndDate, organizationId: scopedOrganizationId }, accessToken),
        shiftService.listAssignments({ startDate: today, endDate: today, organizationId: scopedOrganizationId }, accessToken),
      ]);
      setViewAssignments(viewData);
      setTodayAssignments(todayData);
      setDraftCells(new Map());
      setCellErrors(new Map());
      setSelectedCell(null);
      setMultiSelectedCells(new Set());
    } catch (error) {
      toast({ variant: 'error', title: 'Load failed', message: error instanceof ApiError ? error.message : 'Failed to load shift assignments.' });
    }
  }, [accessToken, canManageAllBranches, scopedOrganizationId, selectedOrganizationId, toast, viewEndDate, viewStartDate]);

  useEffect(() => {
    if (!accessToken || !canManageAllBranches) return;
    let isMounted = true;
    void branchService.listBranches(accessToken)
      .then((branchData) => {
        if (!isMounted) return;
        const activeBranches = branchData.filter((branch) => branch.isActive);
        setBranches(activeBranches);
        setSelectedOrganizationId((current) => current || activeBranches[0]?.id || '');
      })
      .catch((error) => {
        if (!isMounted) return;
        toast({ variant: 'error', title: 'Branches failed', message: error instanceof ApiError ? error.message : 'Failed to load branches.' });
      });
    return () => {
      isMounted = false;
    };
  }, [accessToken, canManageAllBranches, toast]);

  useEffect(() => { void loadCoreData(); }, [loadCoreData]);
  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  useEffect(() => {
    const handleMouseUp = (): void => setIsSelectingCells(false);
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Shift') {
        shiftKeyPressedRef.current = false;
        setIsSelectingCells(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const openCreateShiftModal = () => {
    setEditingShift(null);
    setShiftForm(emptyShiftForm);
    setIsShiftModalOpen(true);
  };

  const openEditShiftModal = (shift: Shift) => {
    setEditingShift(shift);
    setShiftForm({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime });
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) return;
    if (!hasBranchScope) {
      toast({ variant: 'warning', title: 'Select a branch', message: 'Choose a branch before editing shift definitions.' });
      return;
    }
    setIsSavingShift(true);
    try {
      if (editingShift) {
        const updated = await shiftService.updateShift(editingShift.id, { ...shiftForm, organizationId: scopedOrganizationId }, accessToken);
        setShifts((current) => current.map((shift) => (shift.id === updated.id ? updated : shift)));
        toast({ variant: 'success', title: 'Shift updated' });
      } else {
        const created = await shiftService.createShift({ ...shiftForm, organizationId: scopedOrganizationId }, accessToken);
        setShifts((current) => [...current, created].sort((a, b) => a.startTime.localeCompare(b.startTime)));
        toast({ variant: 'success', title: 'Shift created' });
      }
      setIsShiftModalOpen(false);
      setEditingShift(null);
      setShiftForm(emptyShiftForm);
    } catch (error) {
      toast({ variant: 'error', title: 'Save failed', message: error instanceof ApiError ? error.message : 'Unable to save shift.' });
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteShift = async (): Promise<void> => {
    if (!accessToken || !shiftPendingDelete || !hasBranchScope) return;
    setIsSubmitting(true);
    try {
      await shiftService.deleteShift(shiftPendingDelete.id, accessToken, scopedOrganizationId);
      setShifts((current) => current.filter((shift) => shift.id !== shiftPendingDelete.id));
      setShiftPendingDelete(null);
      toast({ variant: 'success', title: 'Shift deleted' });
    } catch (error) {
      toast({ variant: 'error', title: 'Delete blocked', message: error instanceof ApiError ? error.message : 'Unable to delete shift.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCellKey = (userId: string, date: string): string => `${userId}|${date}`;

  const toggleCellSelection = (cellKey: string): void => {
    setSelectedCell(cellKey);
    setMultiSelectedCells((current) => {
      const next = new Set(current);
      if (next.has(cellKey)) next.delete(cellKey);
      else next.add(cellKey);
      return next;
    });
  };

  const addCellSelection = (cellKey: string): void => {
    setSelectedCell(cellKey);
    setMultiSelectedCells((current) => {
      if (current.has(cellKey)) return current;
      const next = new Set(current);
      next.add(cellKey);
      return next;
    });
  };

  const clearSelectedShiftCells = (): void => {
    if (multiSelectedCells.size === 0) return;

    for (const cellKey of Array.from(multiSelectedCells)) {
      const [userId = '', date = ''] = cellKey.split('|');
      if (userId && date) updateDraftCell(userId, date, OFF_VALUE);
    }

    setMultiSelectedCells(new Set());
    setIsSelectingCells(false);
  };

  const getCellDraftOrCurrent = useCallback((userId: string, date: string): DraftValue | undefined => {
    const key = getCellKey(userId, date);
    if (draftCells.has(key)) return draftCells.get(key) ?? null;
    const assignments = assignmentsBySlot.get(key);
    if (!assignments || assignments.length === 0) return undefined;
    if (assignments.length === 1) return assignments[0]?.shiftId;
    return undefined;
  }, [assignmentsBySlot, draftCells]);

  const updateDraftCell = (userId: string, date: string, rawValue: string): void => {
    const key = getCellKey(userId, date);
    const nextValue = rawValue === OFF_VALUE ? null : rawValue;
    const currentAssignments = assignmentsBySlot.get(key) ?? [];
    const currentValue = currentAssignments.length === 1 ? currentAssignments[0]?.shiftId : undefined;
    setDraftCells((current) => {
      const next = new Map(current);
      if ((nextValue === null && currentAssignments.length === 0) || nextValue === currentValue) next.delete(key);
      else next.set(key, nextValue);
      return next;
    });
    setCellErrors((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  const handleSaveSchedule = useCallback(async (options: { silent?: boolean } = {}): Promise<void> => {
    if (!accessToken || draftCells.size === 0 || !hasBranchScope) return;
    if (saveInFlightRef.current) {
      pendingAutoSaveRef.current = true;
      return;
    }
    const draftSnapshot = new Map(draftCells);
    saveInFlightRef.current = true;
    setIsSavingSchedule(true);
    try {
      const changes = Array.from(draftSnapshot.entries()).map(([key, shiftId]) => {
        const [userId = '', date = ''] = key.split('|');
        return { userId, date, shiftId };
      });
      const result = await shiftService.reconcileWeek({ organizationId: scopedOrganizationId, weekStart: viewStartDate, changes }, accessToken);
      setViewAssignments(result.assignments);
      if (result.errors.length > 0) {
        const nextErrors = new Map<string, string>();
        for (const error of result.errors) nextErrors.set(getCellKey(error.userId, error.date), error.reason);
        setCellErrors(nextErrors);
        setDraftCells((current) => {
          const next = new Map(current);
          for (const key of Array.from(draftSnapshot.keys())) {
            next.delete(key);
          }
          for (const error of result.errors) {
            const key = getCellKey(error.userId, error.date);
            if (current.has(key)) next.set(key, current.get(key) ?? null);
            else if (draftSnapshot.has(key)) next.set(key, draftSnapshot.get(key) ?? null);
          }
          return next;
        });
        toast({ variant: 'warning', title: 'Some cells need attention', message: `${result.saved} saved, ${result.skipped} skipped.` });
      } else {
        setDraftCells((current) => {
          const next = new Map(current);
          for (const [key, value] of Array.from(draftSnapshot.entries())) {
            if (next.get(key) === value) next.delete(key);
          }
          return next;
        });
        setCellErrors(new Map());
        if (!options.silent) {
          toast({ variant: 'success', title: 'Schedule saved', message: `${result.saved} change${result.saved === 1 ? '' : 's'} saved.` });
        }
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Save failed', message: error instanceof ApiError ? error.message : 'Unable to save schedule.' });
    } finally {
      saveInFlightRef.current = false;
      setIsSavingSchedule(false);
      if (pendingAutoSaveRef.current) {
        pendingAutoSaveRef.current = false;
        setAutoSaveSequence((current) => current + 1);
      }
    }
  }, [accessToken, draftCells, hasBranchScope, scopedOrganizationId, toast, viewStartDate]);

  useEffect(() => {
    if (draftCells.size === 0 || !hasBranchScope || !accessToken) return;

    const timeoutId = window.setTimeout(() => {
      void handleSaveSchedule({ silent: true });
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [accessToken, autoSaveSequence, draftCells, handleSaveSchedule, hasBranchScope]);

  const handleCopyWeek = async (): Promise<void> => {
    if (!accessToken || !hasBranchScope) return;
    setIsCopyingWeek(true);
    try {
      const result = await shiftService.copyWeek(
        { organizationId: scopedOrganizationId, sourceWeekStart: copyWeekModal.sourceWeekStart, targetWeekStart: copyWeekModal.targetWeekStart } satisfies CopyWeekInput,
        accessToken,
      );
      setCopyWeekModal((current) => ({ ...current, isOpen: false }));
      await loadAssignments();
      const detail = result.skipped > 0 ? ` (${result.skipped} skipped)` : '';
      toast({ variant: result.created > 0 ? 'success' : 'warning', title: `${result.created} assignment${result.created === 1 ? '' : 's'} copied${detail}` });
    } catch (error) {
      toast({ variant: 'error', title: 'Copy failed', message: error instanceof ApiError ? error.message : 'Unable to copy schedule.' });
    } finally {
      setIsCopyingWeek(false);
    }
  };

  const handleApplyOverride = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !overrideModal.assignment) return;
    const resolvedReason = buildOverrideReason(overrideModal.reasonCode, overrideModal.notes);
    if (!resolvedReason.trim()) {
      toast({ variant: 'warning', title: 'Reason required', message: 'Choose or enter the reason for this attendance override.' });
      return;
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

  const shiftColumns: TableColumn<ShiftRow>[] = [
    { key: 'name', label: 'Shift' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[160px]',
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
      key: 'user',
      label: 'Staff',
      render: (_value, row) => (
        <div>
          <p className="text-body-sm font-medium text-stone-900">{row.user.name}</p>
          <p className="text-caption text-stone-500">{row.shift.name}</p>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (_value, row) => <span className="text-body-sm text-stone-700">{row.user.role}</span> },
    { key: 'clockIn', label: 'Clock In', render: (_value, row) => formatTime(row.clockRecord?.clockInAt ?? null) },
    { key: 'clockOut', label: 'Clock Out', render: (_value, row) => formatTime(row.clockRecord?.clockOutAt ?? null) },
    {
      key: 'method',
      label: 'Method',
      render: (_value, row) => {
        const isOverride = row.clockRecord?.clockInMethod === 'OVERRIDE' || row.clockRecord?.clockOutMethod === 'OVERRIDE';
        if (!row.clockRecord) return <span className="text-stone-500">-</span>;
        return isOverride ? <span className="inline-flex items-center gap-1 text-[#A04F0A]"><ShieldAlert size={14} />Override</span> : <span className="text-body-sm text-stone-700">GPS</span>;
      },
    },
    {
      key: 'override',
      label: 'Override',
      className: 'w-[190px]',
      render: (_value, row) => {
        if (canManageAllBranches) return <span className="text-stone-500">-</span>;
        const hasClockedIn = Boolean(row.clockRecord?.clockInAt);
        const hasClockedOut = Boolean(row.clockRecord?.clockOutAt);
        const nextAction: ClockOverrideInput['action'] = hasClockedIn ? 'CLOCK_OUT' : 'CLOCK_IN';
        if (hasClockedIn && hasClockedOut) {
          return <Button size="sm" variant="secondary" onClick={() => setOverrideModal({ isOpen: true, assignment: row, action: 'VOID_CLOCK_OUT', reasonCode: '', notes: '' })}>Void Clock-Out</Button>;
        }
        return <Button size="sm" variant="secondary" onClick={() => setOverrideModal({ isOpen: true, assignment: row, action: nextAction, reasonCode: '', notes: '' })}>{hasClockedIn ? 'Override Clock Out' : 'Override Clock In'}</Button>;
      },
    },
  ];

  const renderScheduleCell = (person: StaffDto, day: Date): JSX.Element => {
    const dateKey = dateToYmd(day);
    const cellKey = getCellKey(person.id, dateKey);
    const isPastDate = dateKey < todayDateKey;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const assignments = assignmentsBySlot.get(cellKey) ?? [];
    const draftValue = getCellDraftOrCurrent(person.id, dateKey);
    const error = cellErrors.get(cellKey);
    const isDirty = draftCells.has(cellKey);
    const isSelected = selectedCell === cellKey;
    const isMultiSelected = multiSelectedCells.has(cellKey);
    const selectedShift = draftValue ? shiftMap.get(draftValue) : null;
    const displayText = draftValue === null ? 'OFF' : selectedShift?.name ?? (assignments.length > 1 ? assignments.map((assignment) => assignment.shift.name).join(' / ') : 'OFF');

    return (
      <td
        key={dateKey}
        className={cn('border border-[#d0d0d0] p-0 text-center align-middle', isWeekend && 'bg-[#fafafa]')}
        title={error ?? undefined}
      >
        <div
          className={cn(
            'relative flex min-h-[38px] items-center justify-center border-2 border-transparent px-1.5 text-[12px] font-bold',
            selectedShift ? getShiftColorClass(selectedShift.id, shifts) : 'bg-[#f4f4f4] text-stone-500',
            isSelected && 'border-[#1a73e8] shadow-[inset_0_0_0_1px_#1a73e8]',
            isMultiSelected && 'border-[#217346] shadow-[inset_0_0_0_1px_#217346]',
            isDirty && 'after:absolute after:right-0.5 after:top-0.5 after:h-0 after:w-0 after:border-l-[7px] after:border-t-[7px] after:border-l-transparent after:border-t-[#d97706]',
            error && 'border-[#fca5a5] bg-[#fef2f2] text-[#991b1b]',
            isPastDate && 'opacity-60',
          )}
          onMouseDown={(event) => {
            if (isPastDate) return;
            if (event.shiftKey) {
              event.preventDefault();
              shiftKeyPressedRef.current = true;
              setIsSelectingCells(true);
              toggleCellSelection(cellKey);
            } else {
              setSelectedCell(cellKey);
            }
          }}
          onMouseEnter={() => {
            if (!isPastDate && isSelectingCells && shiftKeyPressedRef.current) addCellSelection(cellKey);
          }}
          onClick={() => setSelectedCell(cellKey)}
          title={error ?? 'Shift-click to select multiple cells'}
        >
          {isPastDate || isMultiSelected ? (
            <span>{displayText}</span>
          ) : (
            <select
              aria-label={`${person.name} ${dateKey}`}
              value={draftValue ?? OFF_VALUE}
              onChange={(event) => updateDraftCell(person.id, dateKey, event.target.value)}
              onFocus={() => setSelectedCell(cellKey)}
              className="h-full w-full appearance-none bg-transparent text-center font-bold outline-none"
            >
              <option value={OFF_VALUE}>OFF</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>{shift.name}</option>
              ))}
            </select>
          )}
        </div>
      </td>
    );
  };

  const staffWithHours = useMemo(() => filteredStaff.map((person) => {
    const minutes = weekDays.reduce((sum, day) => {
      const dateKey = dateToYmd(day);
      const value = getCellDraftOrCurrent(person.id, dateKey);
      if (value === null) return sum;
      if (value) {
        const shift = shiftMap.get(value);
        return shift ? sum + getShiftMinutes(shift) : sum;
      }
      const assignments = assignmentsBySlot.get(getCellKey(person.id, dateKey)) ?? [];
      return sum + assignments.reduce((inner, assignment) => inner + getShiftMinutes(assignment.shift), 0);
    }, 0);
    return { person, minutes };
  }), [assignmentsBySlot, filteredStaff, getCellDraftOrCurrent, shiftMap, weekDays]);

  const scheduleTotals = useMemo(() => {
    const assigned = staffWithHours.reduce((sum, row) => sum + weekDays.filter((day) => {
      const value = getCellDraftOrCurrent(row.person.id, dateToYmd(day));
      if (value === null) return false;
      if (value) return true;
      return (assignmentsBySlot.get(getCellKey(row.person.id, dateToYmd(day))) ?? []).length > 0;
    }).length, 0);
    const possible = filteredStaff.length * 7;
    const minutes = staffWithHours.reduce((sum, row) => sum + row.minutes, 0);
    return { assigned, off: Math.max(possible - assigned, 0), minutes };
  }, [assignmentsBySlot, filteredStaff.length, getCellDraftOrCurrent, staffWithHours, weekDays]);

  const scheduleSheet = (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[20px] border border-stone-200 bg-white shadow-sm', isExpanded && 'rounded-none border-0')}>
      {selectedCellCount > 0 && (
        <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-[#d0d0d0] bg-[#fff8e8] px-3 font-['Calibri','Segoe_UI',Arial,sans-serif] text-[12px]">
          <span className="font-bold text-[#6b4226]">{selectedCellCount} cell{selectedCellCount === 1 ? '' : 's'} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={clearSelectedShiftCells}>Clear shifts</Button>
            <IconButton icon={<X size={15} />} label="Cancel cell selection" size="sm" variant="ghost" onClick={() => setMultiSelectedCells(new Set())} />
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} columns={9} /></div>
        ) : filteredStaff.length === 0 ? (
          <EmptyState icon={<Search size={24} />} heading="No staff match your filters" body="Try adjusting search or role filters." />
        ) : (
          <table className="w-full min-w-[1180px] table-fixed border-collapse font-['Calibri','Segoe_UI',Arial,sans-serif] text-[12px]">
            <colgroup>
              <col className="w-[34px]" />
              <col className="w-[240px]" />
              {weekDays.map((day) => <col key={dateToYmd(day)} className="w-[128px]" />)}
              <col className="w-[84px]" />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-20">
                <th className="border border-white/30 bg-[#2e5984]"></th>
                <th className="border border-white/30 bg-[#2e5984] px-2 text-left text-[10px] font-extrabold uppercase tracking-wider text-white">Shift roster - {formatWeekRange(weekStart)}</th>
                <th colSpan={7} className="border border-white/30 bg-[#2e5984] text-center text-[10px] font-extrabold uppercase tracking-wider text-white">Weekly Schedule</th>
                <th className="border border-white/30 bg-[#217346] text-center text-[10px] font-extrabold uppercase tracking-wider text-white">Total</th>
              </tr>
              <tr className="sticky top-[22px] z-20 h-12">
                <th className="border border-[#d0d0d0] bg-[#e8ebef] text-stone-500">1</th>
                <th className="border border-[#d0d0d0] border-r-2 border-r-[#c5c5c5] bg-[#f5f5f5] px-2 text-left text-[14px] font-extrabold text-[#3f7fe8]">NAME</th>
                {weekDays.map((day) => (
                  <th key={dateToYmd(day)} className="border border-[#d0d0d0] bg-[#f5f5f5] px-2 text-left text-[14px] font-extrabold leading-tight text-[#3f7fe8]">
                    {day.toLocaleDateString([], { weekday: 'long' })}<br />
                    <span className="text-[11px] font-bold">{day.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </th>
                ))}
                <th className="border border-[#d0d0d0] bg-[#f5f5f5] text-center text-[12px] font-extrabold text-[#217346]">HOURS</th>
              </tr>
            </thead>
            <tbody>
              {staffWithHours.map(({ person, minutes }, index) => (
                <tr key={person.id} className={index % 2 === 1 ? 'bg-[#fbfbfb]' : 'bg-white'}>
                  <td className="sticky left-0 z-10 border border-[#d0d0d0] bg-[#f0f0f0] text-center text-[11px] font-bold text-stone-500">{index + 2}</td>
                  <td className="sticky left-[34px] z-10 border border-[#d0d0d0] border-r-2 border-r-[#c5c5c5] bg-inherit px-2">
                    <div className="truncate font-bold text-[#1a0a00]">{person.name}</div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-400">{person.role}</div>
                  </td>
                  {weekDays.map((day) => renderScheduleCell(person, day))}
                  <td className="border border-[#d0d0d0] bg-[#f0f7ee] text-center font-extrabold text-[#217346]">{formatHours(minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex h-[30px] shrink-0 items-end gap-0.5 overflow-x-auto border-t border-[#d0d0d0] bg-[#e0e0e0] px-1">
        {[-14, -7, 0, 7, 14].map((offset) => {
          const start = addDays(weekStart, offset);
          return (
            <button
              key={offset}
              type="button"
              onClick={() => setWeekStart(start)}
              className={cn('h-6 min-w-[118px] rounded-t border border-[#bbb] border-b-0 bg-[#d0d0d0] px-3 text-[11px] text-stone-600', offset === 0 && 'border-t-[3px] border-t-[#217346] bg-white font-extrabold text-[#217346]')}
            >
              {formatWeekRange(start)}
            </button>
          );
        })}
      </div>
      <div className="flex h-6 shrink-0 items-center justify-between gap-4 overflow-hidden bg-[#217346] px-3 font-['Calibri','Segoe_UI',Arial,sans-serif] text-[11px] font-semibold text-white/90">
        <span>Draft - {filteredStaff.length} staff - {isSavingSchedule ? 'autosaving...' : dirtyCount > 0 ? `${dirtyCount} pending cell${dirtyCount === 1 ? '' : 's'}` : 'saved'}</span>
        <span>{selectedCellCount > 0 ? `${selectedCellCount} selected` : 'Shift-click to select'}</span>
        <span>Assigned: {scheduleTotals.assigned}</span>
        <span>Off: {scheduleTotals.off}</span>
        <span>Scheduled: {formatHours(scheduleTotals.minutes)} hrs</span>
      </div>
    </div>
  );

  const scheduleToolbar = (
    <div className="flex shrink-0 flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Week</span>
        <div className="flex h-8 overflow-hidden rounded-lg border border-stone-300 bg-white">
          <button type="button" className="flex w-8 items-center justify-center border-r border-stone-200 text-stone-600" onClick={() => setWeekStart((current) => addDays(current, -7))}><ChevronLeft size={16} /></button>
          <div className="flex min-w-[170px] items-center justify-center px-3 text-[12px] font-semibold text-espresso">{formatWeekRange(weekStart)}</div>
          <button type="button" className="flex w-8 items-center justify-center border-l border-stone-200 text-stone-600" onClick={() => setWeekStart((current) => addDays(current, 7))}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Branch</span>
        <select
          className="h-8 min-w-[140px] rounded-lg border border-stone-300 bg-white px-2.5 text-[12px] text-espresso disabled:bg-stone-50"
          value={canManageAllBranches ? selectedOrganizationId : branchName}
          onChange={(event) => {
            setSelectedOrganizationId(event.target.value);
            setSelectedCell(null);
            setScheduleRole('');
            setScheduleSearch('');
          }}
          disabled={!canManageAllBranches}
        >
          {canManageAllBranches ? (
            branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)
          ) : (
            <option value={branchName}>{branchName}</option>
          )}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Role</span>
        <select className="h-8 min-w-[120px] rounded-lg border border-stone-300 bg-white px-2.5 text-[12px] text-espresso" value={scheduleRole} onChange={(event) => setScheduleRole(event.target.value as ShiftRole | '')}>
          <option value="">All roles</option>
          <option value="CHEF">Chef</option>
          <option value="WAITER">Waiter</option>
          <option value="BARISTA">Barista</option>
        </select>
      </div>
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input value={scheduleSearch} onChange={(event) => setScheduleSearch(event.target.value)} placeholder="Search staff..." className="h-8 rounded-lg border border-stone-300 bg-white pl-7 pr-3 text-[12px] text-espresso outline-none" />
      </div>
      <div className={cn('flex h-8 items-center gap-2 rounded-lg border px-3 text-[11.5px] font-semibold', dirtyCount > 0 || isSavingSchedule ? 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]' : 'border-[#86efac] bg-[#edfaf1] text-[#1a6b3c]')}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {isSavingSchedule ? 'Saving...' : dirtyCount > 0 ? `${dirtyCount} autosave pending` : 'All changes saved'}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Shift definitions</span>
        {shifts.slice(0, 5).map((shift) => (
          <span key={shift.id} className={cn('inline-flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-bold', getShiftColorClass(shift.id, shifts))}>{shift.name}<span className="font-semibold opacity-60">{shift.startTime}-{shift.endTime}</span></span>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" size="sm" leftIcon={<Copy size={14} />} onClick={() => setCopyWeekModal((current) => ({ ...current, isOpen: true }))} disabled={!hasBranchScope || shifts.length === 0 || staff.length === 0}>Copy Week</Button>
        <Button variant="secondary" size="sm" leftIcon={isExpanded ? <Minimize2 size={14} /> : <Expand size={14} />} onClick={() => setIsExpanded((current) => !current)}>{isExpanded ? 'Collapse' : 'Expand sheet'}</Button>
        <Button size="sm" onClick={() => void handleSaveSchedule()} isLoading={isSavingSchedule} disabled={!hasBranchScope || dirtyCount === 0}>Save now</Button>
      </div>
    </div>
  );

  return (
    <>
      {isExpanded ? (
        <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-[#faf7f4] p-4">
          {scheduleToolbar}
          {scheduleSheet}
        </div>
      ) : (
        <PageLayout className="animate-fade-up !mx-0 flex h-screen min-h-0 !max-w-none flex-col !px-6 !py-4">
          <div className="shrink-0">
            <h1 className="text-[22px] font-bold leading-tight tracking-[-0.3px] text-espresso">Shift Scheduling</h1>
            <p className="mt-1 text-[13px] text-stone-400">Build the weekly roster with named shifts. Times stay in shift definitions; the roster stays clean.</p>
          </div>
          <div className="mt-4 flex shrink-0 border-b border-stone-200">
            {([
              ['schedule', 'Weekly Schedule'],
              ['attendance', "Today's Attendance"],
              ['definitions', 'Shift Definitions'],
            ] as [TabId, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn('border-b-2 px-7 pb-2.5 text-[13px] font-semibold transition-colors', activeTab === id ? 'border-[#6b4226] text-espresso' : 'border-transparent text-stone-500 hover:text-stone-700')}
              >
                {label}
              </button>
            ))}
          </div>
          {activeTab === 'schedule' && (
            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
              {scheduleToolbar}
              {scheduleSheet}
            </div>
          )}
          {activeTab === 'attendance' && (
            <section className="mt-4 min-h-0 overflow-auto rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-heading-md font-semibold text-stone-900">Today&apos;s Attendance</h2>
              {isLoading ? <SkeletonTable rows={5} columns={6} /> : todayAssignments.length === 0 ? <EmptyState icon={<Calendar size={24} />} heading="No one scheduled today" body="There are no assignments for today." /> : <Table columns={attendanceColumns} data={attendanceRows} keyField="id" />}
            </section>
          )}
          {activeTab === 'definitions' && (
            <section className="mt-4 min-h-0 overflow-auto rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-heading-md font-semibold text-stone-900">Shift Definitions</h2>
                <Button onClick={openCreateShiftModal} disabled={!hasBranchScope}>Add Shift</Button>
              </div>
              {isLoading ? <SkeletonTable rows={4} columns={4} /> : shifts.length === 0 ? <EmptyState icon={<Calendar size={24} />} heading="No shifts yet" body="Create your first shift definition to start scheduling." action={<Button onClick={openCreateShiftModal} disabled={!hasBranchScope}>Add Shift</Button>} /> : <Table columns={shiftColumns} data={shiftRows} keyField="id" />}
            </section>
          )}
        </PageLayout>
      )}

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
        <form id="shift-form" className="space-y-4" onSubmit={(event) => void handleSaveShift(event)}>
          <Input label="Shift Name" value={shiftForm.name} onChange={(event) => setShiftForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Morning" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Time" type="time" value={shiftForm.startTime} onChange={(event) => setShiftForm((current) => ({ ...current, startTime: event.target.value }))} />
            <Input label="End Time" type="time" value={shiftForm.endTime} onChange={(event) => setShiftForm((current) => ({ ...current, endTime: event.target.value }))} />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={copyWeekModal.isOpen}
        onClose={() => { if (!isCopyingWeek) setCopyWeekModal((current) => ({ ...current, isOpen: false })); }}
        title="Copy Week Schedule"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCopyWeekModal((current) => ({ ...current, isOpen: false }))} disabled={isCopyingWeek}>Cancel</Button>
            <Button onClick={() => void handleCopyWeek()} isLoading={isCopyingWeek} disabled={copyWeekModal.sourceWeekStart === copyWeekModal.targetWeekStart}>Copy Schedule</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Source week start" type="date" value={copyWeekModal.sourceWeekStart} onChange={(event) => setCopyWeekModal((current) => ({ ...current, sourceWeekStart: event.target.value }))} />
          <Input label="Target week start" type="date" value={copyWeekModal.targetWeekStart} onChange={(event) => setCopyWeekModal((current) => ({ ...current, targetWeekStart: event.target.value }))} />
        </div>
      </Modal>

      <Modal
        isOpen={overrideModal.isOpen}
        onClose={() => { if (!isSavingOverride) setOverrideModal({ isOpen: false, assignment: null, action: 'CLOCK_IN', reasonCode: '', notes: '' }); }}
        title={`${getOverrideActionLabel(overrideModal.action)} Override`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOverrideModal({ isOpen: false, assignment: null, action: 'CLOCK_IN', reasonCode: '', notes: '' })} disabled={isSavingOverride}>Cancel</Button>
            <Button form="override-form" type="submit" isLoading={isSavingOverride}>Apply Override</Button>
          </div>
        }
      >
        <form id="override-form" className="space-y-4" onSubmit={(event) => void handleApplyOverride(event)}>
          <Select label="Reason" value={overrideModal.reasonCode} onChange={(event) => setOverrideModal((current) => ({ ...current, reasonCode: event.target.value }))} options={overrideReasonOptions.map((option) => ({ value: option.value, label: option.label }))} />
          <Input label="Notes" value={overrideModal.notes} onChange={(event) => setOverrideModal((current) => ({ ...current, notes: event.target.value }))} placeholder="Add context for the override" />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(shiftPendingDelete)}
        onClose={() => { if (!isSubmitting) setShiftPendingDelete(null); }}
        onConfirm={() => void handleDeleteShift()}
        title="Delete shift?"
        description={shiftPendingDelete ? `Delete "${shiftPendingDelete.name}"? This will be blocked if the shift has future assignments.` : 'Delete this shift?'}
        confirmLabel="Delete"
        isLoading={isSubmitting}
      />
    </>
  );
}
