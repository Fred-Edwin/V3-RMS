'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MapPinOff } from 'lucide-react';
import { Button, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { ShiftAssignment, ShiftAssignmentClockRecord } from '@/types/shift';

interface ClockWidgetProps {
  assignments: ShiftAssignment[];
  onUpdated?: (assignmentId: string, record: ShiftAssignmentClockRecord) => void;
}

type ClockWidgetStatus = 'NOT_CLOCKED_IN' | 'CLOCKED_IN' | 'CLOCKED_OUT';
type GeolocationFailureCode = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED' | 'UNKNOWN';

interface ClockErrorDetails {
  action?: string;
  assignmentId?: string;
  userId?: string;
  openShiftAssignmentId?: string;
  distanceMetres?: number;
  allowedRadiusMetres?: number;
}

class GeolocationFailure extends Error {
  constructor(public readonly code: GeolocationFailureCode, message: string) {
    super(message);
  }
}

const formatTime = (value: string | null): string => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatus = (record: ShiftAssignmentClockRecord | null): ClockWidgetStatus => {
  if (!record?.clockInAt) {
    return 'NOT_CLOCKED_IN';
  }

  if (!record.clockOutAt) {
    return 'CLOCKED_IN';
  }

  return 'CLOCKED_OUT';
};

const getCurrentCoordinates = (): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationFailure('UNSUPPORTED', 'This device does not support location sharing.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new GeolocationFailure(
                'PERMISSION_DENIED',
                'Location access is blocked. Enable it in your browser settings or ask your manager for an override.',
              ),
            );
            return;
          case error.POSITION_UNAVAILABLE:
            reject(
              new GeolocationFailure(
                'POSITION_UNAVAILABLE',
                'Your device could not determine your location. Move near a window or ask your manager for an override.',
              ),
            );
            return;
          case error.TIMEOUT:
            reject(
              new GeolocationFailure(
                'TIMEOUT',
                'We could not get your location in time. Try again where GPS signal is stronger.',
              ),
            );
            return;
          default:
            reject(new GeolocationFailure('UNKNOWN', 'We could not read your location from this device.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
      },
    );
  });
};

const parseClockErrorDetails = (details: unknown): ClockErrorDetails | null => {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const candidate = details as Record<string, unknown>;
  return {
    action: typeof candidate.action === 'string' ? candidate.action : undefined,
    assignmentId: typeof candidate.assignmentId === 'string' ? candidate.assignmentId : undefined,
    userId: typeof candidate.userId === 'string' ? candidate.userId : undefined,
    openShiftAssignmentId:
      typeof candidate.openShiftAssignmentId === 'string' ? candidate.openShiftAssignmentId : undefined,
    distanceMetres: typeof candidate.distanceMetres === 'number' ? candidate.distanceMetres : undefined,
    allowedRadiusMetres:
      typeof candidate.allowedRadiusMetres === 'number' ? candidate.allowedRadiusMetres : undefined,
  };
};

// Returns minutes remaining until shift end; negative means already past end time.
const minutesUntilShiftEnd = (endTime: string): number => {
  const now = new Date();
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const end = new Date(now);
  end.setHours(endHour, endMinute, 0, 0);
  return (end.getTime() - now.getTime()) / 60_000;
};

const EARLY_CLOCK_OUT_THRESHOLD_MINUTES = 15;

const formatDistance = (distanceMetres: number): string => {
  if (distanceMetres >= 1000) {
    return `${(distanceMetres / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceMetres)} m`;
};

export function ClockWidget({ assignments, onUpdated }: ClockWidgetProps): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isSubmittingAssignmentId, setIsSubmittingAssignmentId] = useState<string | null>(null);
  const [isUndoingAssignmentId, setIsUndoingAssignmentId] = useState<string | null>(null);
  const [localAssignments, setLocalAssignments] = useState<ShiftAssignment[]>(assignments);
  const [pendingClockOutAssignment, setPendingClockOutAssignment] = useState<ShiftAssignment | null>(null);
  // Maps assignmentId -> seconds remaining in undo window
  const [undoCountdowns, setUndoCountdowns] = useState<Record<string, number>>({});
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLocalAssignments(assignments);
  }, [assignments]);

  const sortedAssignments = useMemo(() => {
    return [...localAssignments].sort((left, right) => left.shift.startTime.localeCompare(right.shift.startTime));
  }, [localAssignments]);

  const executeClockAction = useCallback(
    async (assignment: ShiftAssignment): Promise<void> => {
      if (!accessToken) {
        return;
      }

      const status = getStatus(assignment.clockRecord);
      if (status === 'CLOCKED_OUT') {
        return;
      }

      setIsSubmittingAssignmentId(assignment.id);
      try {
        const coordinates = await getCurrentCoordinates();
        const payload = {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          shiftAssignmentId: assignment.id,
        };

        const response =
          status === 'CLOCKED_IN'
            ? await shiftService.clockOut(payload, accessToken)
            : await shiftService.clockIn(payload, accessToken);

        const nextRecord = response.data;
        if (!nextRecord) {
          throw new Error('Clock response did not include attendance data.');
        }

        setLocalAssignments((current) =>
          current.map((item) => (item.id === assignment.id ? { ...item, clockRecord: nextRecord } : item)),
        );
        onUpdated?.(assignment.id, nextRecord);

        toast({
          variant: 'success',
          title: response.message ?? (status === 'CLOCKED_IN' ? 'Clocked out successfully' : 'Clocked in successfully'),
          message: `${assignment.shift.name} (${assignment.shift.startTime} - ${assignment.shift.endTime})`,
        });

        // Start 60-second undo window after a clock-out
        if (status === 'CLOCKED_IN') {
          const UNDO_SECONDS = 60;
          setUndoCountdowns((cur) => ({ ...cur, [assignment.id]: UNDO_SECONDS }));
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          undoTimerRef.current = setInterval(() => {
            setUndoCountdowns((cur) => {
              const entries = Object.entries(cur);
              const next: Record<string, number> = {};
              for (const [id, secs] of entries) {
                if (secs > 1) next[id] = secs - 1;
                // Drop entry when it reaches 0 — undo window expired
              }
              if (Object.keys(next).length === 0 && undoTimerRef.current) {
                clearInterval(undoTimerRef.current);
                undoTimerRef.current = null;
              }
              return next;
            });
          }, 1000);
        }
      } catch (error) {
        if (error instanceof GeolocationFailure) {
          if (error.code === 'PERMISSION_DENIED') {
            toast({
              variant: 'warning',
              title: 'Allow location to clock in',
              message: error.message,
            });
          } else if (error.code === 'TIMEOUT') {
            toast({
              variant: 'warning',
              title: 'Location request timed out',
              message: error.message,
            });
          } else if (error.code === 'POSITION_UNAVAILABLE') {
            toast({
              variant: 'warning',
              title: 'Location not available',
              message: error.message,
            });
          } else {
            toast({
              variant: 'warning',
              title: 'Location unavailable on this device',
              message: error.message,
            });
          }
        } else if (error instanceof ApiError) {
          const details = parseClockErrorDetails(error.details);

          if (error.code === 'CLOCK_OUTSIDE_GEOFENCE' && details?.distanceMetres !== undefined) {
            const radius = details.allowedRadiusMetres ?? 50;
            const actionLabel = status === 'CLOCKED_IN' ? 'clock out' : 'clock in';
            toast({
              variant: 'warning',
              title: 'Move closer to the branch',
              message: `You are approximately ${formatDistance(details.distanceMetres)} away. Move within ${radius} m to ${actionLabel}.`,
            });
          } else if (error.code === 'CLOCK_ALREADY_IN') {
            toast({
              variant: 'warning',
              title: 'You are already clocked in',
              message: details?.openShiftAssignmentId
                ? 'Finish or resolve the other open shift before starting this one.'
                : error.message,
            });
          } else if (error.code === 'CLOCK_NOT_IN') {
            toast({
              variant: 'warning',
              title: "You haven't clocked in yet",
              message: error.message,
            });
          } else if (error.code === 'CLOCK_ALREADY_OUT') {
            toast({
              variant: 'info',
              title: 'This shift is already clocked out',
              message: 'Refresh your shifts if the times on screen look out of date.',
            });
          } else if (error.code === 'CLOCK_ASSIGNMENT_INVALID') {
            toast({
              variant: 'warning',
              title: 'This shift is not available right now',
              message: error.message,
            });
          } else if (error.code === 'CLOCK_STALE_STATE') {
            toast({
              variant: 'warning',
              title: 'Attendance changed just now',
              message: error.message,
            });
          } else if (error.code === 'CLOCK_HAS_OPEN_ORDERS') {
            toast({
              variant: 'warning',
              title: 'Close your open orders first',
              message: error.message,
            });
          } else {
            toast({
              variant: 'warning',
              title: 'Clock action failed',
              message: error.message,
            });
          }
        } else {
          toast({
            variant: 'warning',
            title: 'Clock action failed',
            message: error instanceof Error ? error.message : 'Please try again.',
          });
        }
      } finally {
        setIsSubmittingAssignmentId(null);
      }
    },
    [accessToken, onUpdated, toast],
  );

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, []);

  const handleUndoClockOut = useCallback(
    async (assignment: ShiftAssignment): Promise<void> => {
      if (!accessToken) return;
      setIsUndoingAssignmentId(assignment.id);
      try {
        const response = await shiftService.undoClockOut({ shiftAssignmentId: assignment.id }, accessToken);
        const nextRecord = response.data;
        if (!nextRecord) throw new Error('Undo response did not include attendance data.');

        setLocalAssignments((current) =>
          current.map((item) => (item.id === assignment.id ? { ...item, clockRecord: nextRecord } : item)),
        );
        onUpdated?.(assignment.id, nextRecord);
        setUndoCountdowns((cur) => {
          const next = { ...cur };
          delete next[assignment.id];
          return next;
        });
        toast({ variant: 'success', title: 'Clock-out undone', message: 'You are clocked back in.' });
      } catch (error) {
        if (error instanceof ApiError && error.code === 'CLOCK_UNDO_EXPIRED') {
          setUndoCountdowns((cur) => {
            const next = { ...cur };
            delete next[assignment.id];
            return next;
          });
          toast({ variant: 'warning', title: 'Undo window expired', message: 'Ask your manager to void the clock-out.' });
        } else {
          toast({
            variant: 'warning',
            title: 'Undo failed',
            message: error instanceof Error ? error.message : 'Please try again.',
          });
        }
      } finally {
        setIsUndoingAssignmentId(null);
      }
    },
    [accessToken, onUpdated, toast],
  );

  const handleClockAction = useCallback(
    (assignment: ShiftAssignment): void => {
      const status = getStatus(assignment.clockRecord);
      if (status !== 'CLOCKED_IN') {
        void executeClockAction(assignment);
        return;
      }

      const minsLeft = minutesUntilShiftEnd(assignment.shift.endTime);
      if (minsLeft > EARLY_CLOCK_OUT_THRESHOLD_MINUTES) {
        // Shift is not near its end — ask for confirmation before proceeding.
        setPendingClockOutAssignment(assignment);
      } else {
        void executeClockAction(assignment);
      }
    },
    [executeClockAction],
  );

  if (sortedAssignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-white py-10 text-center shadow-sm">
        <Clock size={28} className="mb-3 text-stone-300" />
        <p className="text-body-md font-medium text-stone-600">You&apos;re off today</p>
        <p className="mt-1 text-body-sm text-stone-400">Enjoy your rest. No shift is scheduled for today.</p>
      </div>
    );
  }

  const earlyMinsLeft = pendingClockOutAssignment
    ? Math.round(minutesUntilShiftEnd(pendingClockOutAssignment.shift.endTime))
    : 0;

  return (
    <>
    <ConfirmDialog
      isOpen={pendingClockOutAssignment !== null}
      onClose={() => setPendingClockOutAssignment(null)}
      onConfirm={() => {
        if (pendingClockOutAssignment) {
          setPendingClockOutAssignment(null);
          void executeClockAction(pendingClockOutAssignment);
        }
      }}
      isLoading={
        pendingClockOutAssignment !== null &&
        isSubmittingAssignmentId === pendingClockOutAssignment.id
      }
      title="Clock out early?"
      description={
        pendingClockOutAssignment
          ? `Your shift (${pendingClockOutAssignment.shift.name}) ends at ${pendingClockOutAssignment.shift.endTime} — ${earlyMinsLeft} minute${earlyMinsLeft !== 1 ? 's' : ''} from now. Are you sure you want to clock out early?`
          : ''
      }
      confirmLabel="Yes, clock out"
      cancelLabel="Stay clocked in"
    />
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <header className="mb-4">
        <p className="mb-0.5 text-label-sm uppercase tracking-wider text-stone-400">Today&apos;s shift{sortedAssignments.length > 1 ? 's' : ''}</p>
        <h3 className="text-heading-sm font-semibold text-stone-900">
          {sortedAssignments.length > 1 ? 'Choose the shift you need to update' : sortedAssignments[0].shift.name}
        </h3>
        <p className="text-body-sm text-stone-500">
          {sortedAssignments.length > 1
            ? 'Each shift must be clocked separately. Finish one before starting another.'
            : `${sortedAssignments[0].shift.startTime} - ${sortedAssignments[0].shift.endTime}`}
        </p>
      </header>

      <div className="space-y-3">
        {sortedAssignments.map((assignment) => {
          const status = getStatus(assignment.clockRecord);
          const isOverride =
            assignment.clockRecord?.clockInMethod === 'OVERRIDE' ||
            assignment.clockRecord?.clockOutMethod === 'OVERRIDE';

          return (
            <article key={assignment.id} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-body-md font-semibold text-stone-900">{assignment.shift.name}</h4>
                  <p className="text-body-sm text-stone-500">
                    {assignment.shift.startTime} - {assignment.shift.endTime}
                  </p>
                </div>
                {isOverride ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#F5B87A] bg-[#FEF0E0] px-2 py-0.5 text-label-sm text-[#A04F0A]">
                    <MapPinOff size={14} />
                    Override
                  </span>
                ) : null}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-label-sm uppercase tracking-wide text-stone-500">Clock In</dt>
                  <dd className="text-body-md text-stone-900">{formatTime(assignment.clockRecord?.clockInAt ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-label-sm uppercase tracking-wide text-stone-500">Clock Out</dt>
                  <dd className="text-body-md text-stone-900">{formatTime(assignment.clockRecord?.clockOutAt ?? null)}</dd>
                </div>
              </dl>

              {status !== 'CLOCKED_OUT' ? (
                <div className="mt-4">
                  <Button
                    onClick={() => void handleClockAction(assignment)}
                    isLoading={isSubmittingAssignmentId === assignment.id}
                    className="w-full sm:w-auto"
                  >
                    {status === 'CLOCKED_IN' ? 'Clock Out' : 'Clock In'}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3">
                  <p className="text-body-sm text-stone-500">This shift attendance is complete.</p>
                  {undoCountdowns[assignment.id] !== undefined && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleUndoClockOut(assignment)}
                      isLoading={isUndoingAssignmentId === assignment.id}
                    >
                      Undo ({undoCountdowns[assignment.id]}s)
                    </Button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
    </>
  );
}
