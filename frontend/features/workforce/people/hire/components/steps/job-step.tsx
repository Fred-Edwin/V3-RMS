'use client';

import * as React from 'react';

import { RadioCards, SingleDateField } from '../../../../_shared';
import { addDays } from '../../../_shared/lib/people-dates';
import type { Lookups } from '../../../_shared/types/people-types';
import { useReportsTo } from '../../hooks/use-reports-to';
import { departmentsFor, positionsFor, sitesFor, tracksTimeOf } from '../../lib/hire-choices';
import { probationEndsOn } from '../../lib/hire-figures';
import { isCasual, type HireState } from '../../lib/hire-model';
import { formatFullDateOrNone } from '../../lib/hire-labels';
import { HireField, HireInput, HireSelect } from '../hire-field';
import { SwitchRow } from '../switch-row';
import type { StepProps } from './who-step';

/** Step 2, Job (Paper `RE8-0`): site, department, position, who they report to, how they are employed, time tracking and dates. */
const EMPLOYMENT_OPTIONS = [
  { value: 'MONTHLY_WITH_CONTRACT', title: 'Monthly, with contract', description: 'Fixed monthly pay' },
  { value: 'MONTHLY_NO_CONTRACT_YET', title: 'Monthly, no contract yet', description: 'Default leave policy' },
  { value: 'CASUAL', title: 'Casual, daily', description: 'No login' },
] as const;

export function JobStep({
  state,
  errors,
  set,
  setJob,
  lookups,
  today,
  reports,
}: StepProps & { setJob: (patch: Partial<HireState>) => void; lookups: Lookups; today: string; reports: ReturnType<typeof useReportsTo> }) {
  const sites = sitesFor(lookups);
  const departments = departmentsFor(lookups, state.siteId);
  const positions = positionsFor(lookups, state);
  const filledFor = React.useRef('');

  // The head is the default boss: filled once per department, so choosing "No one" afterwards is kept.
  React.useEffect(() => {
    if (reports.head && state.reportsToId === '' && filledFor.current !== state.departmentId) {
      filledFor.current = state.departmentId;
      set({ reportsToId: reports.head.id });
    }
  }, [reports.head, state.departmentId, state.reportsToId, set]);

  const casual = isCasual(state);
  const months = lookups.probationRule.defaultMonths;
  const ends = probationEndsOn(state.startDate, months, casual);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <HireField label="Site" error={errors.siteId}>
          {(ids) => (
            <HireSelect
              ids={ids}
              value={state.siteId}
              placeholder="Choose the site"
              disabled={sites.length === 1}
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(e) => setJob({ siteId: e.target.value })}
            />
          )}
        </HireField>
        <HireField label="Department" error={errors.departmentId}>
          {(ids) => (
            <HireSelect
              ids={ids}
              value={state.departmentId}
              placeholder={state.siteId ? 'Choose the department' : 'Site first'}
              disabled={state.siteId === ''}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              onChange={(e) => setJob({ departmentId: e.target.value })}
            />
          )}
        </HireField>
        <HireField label="Position" error={errors.positionId}>
          {(ids) => (
            <HireSelect
              ids={ids}
              value={state.positionId}
              placeholder={state.departmentId ? 'Choose the position' : 'Department first'}
              disabled={state.departmentId === ''}
              options={positions.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(e) => setJob({ positionId: e.target.value })}
            />
          )}
        </HireField>
        <HireField label="Reports to">
          {(ids) => (
            <HireSelect
              ids={ids}
              value={state.reportsToId}
              disabled={state.departmentId === ''}
              options={[{ value: '', label: state.departmentId ? 'No one' : 'Department first' }, ...reports.options.map((o) => ({ value: o.id, label: o.isHead ? `${o.name} · head` : o.name }))]}
              onChange={(e) => set({ reportsToId: e.target.value })}
            />
          )}
        </HireField>
      </div>
      <RadioCards
        legend="HOW ARE THEY EMPLOYED?"
        legendStyle="caps"
        columns={3}
        options={EMPLOYMENT_OPTIONS}
        value={state.employment}
        onChange={(v) => setJob({ employment: v as HireState['employment'] })}
      />
      <SwitchRow
        title="Tracks time"
        description="They clock in, get a timesheet, and can earn overtime"
        checked={tracksTimeOf(state, lookups)}
        disabled={casual}
        onChange={(v) => set({ tracksTime: v })}
      />
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <SingleDateField label="START DATE" value={state.startDate} onChange={(day) => set({ startDate: day })} maxDate={addDays(today, 366)} error={errors.startDate} />
        <HireField label="Probation ends">
          {(ids) => <HireInput ids={ids} readOnly value={formatFullDateOrNone(ends)} />}
        </HireField>
      </div>
    </>
  );
}
