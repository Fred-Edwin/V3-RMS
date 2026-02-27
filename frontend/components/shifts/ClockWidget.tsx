'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui';
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
  const kmMatch = message.match(/([\d,.]+)\s*km\b/i);
  if (kmMatch?.[1]) {
    const parsedKm = Number.parseFloat(kmMatch[1].replace(/,/g, ''));
    if (!Number.isNaN(parsedKm)) {
      return Math.round(parsedKm * 1000);
    }
  }

  const metresMatch = message.match(/([\d,.]+)\s*(?:metres?|meters?)\b/i);
  if (!metresMatch?.[1]) {
    return null;
  }

  const parsed = Number.parseFloat(metresMatch[1].replace(/,/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
};

const formatDistance = (distanceMetres: number): string => {
  if (distanceMetres >= 1000) {
    return `${(distanceMetres / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceMetres)} m`;
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
          const actionLabel = status === 'CLOCKED_IN' ? 'clock out' : 'clock in';
          toast({
            variant: 'warning',
            title: 'Move closer to the branch',
            message: `You are approximately ${formatDistance(distance)} away. Move within 50 m to ${actionLabel}.`,
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
          message: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [accessToken, assignment, onUpdated, status, toast]);

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-white py-10 text-center shadow-sm">
        <Clock size={28} className="text-stone-300 mb-3" />
        <p className="text-body-md font-medium text-stone-600">You&apos;re off today</p>
        <p className="text-body-sm text-stone-400 mt-1">Enjoy your rest — no shift scheduled.</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-sm uppercase tracking-wider text-stone-400 mb-0.5">Today&apos;s shift</p>
          <h3 className="text-heading-sm font-semibold text-stone-900">{assignment.shift.name}</h3>
          <p className="text-body-sm text-stone-500">
            {assignment.shift.startTime} – {assignment.shift.endTime}
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
