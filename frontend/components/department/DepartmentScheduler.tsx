'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import { EmptyState, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { departmentLabel, staffInDepartment } from '@/lib/departments';
import { shiftService } from '@/services/shiftService';
import { staffService, type StaffDto } from '@/services/staffService';
import type { Shift, ShiftAssignment } from '@/types/shift';
import type { AppRole, DepartmentTag } from '@/types/auth';
import { ApiError } from '@/types/api';
import {
  buildWeekStrip,
  formatShiftWindow,
  longDayLabel,
  weekdayLong,
  type StripDay,
} from './dateStrip';
import { AddSomeoneSheet, type SchedulerPerson } from './AddSomeoneSheet';

const roleLabel: Partial<Record<AppRole, string>> = {
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
  STEWARD: 'Steward',
  HOUSEKEEPING: 'Housekeeping',
};

/** Copy for the "…only · N" lines, per department group. */
const eligibleNounFor = (tag: DepartmentTag): string => {
  if (tag === 'KITCHEN' || tag === 'PASTRY') return 'Kitchen & Pastry chefs';
  if (tag === 'SERVICE') return 'Service waiters';
  if (tag === 'BARISTA') return 'Baristas';
  return 'Stewards & housekeeping';
};

const scopeNoun = (tag: DepartmentTag): string => {
  if (tag === 'KITCHEN' || tag === 'PASTRY') return 'chefs';
  if (tag === 'SERVICE') return 'waiters';
  if (tag === 'BARISTA') return 'baristas';
  return 'your housekeeping team';
};

interface PendingAdd {
  key: string; // `${shiftId}|${userId}`
  shiftId: string;
  userId: string;
}

export function DepartmentScheduler(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const branchName = useAuthStore((s) => s.user?.organizationName) ?? 'Your branch';
  const departmentTag = useAuthStore((s) => s.departmentTag);

  const week = useMemo<StripDay[]>(() => buildWeekStrip(), []);
  const [selectedYmd, setSelectedYmd] = useState<string>(() => {
    const today = week.find((d) => d.isToday);
    return today?.ymd ?? week[0].ymd;
  });

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [dayAssignments, setDayAssignments] = useState<ShiftAssignment[]>([]);
  const [everScheduled, setEverScheduled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Local, unsaved edits for the selected day. Removes track the assignment id
  // to delete; adds track (shiftId, userId) to create on Save.
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());
  const [sheetShiftId, setSheetShiftId] = useState<string | null>(null);

  const deptStaff = useMemo(
    () => (departmentTag ? staff.filter((p) => staffInDepartment(p, departmentTag)) : []),
    [staff, departmentTag],
  );

  const people = useMemo<SchedulerPerson[]>(
    () =>
      deptStaff.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        roleLine: roleLabel[p.role] ?? p.role,
      })),
    [deptStaff],
  );

  const loadCore = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    try {
      const [shiftList, staffList] = await Promise.all([
        shiftService.listShifts(accessToken),
        staffService.listStaff(accessToken, { isActive: true }),
      ]);
      setShifts(shiftList);
      setStaff(staffList);
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Load failed',
        message: err instanceof ApiError ? err.message : 'Could not load your department.',
      });
    }
  }, [accessToken, toast]);

  const loadDay = useCallback(
    async (ymd: string): Promise<void> => {
      if (!accessToken) return;
      try {
        const rows = await shiftService.listAssignments(
          { startDate: ymd, endDate: ymd },
          accessToken,
        );
        setDayAssignments(rows);
        // Discard any unsaved edits when the day changes.
        setPendingAdds([]);
        setPendingRemoves(new Set());
      } catch (err) {
        toast({
          variant: 'error',
          title: 'Load failed',
          message: err instanceof ApiError ? err.message : 'Could not load that day.',
        });
      }
    },
    [accessToken, toast],
  );

  // First-time check: has this department ever had an assignment? Look back a
  // wide window once, on mount.
  const checkedEver = useRef(false);
  useEffect(() => {
    if (!accessToken || checkedEver.current) return;
    checkedEver.current = true;
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 60);
    const end = new Date(today);
    end.setDate(end.getDate() + 60);
    shiftService
      .listAssignments(
        {
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
        },
        accessToken,
      )
      .then((rows) => setEverScheduled(rows.length > 0))
      .catch(() => setEverScheduled(true)); // fail open — don't trap them in the empty state
  }, [accessToken]);

  useEffect(() => {
    setIsLoading(true);
    void Promise.all([loadCore(), loadDay(selectedYmd)]).finally(() => setIsLoading(false));
    // Intentionally only on mount + token; day changes go through the strip handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const selectDay = (ymd: string): void => {
    if (ymd === selectedYmd) return;
    if (pendingAdds.length > 0 || pendingRemoves.size > 0) {
      const ok = window.confirm('Discard unsaved changes on this day?');
      if (!ok) return;
    }
    setSelectedYmd(ymd);
    void loadDay(ymd);
  };

  // Effective roster per shift for the selected day = saved rows minus pending
  // removes plus pending adds.
  const rosterByShift = useMemo(() => {
    const map = new Map<string, { assignmentId: string | null; userId: string }[]>();
    for (const shift of shifts) map.set(shift.id, []);
    for (const a of dayAssignments) {
      if (pendingRemoves.has(a.id)) continue;
      const list = map.get(a.shiftId);
      if (list) list.push({ assignmentId: a.id, userId: a.userId });
    }
    for (const add of pendingAdds) {
      const list = map.get(add.shiftId);
      if (list && !list.some((r) => r.userId === add.userId)) {
        list.push({ assignmentId: null, userId: add.userId });
      }
    }
    return map;
  }, [shifts, dayAssignments, pendingAdds, pendingRemoves]);

  const nameOf = useCallback(
    (id: string): string => staff.find((p) => p.id === id)?.name ?? 'Unknown',
    [staff],
  );

  const dirty = pendingAdds.length > 0 || pendingRemoves.size > 0;

  const removeFromShift = (shiftId: string, entry: { assignmentId: string | null; userId: string }): void => {
    if (entry.assignmentId) {
      setPendingRemoves((prev) => new Set(prev).add(entry.assignmentId as string));
    } else {
      setPendingAdds((prev) => prev.filter((a) => !(a.shiftId === shiftId && a.userId === entry.userId)));
    }
  };

  const confirmSheet = (ids: string[]): void => {
    if (!sheetShiftId) return;
    setPendingAdds((prev) => {
      const next = [...prev];
      for (const id of ids) {
        const key = `${sheetShiftId}|${id}`;
        if (!next.some((a) => a.key === key)) next.push({ key, shiftId: sheetShiftId, userId: id });
      }
      return next;
    });
    setSheetShiftId(null);
  };

  const save = async (): Promise<void> => {
    if (!accessToken || !dirty) return;
    setIsSaving(true);
    try {
      await Promise.all([
        ...pendingAdds.map((a) =>
          shiftService.createAssignment(
            { userId: a.userId, shiftId: a.shiftId, date: selectedYmd },
            accessToken,
          ),
        ),
        ...Array.from(pendingRemoves).map((id) => shiftService.deleteAssignment(id, accessToken)),
      ]);
      toast({
        variant: 'success',
        title: 'Saved',
        message: `${weekdayLong(selectedYmd)}'s schedule is saved. HR can see it.`,
      });
      setEverScheduled(true);
      await loadDay(selectedYmd);
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Save failed',
        message: err instanceof ApiError ? err.message : 'Some changes did not save. Try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!departmentTag) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Calendar size={24} />}
          heading="No department linked to your account"
          body="Ask your Branch Manager to set you as a department head."
        />
      </div>
    );
  }

  const deptName = departmentLabel(departmentTag) === 'Kitchen' ? 'Kitchen & Pastry' : departmentLabel(departmentTag);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 px-7 pb-6 pt-4">
        <div className="flex items-start justify-between gap-5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[22px] font-bold leading-[26px] tracking-[-0.02em] text-stone-900">
              Schedule
            </h1>
            <p className="text-body-sm font-medium text-espresso">
              {deptName} · {branchName}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2.5 rounded-full border border-stone-200 bg-white px-2.5 py-3">
            <span className="size-3 shrink-0 rounded-full bg-espresso" />
            <span className="text-micro font-semibold leading-none text-stone-600">Your department</span>
          </span>
        </div>
        <p className="mt-2.5 text-caption leading-6 text-stone-500">
          You schedule {scopeNoun(departmentTag)} only. You can&rsquo;t change other departments or
          shift times.
        </p>
      </header>

      {/* Day strip */}
      <div className="flex gap-4 overflow-x-auto border-b border-stone-200 px-7 py-3.5">
        {week.map((day) => {
          const active = day.ymd === selectedYmd;
          return (
            <button
              key={day.ymd}
              type="button"
              onClick={() => selectDay(day.ymd)}
              className={cn(
                'flex w-11 shrink-0 flex-col items-center gap-0.5 rounded-lg border pb-4 pt-2.5 transition-colors',
                active
                  ? 'border-espresso bg-espresso'
                  : 'border-stone-200 bg-white hover:bg-stone-100',
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.06em]',
                  active ? 'text-[#D8C3B2]' : 'text-stone-500',
                )}
              >
                {day.weekday}
              </span>
              <span
                className={cn(
                  'text-[15px] font-bold leading-[18px]',
                  active ? 'text-white' : 'text-stone-900',
                )}
              >
                {day.dom}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex grow items-center justify-center py-20">
          <Spinner />
        </div>
      ) : everScheduled === false && !dirty ? (
        <FirstTimeState
          firstDayLabel={weekdayLong(selectedYmd)}
          onStart={() => {
            const firstShift = shifts[0];
            if (firstShift) setSheetShiftId(firstShift.id);
          }}
        />
      ) : (
        <>
          <div
            className="flex grow flex-col gap-3.5 px-7 pt-6"
            style={{ paddingBottom: 'calc(200px + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold leading-[18px] text-stone-900">
                {longDayLabel(selectedYmd)}
              </h2>
              <span className="text-caption font-medium text-stone-500">
                {countPeopleOnDay(rosterByShift)} people scheduled
              </span>
            </div>

            {shifts.length === 0 ? (
              <p className="rounded-lg border border-stone-200 bg-white p-4 text-body-sm text-stone-500">
                No shifts are defined for this branch yet. Ask HR to add Morning / Afternoon / Evening
                shifts.
              </p>
            ) : (
              shifts.map((shift) => {
                const roster = rosterByShift.get(shift.id) ?? [];
                return (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    roster={roster}
                    nameOf={nameOf}
                    meId={userId}
                    onRemove={(entry) => removeFromShift(shift.id, entry)}
                    onAdd={() => setSheetShiftId(shift.id)}
                  />
                );
              })
            )}
          </div>

          {/* Sticky save bar — sits directly above the app's fixed bottom nav
              (64px + safe-area). z above the nav so it is never obstructed. */}
          <div
            className="fixed inset-x-0 z-40 mx-auto max-w-[430px] border-t border-stone-200 bg-stone-50 px-7 pb-5 pt-5"
            style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
          >
            {dirty ? (
              <div className="mb-4 flex items-center gap-3">
                <span className="size-[5px] shrink-0 rounded-full bg-warning" />
                <span className="text-caption text-warning">
                  Unsaved changes on {weekdayLong(selectedYmd)}
                </span>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-3">
                <span className="size-[5px] shrink-0 rounded-full bg-success" />
                <span className="text-caption text-stone-500">
                  {weekdayLong(selectedYmd)}&rsquo;s schedule is saved
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={!dirty || isSaving}
              onClick={() => void save()}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-espresso text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {isSaving ? 'Saving…' : `Save ${weekdayLong(selectedYmd)}'s schedule`}
            </button>
          </div>
        </>
      )}

      {sheetShiftId && (
        <AddSomeoneSheet
          isOpen={sheetShiftId !== null}
          onClose={() => setSheetShiftId(null)}
          shiftName={shifts.find((s) => s.id === sheetShiftId)?.name ?? 'shift'}
          contextLine={(() => {
            const s = shifts.find((x) => x.id === sheetShiftId);
            return s
              ? `${longDayLabel(selectedYmd)} · ${formatShiftWindow(s.startTime, s.endTime)}`
              : longDayLabel(selectedYmd);
          })()}
          eligibleNoun={eligibleNounFor(departmentTag)}
          people={people}
          alreadyOnIds={
            new Set((rosterByShift.get(sheetShiftId) ?? []).map((r) => r.userId))
          }
          onConfirm={confirmSheet}
        />
      )}
    </div>
  );
}

function countPeopleOnDay(rosterByShift: Map<string, { userId: string }[]>): number {
  const seen = new Set<string>();
  rosterByShift.forEach((list) => list.forEach((r) => seen.add(r.userId)));
  return seen.size;
}

interface ShiftCardProps {
  shift: Shift;
  roster: { assignmentId: string | null; userId: string }[];
  nameOf: (id: string) => string;
  meId: string | null;
  onRemove: (entry: { assignmentId: string | null; userId: string }) => void;
  onAdd: () => void;
}

function ShiftCard({ shift, roster, nameOf, meId, onRemove, onAdd }: ShiftCardProps): JSX.Element {
  const count = roster.length;
  return (
    <div className="flex flex-col overflow-clip rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-3.5 py-5">
        <div className="flex flex-col gap-1">
          <span className="text-[14px] font-semibold leading-[18px] text-stone-900">{shift.name}</span>
          <span className="text-caption text-stone-500">
            {formatShiftWindow(shift.startTime, shift.endTime)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'size-3 shrink-0 rounded-full',
              count === 0 ? 'bg-warning' : 'bg-success',
            )}
          />
          <span
            className={cn(
              'text-caption font-medium',
              count === 0 ? 'text-warning' : 'text-success',
            )}
          >
            {count === 0 ? 'Nobody yet' : `${count} on`}
          </span>
        </div>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-start gap-2.5 p-3.5">
          <span className="text-body-sm text-stone-500">
            Nobody on the {shift.name.toLowerCase()} line yet.
          </span>
          <AddChip onClick={onAdd} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 px-3.5 pb-3.5 pt-5">
          {roster.map((entry) => {
            const isMe = entry.userId === meId;
            const name = nameOf(entry.userId);
            return (
              <span
                key={entry.userId}
                className={cn(
                  'flex items-center gap-4 rounded-full border py-3 pl-3 pr-4',
                  isMe ? 'border-[#E3D3C4] bg-parchment' : 'border-stone-200 bg-stone-50',
                )}
              >
                <span
                  className={cn(
                    'flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                    isMe ? 'bg-espresso text-white' : 'bg-parchment text-espresso',
                  )}
                >
                  {initials(name)}
                </span>
                <span
                  className={cn(
                    'text-body-sm font-medium',
                    isMe ? 'text-espresso' : 'text-stone-900',
                  )}
                >
                  {name}
                </span>
                {isMe && (
                  <span className="text-[10px] font-semibold tracking-[0.04em] text-espresso">
                    YOU
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(entry)}
                  aria-label={`Remove ${name} from ${shift.name}`}
                  className="flex size-6 shrink-0 items-center justify-center text-stone-400 hover:text-stone-700"
                >
                  <X size={10} strokeWidth={2} />
                </button>
              </span>
            );
          })}
          <AddChip onClick={onAdd} />
        </div>
      )}
    </div>
  );
}

function AddChip({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-full border border-dashed border-[#C9B8A8] bg-white py-[7px] pl-2.5 pr-5 text-body-sm font-semibold text-espresso hover:bg-parchment/40"
    >
      <Plus size={12} strokeWidth={2} />
      Add someone
    </button>
  );
}

function FirstTimeState({
  firstDayLabel,
  onStart,
}: {
  firstDayLabel: string;
  onStart: () => void;
}): JSX.Element {
  return (
    <div className="flex grow flex-col items-center gap-3.5 px-9 pt-20 text-center">
      <span className="flex size-[52px] items-center justify-center rounded-full bg-parchment">
        <Calendar size={24} className="text-espresso" />
      </span>
      <h2 className="text-[17px] font-bold leading-[22px] text-stone-900">
        No shifts scheduled yet
      </h2>
      <p className="text-body-sm leading-[19px] text-stone-500">
        Pick a day above, then add your team to Morning, Afternoon, or Evening. HR sees what you save
        here — you don&rsquo;t need to tell them.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-3 flex h-[46px] items-center justify-center rounded-lg bg-espresso px-[22px] text-[14px] font-semibold text-white"
      >
        Start with {firstDayLabel}
      </button>
    </div>
  );
}

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
