'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useRemote, useWorkforcePermissions } from '../../../_shared';
import { leaveReads } from '../services/leave-services';

/**
 * The site HR and the Director look at (`?site=`). A Branch or Store Manager reads their own site only, so no chooser and no site in the
 * address. The list of sites comes from the balances call (one row asked for), which is the only read that names them.
 */
export function useSiteChoice() {
  const permissions = useWorkforcePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const all = permissions.ready && permissions.scopeOf('leave.read') === 'all';
  const sites = useRemote(() => leaveReads.balances({ filter: 'all', page: 1, rows: 1 }).then((p) => p.sites), 'leave-sites', all);
  const site = all ? search.get('site') ?? undefined : undefined;

  const choose = useCallback(
    (next: string | undefined) => {
      const params = new URLSearchParams(search.toString());
      if (next) params.set('site', next);
      else params.delete('site');
      // A different site is a different list: back to page 1, and no open request.
      params.delete('page');
      params.delete('open');
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, search]
  );
  const name = sites.data?.find((s) => s.id === site)?.name;
  return { all, ready: permissions.ready, site, sites: sites.data ?? [], name, choose };
}
