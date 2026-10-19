'use client';

import * as React from 'react';

import { useRemote } from '../../../_shared';
import { peopleReads } from '../../../people';

/** The active departments of one branch, for the Department filter. Empty until People's lookups answer; a failure just leaves the filter out. */
export function useDepartments(siteId: string | null): { id: string; name: string }[] {
  const lookups = useRemote(() => peopleReads.lookups(), 'timesheet-lookups', siteId !== null);
  return React.useMemo(() => (lookups.data?.departments ?? []).filter((d) => d.isActive && d.organizationId === siteId).map((d) => ({ id: d.id, name: d.name })), [lookups.data, siteId]);
}
