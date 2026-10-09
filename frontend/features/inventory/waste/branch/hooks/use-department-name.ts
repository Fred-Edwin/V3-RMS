'use client';

import * as React from 'react';

import { branchWasteApi } from '../../_shared/services/branch-waste-api';

let cached: string | null = null;

/**
 * The caller's department name ("Kitchen") for the header subtitle. BW3 is the one endpoint that carries it, so one tiny call
 * (the smallest page) fills it, once per session. Until it arrives, or if it fails, the subtitle says "your department".
 */
export function useDepartmentName(): string {
  const [name, setName] = React.useState<string>(cached ?? 'your department');
  React.useEffect(() => {
    if (cached !== null) return;
    let live = true;
    branchWasteApi
      .mine({ page: 1, pageSize: 25 })
      .then((list) => {
        cached = list.department.name;
        if (live) setName(list.department.name);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return name;
}
