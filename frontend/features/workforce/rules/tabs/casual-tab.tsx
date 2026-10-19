'use client';

import * as React from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { Callout, ErrorBlock, ListSkeleton, useRemote } from '../../_shared';
import { peopleReads, type Lookups } from '../../people';
import { NumbersEditor } from '../change/number-editor';
import { ChangeLink } from '../components/change-link';
import { RuleRows } from '../components/rule-rows';
import { SideLabel, TabColumns, WhoPanel, rowNames, whoEntries } from '../components/who-panel';
import { useOnline } from '../hooks/use-rules-data';
import { grouped, perHourOver8 } from '../lib/rules-words';
import { rulesReads } from '../services/rules-services';
import { isLocked, type CasualValues, type RuleValues, type RulesPageAnswer, type StatutoryValues } from '../types/rules-types';
import { choiceEditor } from './editor-factories';
import type { RuleRowDef, TabProps } from './tab-types';

const cs = (values: RuleValues): CasualValues => values as unknown as CasualValues;

export const CASUAL_ROWS: readonly RuleRowDef[] = [
  { id: 'whoRecords', title: 'Who records the day', thing: 'who records the day', help: 'Casuals have no login, so their head records their times', value: () => ({ text: 'The department head' }) },
  { id: 'whoApproves', title: 'Who approves', thing: 'who approves', help: 'Never the person who recorded it', value: () => ({ text: 'The Branch Manager' }) },
  {
    id: 'cashHolder',
    title: 'Who holds the petty cash',
    thing: 'who holds the petty cash',
    help: 'Paid out as cash each day, never by the head',
    value: (p) => ({ text: cs(p.values).pettyCashHolder.mode === 'BRANCH_MANAGER' ? 'The Branch Manager' : 'One named person' }),
    Editor: choiceEditor({
      title: 'Change who holds the petty cash',
      helper: 'Casual pay is paid out in cash each day by this person, never by the department head.',
      legend: 'Who holds the petty cash',
      columns: 1,
      options: [
        { value: 'BRANCH_MANAGER', title: 'The Branch Manager' },
        { value: 'NAMED', title: 'One named person', description: 'Choosing a named person is not available yet.', disabled: true },
      ],
      read: (v) => cs(v).pettyCashHolder.mode,
      build: () => ({ pettyCashHolder: { mode: 'BRANCH_MANAGER' } }),
    }),
  },
];

const NAMES = { ...rowNames(CASUAL_ROWS), rates: 'daily rates' };

/** The daily rate for each department. A department with no rate says Not set; a casual there cannot be paid until one is set. */
function RatesTable({ props, lookups }: { props: TabProps; lookups: Lookups }) {
  const { page, onSaved, onStale } = props;
  const online = useOnline();
  const [editing, setEditing] = React.useState<{ id: string; label: string } | null>(null);
  const answer = page.rows.rates;
  const rates = cs(page.values).rates;
  const sites = new Map(lookups.organizations.map((o) => [o.id, o.name]));
  const departments = lookups.departments.filter((d) => d.isActive).map((d) => ({ id: d.id, label: `${d.name} · ${sites.get(d.organizationId) ?? ''}` })).sort((a, b) => a.label.localeCompare(b.label));
  const rateOf = (id: string): string | null => rates.find((r) => r.departmentId === id)?.dailyRate ?? null;

  return (
    <section aria-label="Daily rates" className="flex flex-col gap-2">
      <SideLabel>DAILY RATE FOR A DAY OF 8 HOURS</SideLabel>
      <Table look="workforce" aria-label="Daily rates by department">
        <TableHeader>
          <TableRow>
            <TableHead>DEPARTMENT</TableHead>
            <TableHead className="text-right">KES A DAY</TableHead>
            <TableHead className="text-right">PER HOUR OVER 8</TableHead>
            <TableHead className="w-[96px]"><span className="sr-only">Change</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {departments.map((d) => {
            const rate = rateOf(d.id);
            const thing = `the daily rate for ${d.label}`;
            return (
              <TableRow key={d.id}>
                <TableCell>{d.label}</TableCell>
                <TableCell className="text-right font-wds-mono">{rate === null ? <span className="font-wds-sans text-wds-text-secondary">Not set</span> : grouped(rate)}</TableCell>
                <TableCell className="text-right font-wds-mono">{rate === null ? '' : grouped(perHourOver8(rate))}</TableCell>
                <TableCell className="text-right">
                  {answer?.canChange ? (
                    <ChangeLink thing={thing} state={{ kind: 'change' }} onChange={() => setEditing(d)} offline={!online} />
                  ) : (
                    <ChangeLink thing={thing} state={{ kind: 'locked', whoCan: answer?.lockedReason?.whoCan ?? [] }} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {editing ? (
        <NumbersEditor
          page={page}
          onSaved={onSaved}
          onStale={onStale}
          onClose={() => setEditing(null)}
          config={{
            title: `${rateOf(editing.id) === null ? 'Set' : 'Change'} the daily rate · ${editing.label}`,
            helper: 'Pay for a day of 8 hours, in KES. Hours over 8 are paid at the rate divided by 8. A casual in this department cannot be paid until a rate is set.',
            specs: [{ min: 1, max: 100000, decimals: 2, name: 'daily rate in KES' }],
            read: () => [rateOf(editing.id) === null ? null : Number(rateOf(editing.id))],
            now: () => [rateOf(editing.id) === null ? 'Not set' : grouped(rateOf(editing.id) as string)],
            build: ([n]) => ({ rates: [...rates.filter((r) => r.departmentId !== editing.id), { departmentId: editing.id, dailyRate: String(n) }] }),
          }}
        />
      ) : null}
    </section>
  );
}

/** The Accountant may add a table "Casual pay threshold" in Statutory; its first band's top is the daily amount below which no deductions apply. */
function thresholdOf(statutory: RulesPageAnswer | null): number | null {
  if (!statutory || isLocked(statutory)) return null;
  const table = (statutory.values as unknown as StatutoryValues).tables.find((t) => t.code === 'OTHER' && /casual/i.test(t.name));
  const top = table?.bands[0]?.toAmount;
  return top ? Number(top) : null;
}

export function CasualTab(props: TabProps) {
  const lookups = useRemote<Lookups>(() => peopleReads.lookups(), 'rules-lookups');
  const statutory = useRemote<RulesPageAnswer>(() => rulesReads.page('STATUTORY', null), 'casual-threshold');
  const threshold = thresholdOf(statutory.data);
  const above = threshold !== null && cs(props.page.values).rates.some((r) => Number(r.dailyRate) > threshold);
  return (
    <TabColumns
      left={
        <>
          {lookups.status === 'loading' ? <ListSkeleton rows={4} label="Loading the departments" /> : lookups.status === 'error' ? <ErrorBlock title="We could not load the departments" line="The rows below are not affected." onRetry={lookups.reload} /> : <RatesTable props={props} lookups={lookups.data} />}
          <RuleRows defs={CASUAL_ROWS} page={props.page} caption="" onSaved={props.onSaved} onStale={props.onStale} />
        </>
      }
      right={
        <>
          <WhoPanel entries={whoEntries(props.access, NAMES, false)} />
          {above ? (
            <Callout tone="warning" title="Check with the Accountant" role="status">
              A casual rate is now above the casual pay threshold set in Statutory, so deductions may apply.
            </Callout>
          ) : (
            <Callout tone="neutral" variant="dashed" title="No statutory deductions">
              Casual daily pay is below the tax threshold, so the pay sheet shows one amount. The Accountant confirms this in the Statutory tab.
            </Callout>
          )}
        </>
      }
    />
  );
}
