'use client';

import * as React from 'react';

import { Callout, DialogButton, EmptyState, ErrorBlock, ListSkeleton, PageHeader, StatusTag, WorkforceFrame, WorkforcePinDialog, useAction, useRemote } from '../../../_shared';
import { attendanceReads, attendanceWrites } from '../../_shared/services/attendance-services';
import type { SwitchView } from '../../_shared/types/attendance-types';
import { forgetAttendanceOn } from '../hooks/use-attendance-on';
import { SWITCH_COPY, switchLines } from '../lib/switch-copy';

/**
 * The per-site switch for the new clock (not drawn in Paper; built in the kit's style, listed under "Built beyond Paper"). A list of
 * branches, each on or off, and a confirm that says what changes before it happens. The server refuses to switch a branch on while
 * someone is clocked in on the old clock; that refusal shows here in its own words. Reachable by the Director and the System Admin.
 */
export function SwitchScreen() {
  const list = useRemote(() => attendanceReads.switches(), 'switches');
  const [asking, setAsking] = React.useState<SwitchView | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const action = useAction((m) => {
    forgetAttendanceOn();
    setAsking(null);
    setMessage(m);
    list.reload();
  });

  const confirm = (pin: string): void => {
    if (!asking) return;
    const turnOn = !asking.enabled;
    void action.run(async () => {
      const result = await attendanceWrites.setSwitch(asking.organizationId, turnOn, pin);
      return result;
    }, SWITCH_COPY.done(asking.organizationName, turnOn));
  };

  return (
    <WorkforceFrame breadcrumb={{ section: 'Workforce', screen: 'Attendance switch' }} phoneTitle="Attendance switch" label="Attendance switch by branch" className="px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
        <PageHeader title="Attendance switch" subtitle={SWITCH_COPY.subtitle} />
        {message ? (
          <Callout tone="success" role="status" size="sm">
            {message}
          </Callout>
        ) : null}
        {list.status === 'loading' ? <ListSkeleton rows={4} columns={['fill', 100, 120]} label="Loading branches" /> : null}
        {list.status === 'error' && !list.data ? <ErrorBlock title="The branches did not load" line={list.error.message} onRetry={list.reload} /> : null}
        {list.data && list.data.length === 0 ? <EmptyState kind="nothingYet" title="No branches yet" line="There is no branch to switch." /> : null}
        {list.data && list.data.length > 0 ? (
          <ul className="m-0 flex list-none flex-col border border-wds-border bg-wds-surface p-0">
            {list.data.map((site) => (
              <li key={site.organizationId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-wds-border px-5 py-3.5 last:border-b-0">
                <div className="flex min-w-0 grow basis-[200px] flex-col gap-0.5">
                  <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{site.organizationName}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{SWITCH_COPY.since(site)}</span>
                </div>
                <StatusTag tone={site.enabled ? 'success' : 'neutral'}>{site.enabled ? 'New clock' : 'Old clock'}</StatusTag>
                <DialogButton kind={site.enabled ? 'cancel' : 'primary'} size="lg" onClick={() => { setMessage(null); action.clearError(); setAsking(site); }} aria-label={`${site.enabled ? 'Switch off' : 'Switch on'} the new clock for ${site.organizationName}`}>
                  {site.enabled ? 'Switch off' : 'Switch on'}
                </DialogButton>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {asking ? (
        <WorkforcePinDialog
          open
          onOpenChange={(o) => !o && !action.busy && setAsking(null)}
          title={asking.enabled ? `Switch the new clock off for ${asking.organizationName}?` : `Switch the new clock on for ${asking.organizationName}?`}
          description={asking.enabled ? SWITCH_COPY.offDescription : SWITCH_COPY.onDescription}
          summary={
            <ul className="m-0 flex list-none flex-col gap-1.5 border border-wds-border bg-wds-neutral-50 p-3.5">
              {switchLines(asking).map((line) => (
                <li key={line} className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
                  {line}
                </li>
              ))}
            </ul>
          }
          pinLabel={SWITCH_COPY.pinLabel}
          caption={SWITCH_COPY.pinCaption}
          confirmLabel={asking.enabled ? 'Switch off' : 'Switch on'}
          onSubmit={confirm}
          submitting={action.busy}
          error={action.error ?? undefined}
        />
      ) : null}
    </WorkforceFrame>
  );
}
