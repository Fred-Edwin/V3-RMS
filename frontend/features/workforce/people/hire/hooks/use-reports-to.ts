'use client';

import { useMemo } from 'react';

import { useRemote } from '../../_shared/hooks/use-remote';
import { peopleReads } from '../../_shared/services/people-reads';
import type { EmployeeListRow } from '../../_shared/types/people-types';

/**
 * The people a new hire could report to: everyone on file in the chosen department, the head first. The server decides who the
 * head is (`isHead`); the form only lists them. With no department chosen there is nothing to list.
 */
export interface ReportsToOption {
  id: string;
  name: string;
  isHead: boolean;
}

export function useReportsTo(departmentId: string): { options: ReportsToOption[]; head: ReportsToOption | null; loading: boolean } {
  const result = useRemote(() => peopleReads.list({ departmentId, perPage: 100 }), `reports-to:${departmentId}`, departmentId !== '');
  return useMemo(() => {
    const rows: EmployeeListRow[] = departmentId === '' ? [] : (result.data?.rows ?? []);
    const options = rows
      .filter((r) => r.status !== 'EXITED')
      .map((r) => ({ id: r.id, name: r.name, isHead: r.isHead }))
      .sort((a, b) => Number(b.isHead) - Number(a.isHead) || a.name.localeCompare(b.name));
    return { options, head: options.find((o) => o.isHead) ?? null, loading: departmentId !== '' && result.status === 'loading' };
  }, [result.data, result.status, departmentId]);
}
