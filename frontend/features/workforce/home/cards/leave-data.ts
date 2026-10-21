'use client';

import { useEffect, useState } from 'react';

import { addDays, daySmall, leaveReads, nairobiToday, rangeShort } from '@/features/workforce/leave';

import type { ComingUpEvent } from '../../_shared';

const AHEAD_DAYS = 14;

/**
 * Approved leave starting in the next 14 days, for "Coming up" (Leave segment 4; `GET /away`). Name plus role in every line. A reader the
 * server refuses (no leave.read) or any failure gives no events, so the card simply carries its other lines.
 */
export function useLeaveComingUp(): readonly ComingUpEvent[] {
  const [events, setEvents] = useState<readonly ComingUpEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    const today = nairobiToday();
    leaveReads.away(today, addDays(today, AHEAD_DAYS)).then(
      (answer) => {
        if (cancelled) return;
        setEvents(
          answer.people
            .filter((p) => p.start >= today)
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((p) => ({ key: `leave-${p.applicationId}`, date: daySmall(p.start).toUpperCase(), text: `${p.name}, ${p.roleLabel}, on leave ${rangeShort(p.start, p.end)}` }))
        );
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return events;
}
