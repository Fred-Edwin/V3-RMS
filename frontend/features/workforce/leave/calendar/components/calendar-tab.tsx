'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Picker } from '@/components/ui2/picker';

import { Callout, EmptyState, ErrorBlock, ListSkeleton, useRemote } from '../../../_shared';
import { useDepartments } from '../../_shared/hooks/use-departments';
import { dayList } from '../../requests/lib/rota-view';
import { dayLong, daySmall, nairobiToday } from '../../_shared/lib/leave-dates';
import { requestsHref } from '../../_shared/lib/leave-routes';
import { leaveReads } from '../../_shared/services/leave-services';
import { tightDaysOf, weekStarts } from '../lib/calendar-layout';
import { CalendarGrid } from './calendar-grid';

function Legend() {
  return (
    <div aria-hidden className="flex items-center gap-4 font-wds-sans text-[11px] leading-[14px] text-wds-neutral-600">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 bg-wds-neutral-100" />Approved leave</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 border border-dashed border-wds-caramel-600" />Asked, waiting</span>
    </div>
  );
}

/** The Calendar tab (spec Step 16): three weeks of leave. `dept` and `from` live in the address; HR and the Director also pick a site. */
export function CalendarTab({ site }: { site: string | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const today = nairobiToday();
  const starts = weekStarts(today);
  const dept = search.get('dept') ?? undefined;
  const fromParam = search.get('from');
  const from = fromParam && starts.includes(fromParam) ? fromParam : starts[0];
  const departments = useDepartments(site);
  const remote = useRemote(() => leaveReads.calendar(site, dept, from), `calendar:${site}:${dept}:${from}`);
  const view = remote.data;

  const setParam = (name: string, value: string | undefined): void => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const deptName = departments.find((d) => d.id === dept)?.name ?? 'All departments';
  const tight = view ? tightDaysOf(view) : [];
  const first = tight[0];

  let body: React.ReactNode;
  if (remote.status === 'loading') body = <ListSkeleton rows={6} columns={[120, 'fill']} label="Loading the calendar" />;
  else if (!view) body = <ErrorBlock title="The calendar did not load" line="Nothing was changed. Check your connection and try again." onRetry={remote.reload} />;
  else if (view.people.length === 0) body = <EmptyState kind="nothingYet" title={dept ? `Nobody in ${deptName} has leave in these weeks.` : 'Nobody has leave in these weeks.'} />;
  else {
    body = (
      <>
        <CalendarGrid view={view} departmentLabel={deptName} today={today} />
        {first ? (
          <Callout
            tone="warning"
            title={`${tight.length === 1 ? 'One clash' : `${tight.length} clashes`} to look at: ${dayList(tight.map((t) => t.date))}`}
            action={<a href={requestsHref(first.applicationId)} className="inline-flex h-[34px] items-center border border-wds-border-strong px-4 font-wds-sans text-[13px] text-wds-text-ink hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring">Open the request →</a>}
            actionAt="end"
          >
            {`${deptName} would have ${first.working} people on ${dayLong(first.date)}, below the ${first.minimum} you set. This warns you; it does not stop you.`}
          </Callout>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {departments.length > 0 ? (
          <div className="flex items-center gap-2 font-wds-sans text-[13px] text-wds-text-secondary">
            Department
            <Picker className="h-8 w-[200px]" aria-label="Department" value={dept ?? ''} onValueChange={(v) => setParam('dept', v || undefined)} options={[{ value: '', label: 'All departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
          </div>
        ) : null}
        <div className="flex items-center gap-2 font-wds-sans text-[13px] text-wds-text-secondary">
          From
          <Picker className="h-8 w-[200px]" aria-label="First week shown" value={from} onValueChange={(v) => setParam('from', v === starts[0] ? undefined : v)} options={starts.map((s) => ({ value: s, label: `${daySmall(s)}${s === starts[0] ? ' (this week)' : ''}` }))} />
        </div>
        <span className="ml-auto"><Legend /></span>
      </div>
      {body}
    </div>
  );
}
