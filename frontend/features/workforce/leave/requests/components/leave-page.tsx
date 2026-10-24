'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { ChoiceChips, DialogButton, EmptyState, ListSkeleton, PageHeader, SegmentedControl, WorkforceFrame, useWorkforcePermissions } from '../../../_shared';
import { BalancesTab } from '../../balances/components/balances-tab';
import { CalendarTab } from '../../calendar/components/calendar-tab';
import { useOnline } from '../../_shared/hooks/use-online';
import { useSiteChoice } from '../../_shared/hooks/use-site-choice';
import { dayLong, nairobiToday } from '../../_shared/lib/leave-dates';
import { RequestsTab } from './requests-tab';

type TabKey = 'requests' | 'calendar' | 'balances';
const TABS = [{ value: 'requests', label: 'Requests' }, { value: 'calendar', label: 'Calendar' }, { value: 'balances', label: 'Balances' }];

const SUBLINE: Record<TabKey, (date: string) => string> = {
  requests: (date) => `${date} · approved leave blocks the shifts by itself`,
  calendar: () => 'Three weeks at a glance · a request still waiting is dashed until it is decided',
  balances: () => 'Every calendar day of leave counts · the leave year is the calendar year',
};

/**
 * Leave, for the people who decide it (spec Step 10, 14, 16): Requests (with the rota in front of the manager), Calendar and Balances.
 * The single place leave is decided. A reader without `leave.read` at site or company reach (a department head, floor staff) sees a plain
 * refusal; HR and the Director also choose a site. `?tab=` holds the tab; every list keeps its own filters in the address.
 */
export function LeavePage() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const permissions = useWorkforcePermissions();
  const sites = useSiteChoice();
  const online = useOnline();
  const [adjusting, setAdjusting] = React.useState(false);
  const raw = search.get('tab');
  const tab: TabKey = raw === 'calendar' || raw === 'balances' ? raw : 'requests';
  const scope = permissions.scopeOf('leave.read');
  const allowed = scope === 'all' || scope === 'unit';
  const canAdjust = permissions.can('leave.balance_adjust');

  const chooseTab = (value: string): void => {
    // Each tab has its own filters, so changing tab starts clean.
    router.replace(`${pathname}?tab=${value}${sites.site ? `&site=${sites.site}` : ''}`, { scroll: false });
  };

  let body: React.ReactNode;
  if (!permissions.ready) body = <ListSkeleton rows={6} columns={[160, 'fill', 100]} label="Loading leave" />;
  else if (!allowed) body = <EmptyState kind="nothingYet" title="Leave is decided by managers and HR." line="Your own leave is under My leave." />;
  else if (tab === 'requests') body = <RequestsTab site={sites.site} siteLabel={sites.name ?? null} />;
  else if (tab === 'calendar') body = <CalendarTab site={sites.site} />;
  else body = <BalancesTab site={sites.site} canAdjust={canAdjust} adjustOpen={adjusting} onAdjustOpenChange={setAdjusting} sitesAllowed={sites.all} />;

  return (
    <WorkforceFrame
      breadcrumb={{ section: 'Workforce', screen: 'Leave' }}
      phoneTitle="Leave"
      label="Leave"
      className="px-4 py-6 lg:px-8 lg:py-7"
      actions={allowed && tab === 'balances' && canAdjust ? <DialogButton kind="primary" size="lg" disabled={!online} onClick={() => setAdjusting(true)}>Adjust a balance</DialogButton> : undefined}
    >
      <div className="mx-auto flex w-full max-w-[1204px] flex-col gap-5">
        <PageHeader
          size="lg"
          title={`Leave${sites.name ? ` · ${sites.name}` : ''}`}
          subtitle={SUBLINE[tab](dayLong(nairobiToday()))}
          actions={allowed ? <SegmentedControl label="Leave view" items={TABS} value={tab} onChange={chooseTab} /> : undefined}
        />
        {allowed && sites.all && sites.sites.length > 1 && tab !== 'balances' ? (
          <ChoiceChips legend="Site" legendStyle="caps" size="sm" value={sites.site ?? ''} onChange={(v) => sites.choose(v || undefined)} options={[{ value: '', label: 'All sites' }, ...sites.sites.map((s) => ({ value: s.id, label: s.name }))]} />
        ) : null}
        {body}
      </div>
    </WorkforceFrame>
  );
}
