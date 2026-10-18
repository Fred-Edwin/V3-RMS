'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type { WorkforceCapability, WorkforcePermissionsPayload, WorkforceScope } from '../lib/capabilities';

/**
 * What the signed-in person may do in Workforce, from the server's access table (`GET /workforce/permissions/me`). The front end
 * never keeps a second copy of who may do what: a card or a button asks `can('overtime.approve')`.
 *
 * `ready` is false until the first answer, so a screen waits instead of flashing "no access". `can` keeps the same identity between
 * renders while the answer is the same. A later slice that needs this elsewhere moves it to `_shared`; it is here because Home is its first reader.
 */
type Status = 'loading' | 'ready' | 'error';

interface Answer {
  userId: string;
  status: Status;
  capabilities: ReadonlySet<WorkforceCapability>;
  scopes: ReadonlyMap<WorkforceCapability, WorkforceScope>;
  isDepartmentHead: boolean;
  tracksTime: boolean;
}

export function useWorkforcePermissions() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId || !accessToken) return;
    let cancelled = false;
    apiClient.get<WorkforcePermissionsPayload>('/workforce/permissions/me', accessToken).then(
      (data) => {
        if (cancelled) return;
        setAnswer({ userId, status: 'ready', capabilities: new Set(data.capabilities.map((c) => c.capability)), scopes: new Map(data.capabilities.map((c) => [c.capability, c.scope] as const)), isDepartmentHead: data.isDepartmentHead, tracksTime: data.tracksTime });
      },
      () => {
        if (!cancelled) setAnswer({ userId, status: 'error', capabilities: new Set(), scopes: new Map(), isDepartmentHead: false, tracksTime: false });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [userId, accessToken, attempt]);

  const mine = answer !== null && answer.userId === userId ? answer : null;
  const capabilities = mine?.capabilities;
  const can = useCallback((capability: WorkforceCapability): boolean => capabilities?.has(capability) ?? false, [capabilities]);
  const scopes = mine?.scopes;
  /** The reach the server gave a capability: 'all' (every site), 'unit' (one site), 'dept' (their departments) or 'own'. */
  const scopeOf = useCallback((capability: WorkforceCapability): WorkforceScope | null => scopes?.get(capability) ?? null, [scopes]);
  const retry = useCallback(() => {
    setAnswer(null);
    setAttempt((n) => n + 1);
  }, []);

  return useMemo(
    () => ({ can, scopeOf, ready: mine?.status === 'ready', failed: mine?.status === 'error', isDepartmentHead: mine?.isDepartmentHead ?? false, tracksTime: mine?.tracksTime ?? false, retry }),
    [can, scopeOf, mine?.status, mine?.isDepartmentHead, mine?.tracksTime, retry]
  );
}
