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

/**
 * The last answer is kept for the browser tab, so a full page load starts from it instead of "off" and the menu does not draw
 * without Shifts and Team today for a moment (a head's Department group changed between pages).
 */
const STORE_KEY = 'wendo.attendance-on';
function remembered(userId: string | null): Cached | null {
  if (cached) return cached;
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(STORE_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object' && 'userId' in parsed && 'on' in parsed && (parsed as Cached).userId === userId && typeof (parsed as Cached).on === 'boolean') return { userId: (parsed as Cached).userId, on: (parsed as Cached).on, at: 0 };
  } catch {
    // No storage: start from "off", as before.
  }
  return null;
}
function remember(value: Cached): void {
  cached = value;
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ userId: value.userId, on: value.on }));
  } catch {
    // Private window: the answer just is not kept across a reload.
  }
}

async function ask(kind: AttendanceAsk): Promise<boolean> {
  if (kind === 'own') return (await attendanceReads.me()).enabled;
  return (await attendanceReads.switches()).some((s) => s.enabled);
}

export function useAttendanceOn(role: string | null | undefined, isDepartmentHead: boolean): boolean {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const kind = attendanceAskOf(role, isDepartmentHead);
  const [on, setOn] = useState<boolean>(false);

  // After mount only (server and first client render agree): start from what this tab last knew.
  useEffect(() => {
    const known = remembered(userId);
    if (known && known.userId === userId) setOn(known.on);
  }, [userId]);

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
          remember({ userId, on: value, at: Date.now() });
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
  try {
    window.sessionStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing kept, nothing to forget.
  }
}
