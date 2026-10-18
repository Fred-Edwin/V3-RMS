'use client';

import { useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';

import { attendanceReads } from '../../_shared/services/attendance-services';

/**
 * Whether the new clock is on for the signed-in person's branch (or, for a company-wide role, for any branch they can see). The menu
 * uses it to show the floor-staff Home link and the Schedule and Today board rows only where a branch is switched on, so a branch that is
 * off sees nothing new. Until the answer arrives, and if it never does, the answer is "off".
 *
 * Floor staff and department heads ask for their own day (C1, which says `enabled`); roles that read the board ask for the list of
 * branches (S3). Every other role asks nothing.
 */

const OWN_CLOCK_ROLES = ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT', 'ACCOUNTANT'];
const BOARD_ROLES = ['HR_MANAGER', 'MANAGER', 'STORE_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'];
const FRESH_MS = 2 * 60 * 1000;

export type AttendanceAsk = 'own' | 'branches' | 'none';

export function attendanceAskOf(role: string | null | undefined, isDepartmentHead: boolean): AttendanceAsk {
  if (!role) return 'none';
  if (BOARD_ROLES.includes(role)) return 'branches';
  return OWN_CLOCK_ROLES.includes(role) || isDepartmentHead ? 'own' : 'none';
}

interface Cached {
  userId: string;
  on: boolean;
  at: number;
}
let cached: Cached | null = null;

async function ask(kind: AttendanceAsk): Promise<boolean> {
  if (kind === 'own') return (await attendanceReads.me()).enabled;
  return (await attendanceReads.switches()).some((s) => s.enabled);
}

export function useAttendanceOn(role: string | null | undefined, isDepartmentHead: boolean): boolean {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const kind = attendanceAskOf(role, isDepartmentHead);
  const [on, setOn] = useState<boolean>(cached && cached.userId === userId ? cached.on : false);

  useEffect(() => {
    if (kind === 'none' || !userId) {
      setOn(false);
      return;
    }
    let cancelled = false;
    const load = (): void => {
      if (cached && cached.userId === userId && Date.now() - cached.at < FRESH_MS) {
        setOn(cached.on);
        return;
      }
      ask(kind).then(
        (value) => {
          cached = { userId, on: value, at: Date.now() };
          if (!cancelled) setOn(value);
        },
        () => {
          // A failed ask leaves the menu as it was: off if it never knew, unchanged if it did.
        }
      );
    };
    load();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [kind, userId]);

  return on;
}

/** The switch screen calls this after a change so the menu does not wait for its two minutes. */
export function forgetAttendanceOn(): void {
  cached = null;
}
