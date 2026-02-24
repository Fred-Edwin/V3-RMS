'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, MapPinOff } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { shiftService } from '@/services/shiftService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { ShiftAssignment, ShiftAssignmentClockRecord } from '@/types/shift';

interface ClockWidgetProps {
  assignment: ShiftAssignment | null;
  onUpdated?: (record: ShiftAssignmentClockRecord) => void;
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

const getCurrentCoordinates = (): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        reject(new Error('Location unavailable'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
      },
    );
  });
};

const parseDistanceMetres = (message: string): number | null => {
  const match = message.match(/(\d+)\s*metres?/i);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export function ClockWidget({ assignment, onUpdated }: ClockWidgetProps): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localRecord, setLocalRecord] = useState<ShiftAssignmentClockRecord | null>(
    assignment?.clockRecord ?? null,
  );

  useEffect(() => {
    setLocalRecord(assignment?.clockRecord ?? null);
  }, [assignment]);

  const status = useMemo(() => {
    if (!localRecord?.clockInAt) {
      return 'NOT_CLOCKED_IN' as const;
    }

    if (localRecord.clockInAt && !localRecord.clockOutAt) {
      return 'CLOCKED_IN' as const;
    }

    return 'CLOCKED_OUT' as const;
  }, [localRecord]);

  const handleClockAction = useCallback(async () => {
    if (!assignment || !accessToken) {
      return;
    }

    setIsSubmitting(true);
    try {
      const coordinates = await getCurrentCoordinates();
      const payload = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        shiftAssignmentId: assignment.id,
      };

      const nextRecord =
        status === 'CLOCKED_IN'
          ? await shiftService.clockOut(payload, accessToken)
          : await shiftService.clockIn(payload, accessToken);

      setLocalRecord(nextRecord);
      onUpdated?.(nextRecord);

      toast({
        variant: 'success',
        title: status === 'CLOCKED_IN' ? 'Clocked out successfully' : 'Clocked in successfully',
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 403) {
        const distance = parseDistanceMetres(error.message);
        if (distance !== null) {
          toast({
            variant: 'warning',
            title: `You're ${distance}m from the branch. Move closer to ${
              status === 'CLOCKED_IN' ? 'clock out' : 'clock in'
            }.`,
          });
        } else {
          toast({
            variant: 'warning',
            title: error.message,
          });
        }
      } else {
        toast({
          variant: 'warning',
          title: 'Location unavailable - ask your manager to clock you in',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [accessToken, assignment, onUpdated, status, toast]);

  if (!assignment) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <EmptyState
          icon={<Clock size={24} />}
          heading="No shift today"
          body="No shift assignment found for today."
        />
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-heading-sm font-semibold text-stone-900">{assignment.shift.name}</h3>
          <p className="text-body-sm text-stone-500">
            {assignment.shift.startTime} - {assignment.shift.endTime}
          </p>
        </div>
        {localRecord?.clockInMethod === 'OVERRIDE' || localRecord?.clockOutMethod === 'OVERRIDE' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#F5B87A] bg-[#FEF0E0] px-2 py-0.5 text-label-sm text-[#A04F0A]">
            <MapPinOff size={14} />
            Override
          </span>
        ) : null}
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-label-sm uppercase tracking-wide text-stone-500">Clock In</dt>
          <dd className="text-body-md text-stone-900">{formatTime(localRecord?.clockInAt ?? null)}</dd>
        </div>
        <div>
          <dt className="text-label-sm uppercase tracking-wide text-stone-500">Clock Out</dt>
          <dd className="text-body-md text-stone-900">{formatTime(localRecord?.clockOutAt ?? null)}</dd>
        </div>
      </dl>

      {status !== 'CLOCKED_OUT' ? (
        <div className="mt-4">
          <Button onClick={() => void handleClockAction()} isLoading={isSubmitting} className="w-full sm:w-auto">
            {status === 'CLOCKED_IN' ? 'Clock Out' : 'Clock In'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
