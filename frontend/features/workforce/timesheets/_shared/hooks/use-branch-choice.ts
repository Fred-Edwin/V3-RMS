'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { useRemote, useWorkforcePermissions } from '../../../_shared';
import { attendanceReads } from '../../../attendance';

export interface BranchChoice {
  /** Waiting for the person's permissions (and, for a company-wide role, the list of branches). */
  ready: boolean;
  /** Sent as `siteId`; undefined means "my own branch". */
  siteId: string | undefined;
  /** More than one branch to choose from: show the chooser. */
  branches: { id: string; name: string }[];
  name: string;
  choose: (id: string) => void;
}

/**
 * Which branch a Timesheets screen is about. A branch manager, a department head and a Store Manager have one; HR and the Director read
 * every branch that has the new clock on and choose, starting on their own if it is on, else the first that is. The Accountant reads all
 * branches too. A branch whose clock is off is never offered: it has no timesheets.
 */
export function useBranchChoice(capability: 'timesheet.read'): BranchChoice {
  const permissions = useWorkforcePermissions();
  const user = useAuthStore((s) => s.user);
  const wide = permissions.scopeOf(capability) === 'all';
  const sites = useRemote(() => attendanceReads.switches(), 'timesheet-branches', permissions.ready && wide);
  const [picked, setPicked] = React.useState<string | undefined>(undefined);
  const branches = React.useMemo(() => (sites.data ?? []).filter((s) => s.enabled).map((s) => ({ id: s.organizationId, name: s.organizationName })), [sites.data]);
  const own = user?.organizationId ?? undefined;
  const chosen = wide ? (picked ?? (branches.find((b) => b.id === own) ?? branches[0])?.id) : undefined;
  const ready = permissions.ready && (!wide || sites.status !== 'loading');
  const name = wide ? (branches.find((b) => b.id === chosen)?.name ?? '') : (user?.organizationName ?? 'your branch');
  return { ready, siteId: chosen, branches, name, choose: setPicked };
}
