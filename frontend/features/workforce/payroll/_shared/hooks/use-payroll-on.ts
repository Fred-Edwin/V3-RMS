'use client';

import { useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';

import { payrollReads } from '../services/payroll-reads';

/**
 * Whether the Payroll menu row shows: true once Payroll has any month for the company (a branch is switched on, or a month already
 * exists). It asks Payroll itself, so it holds for every Payroll role wherever their own site is (the Accountant sits on the Central
 * Store, which has no clock switch). With every switch off the list is empty and the old payroll menu is unchanged. Until the answer
 * arrives, and if it never does, the answer is "off".
 */
const PAYROLL_ROLES = ['HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN'];
const FRESH_MS = 2 * 60 * 1000;

interface Cached {
  userId: string;
  on: boolean;
  at: number;
}
let cached: Cached | null = null;

export const asksPayroll = (role: string | null | undefined): boolean => Boolean(role && PAYROLL_ROLES.includes(role));

export function usePayrollOn(role: string | null | undefined): boolean {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const asks = asksPayroll(role);
  const [on, setOn] = useState<boolean>(cached && cached.userId === userId ? cached.on : false);

  useEffect(() => {
    if (!asks || !userId) {
      setOn(false);
      return;
    }
    if (cached && cached.userId === userId && Date.now() - cached.at < FRESH_MS) {
      setOn(cached.on);
      return;
    }
    let cancelled = false;
    payrollReads.list(1, 1).then(
      (list) => {
        cached = { userId, on: list.total > 0, at: Date.now() };
        if (!cancelled) setOn(list.total > 0);
      },
      () => {
        // A failed ask leaves the menu as it was: off if it never knew, unchanged if it did.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [asks, userId]);

  return on;
}
