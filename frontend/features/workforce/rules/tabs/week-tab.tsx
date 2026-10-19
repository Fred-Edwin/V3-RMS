'use client';

import * as React from 'react';
import Link from 'next/link';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { cn } from '@/lib/cn';

import { Callout, ErrorBlock, FOCUS_RING, ListSkeleton, onHover, useRemote } from '../../_shared';
import { rotaReads, type TemplateView } from '../../rota';
import { RuleRows } from '../components/rule-rows';
import { SideLabel, TabColumns, WhoPanel, rowNames, whoEntries } from '../components/who-panel';
import { weekdayName } from '../lib/error-words';
import { WEEKDAY_NAMES } from '../lib/rules-words';
import type { RuleValues, WeekValues } from '../types/rules-types';
import { choiceEditor } from './editor-factories';
import type { RuleRowDef, TabProps } from './tab-types';

const wk = (values: RuleValues): WeekValues => values as unknown as WeekValues;
const dayOf = (values: RuleValues): string => WEEKDAY_NAMES[wk(values).weekStartsOn - 1] ?? 'Monday';

export const WEEK_ROWS: readonly RuleRowDef[] = [
  {
    id: 'weekStartsOn',
    title: 'The week starts on',
    thing: 'the first day of the week',
    help: 'Rota weeks, timesheet weeks and overtime weeks all begin on this day',
    value: (p) => ({ text: dayOf(p.values) }),
    Editor: choiceEditor({
      title: 'Change the first day of the week',
      helper: 'The new week start applies from the first week that begins on or after the day you choose. Published rotas and approved months do not change. Weekly overtime caps count from the new first day.',
      legend: 'The week starts on',
      columns: 3,
      options: WEEKDAY_NAMES.map((name, i) => ({ value: String(i + 1), title: name })),
      read: (v) => String(wk(v).weekStartsOn),
      build: (value) => ({ weekStartsOn: Number(value) }),
      weekStartName: (value) => weekdayName(Number(value)),
    }),
  },
  { id: 'unpaidBreak', title: 'Unpaid break', thing: 'the unpaid break', help: 'Each shift template has its own, so rota and payslip agree', value: () => ({ text: 'per shift template', muted: true }) },
];

const NAMES = rowNames(WEEK_ROWS);

/** "UNPAID BREAKS TODAY": live from the shift templates, read only. */
function BreaksTable() {
  const remote = useRemote<TemplateView[]>(() => rotaReads.templates({}), 'templates');
  if (remote.status === 'loading') return <ListSkeleton rows={4} label="Loading the shift templates" />;
  if (remote.status === 'error') return <ErrorBlock title="We could not load the shift templates" line="The week start above is not affected." onRetry={remote.reload} />;
  const rows = remote.data.filter((t) => t.isActive);
  return (
    <section aria-label="Unpaid breaks today" className="flex flex-col gap-2">
      <SideLabel>UNPAID BREAKS TODAY · FROM SHIFT TEMPLATES, READ ONLY</SideLabel>
      {rows.length === 0 ? (
        <Callout tone="neutral" variant="dashed">No shift templates yet. Add them under Schedule, Shift templates.</Callout>
      ) : (
        <Table look="workforce" aria-label="Unpaid breaks by shift template">
          <TableHeader>
            <TableRow>
              <TableHead>SHIFT</TableHead>
              <TableHead>TIMES</TableHead>
              <TableHead className="text-right">UNPAID BREAK</TableHead>
              <TableHead className="text-right">PAID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="font-wds-mono">{t.startTime}-{t.endTime}</TableCell>
                <TableCell className="text-right font-wds-mono">{t.unpaidBreakMinutes} min</TableCell>
                <TableCell className="text-right font-wds-mono">{t.paidMinutes / 60} h paid</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

export function WeekTab({ page, access, onSaved, onStale }: TabProps) {
  return (
    <TabColumns
      left={
        <>
          <RuleRows defs={WEEK_ROWS} page={page} onSaved={onSaved} onStale={onStale} />
          <BreaksTable />
        </>
      }
      right={
        <>
          <WhoPanel entries={whoEntries(access, NAMES, false)} />
          <p className="m-0 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
            One company rule on purpose, so hours are counted the same everywhere. A break is changed on its shift template (Schedule, Shift templates), and that never changes a shift already worked.{' '}
            <Link href="/app/workforce/schedule/templates" className={cn('text-wds-info-fg', FOCUS_RING, onHover('underline'))}>
              Shift templates
            </Link>
          </p>
        </>
      }
    />
  );
}
