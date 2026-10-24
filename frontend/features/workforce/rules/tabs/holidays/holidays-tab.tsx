'use client';

import * as React from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { cn } from '@/lib/cn';

import { Callout, DialogButton, SegmentedControl } from '../../../_shared';
import { nairobiToday } from '../../../rota';
import { ChangeLink } from '../../components/change-link';
import { RuleRows } from '../../components/rule-rows';
import { SideLabel, TabColumns, WhoPanel, whoEntries } from '../../components/who-panel';
import { useOnline } from '../../hooks/use-rules-data';
import { dayAndMonth, multiplierWords } from '../../lib/rules-words';
import type { HolidaysValues, RuleValues } from '../../types/rules-types';
import { HolidayEditor } from './holiday-editor';
import { numbersEditor } from '../editor-factories';
import type { RuleRowDef, TabProps } from '../tab-types';

const hd = (values: RuleValues): HolidaysValues => values as unknown as HolidaysValues;
const rateWords = (v: HolidaysValues): string => (v.payMultiplier === null ? 'Rate not set' : `${multiplierWords(v.payMultiplier)} hourly rate`);

export const HOLIDAY_PAY_ROWS: readonly RuleRowDef[] = [
  {
    id: 'payRate',
    title: 'Pay for hours worked on a holiday',
    thing: 'the holiday pay rate',
    help: 'Set by the Accountant, who confirms it with the client’s lawyer',
    value: (p) => ({ text: rateWords(hd(p.values)), mono: true }),
    Editor: numbersEditor({
      title: 'Change the holiday pay rate',
      helper: 'What hours worked on a public holiday are paid, as a multiple of the hourly rate. The Accountant’s save confirms it.',
      specs: [{ min: 1, max: 5, decimals: 4, name: 'holiday pay multiplier' }],
      read: (v) => [hd(v).payMultiplier === null ? null : Number(hd(v).payMultiplier)],
      now: (v) => [hd(v).payMultiplier === null ? 'Not set' : multiplierWords(hd(v).payMultiplier)],
      build: ([n]) => ({ payMultiplier: String(n) }),
    }),
  },
];

const NAMES = { holidays: 'the list', payRate: 'the pay rate' };

function HolidayList({ props, year }: { props: TabProps; year: number }) {
  const { page, onSaved, onStale } = props;
  const online = useOnline();
  const [editing, setEditing] = React.useState<{ date: string; name: string } | 'new' | null>(null);
  const today = nairobiToday();
  const answer = page.rows.holidays;
  const mayEdit = Boolean(answer?.canChange);
  const rows = hd(page.values).holidays.filter((h) => h.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
  const rate = rateWords(hd(page.values));
  const link = (h: { date: string; name: string }): React.ReactNode =>
    h.date < today ? (
      <span className="font-wds-sans text-[13px] text-wds-text-secondary">Past</span>
    ) : mayEdit ? (
      <ChangeLink thing={`the holiday ${h.name}`} state={{ kind: 'change' }} onChange={() => setEditing(h)} offline={!online} />
    ) : (
      <ChangeLink thing="the holiday list" state={{ kind: 'locked', whoCan: answer?.lockedReason?.whoCan ?? [] }} />
    );

  return (
    <section aria-label={`Public holidays ${year}`} className="flex flex-col gap-2">
      <SideLabel>PUBLIC HOLIDAYS IN {year}</SideLabel>
      {rows.length === 0 ? (
        <Callout tone="neutral" variant="dashed" title={`No public holidays are set for ${year} yet`}>
          The Director adds them each year.
        </Callout>
      ) : (
        <Table look="workforce" aria-label={`Public holidays ${year}`}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">DATE</TableHead>
              <TableHead>HOLIDAY</TableHead>
              <TableHead className="w-[190px]">HOURS WORKED PAY</TableHead>
              <TableHead className="w-[100px]">DAY IN LIEU</TableHead>
              <TableHead className="w-[72px]"><span className="sr-only">Change</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((h) => (
              <TableRow key={h.date} className={cn(h.date < today && 'text-wds-text-secondary')}>
                <TableCell className="font-wds-mono">{dayAndMonth(h.date)}</TableCell>
                <TableCell>{h.name}</TableCell>
                <TableCell className="font-wds-mono">{rate}</TableCell>
                <TableCell className="text-wds-text-secondary">No</TableCell>
                <TableCell>{link(h)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Showing {rows.length} {rows.length === 1 ? 'holiday' : 'holidays'} in {year}</p>
      {mayEdit ? (
        <div>
          <DialogButton kind="cancel" onClick={() => setEditing('new')} disabled={!online} title={online ? undefined : 'No connection'}>
            Add a holiday
          </DialogButton>
        </div>
      ) : null}
      {editing ? <HolidayEditor page={page} holiday={editing === 'new' ? null : editing} onSaved={onSaved} onStale={onStale} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function RateNote({ page }: { page: TabProps['page'] }) {
  const answer = page.rows.payRate;
  if (hd(page.values).payMultiplier === null) {
    return (
      <Callout tone="warning" title="No rate yet">
        Hours worked on a holiday are paid as an ordinary day until the Accountant sets one.
      </Callout>
    );
  }
  if (answer?.confirmedBy && !answer.waitingForConfirmation) return null;
  return (
    <Callout tone="warning" title="The rate is to be confirmed">
      Kenyan wage rules usually pay more for work on a public holiday. The Accountant confirms the exact rate with the client’s lawyer.
    </Callout>
  );
}

export function HolidaysTab(props: TabProps) {
  const thisYear = Number(nairobiToday().slice(0, 4));
  const [year, setYear] = React.useState(thisYear);
  return (
    <TabColumns
      leftWidth={760}
      left={
        <>
          <SegmentedControl label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} items={[thisYear, thisYear + 1].map((y) => ({ value: String(y), label: String(y) }))} />
          <HolidayList props={props} year={year} />
          <RuleRows defs={HOLIDAY_PAY_ROWS} page={props.page} caption="" onSaved={props.onSaved} onStale={props.onStale} />
        </>
      }
      right={
        <>
          <SideLabel>HOW A HOLIDAY WORKS</SideLabel>
          <Callout tone="neutral" variant="bar" title="Wendo does not close, so nothing changes on Shifts">
            Shifts are planned as on any day. Only the hours worked on a public holiday are paid at the rate in this table, and payroll shows it as its own line on the payslip.
          </Callout>
          <Callout tone="neutral" variant="dashed" title="Leave never counts a holiday twice">
            Leave counts every calendar day, so a holiday inside a leave request is still one leave day.
          </Callout>
          <RateNote page={props.page} />
          <WhoPanel title="WHO DOES WHAT" entries={whoEntries(props.access, NAMES, false)} />
        </>
      }
    />
  );
}
