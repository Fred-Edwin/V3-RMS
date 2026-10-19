'use client';

import * as React from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { Callout } from '../../_shared';
import { NumbersEditor } from '../change/number-editor';
import { ChangeLink } from '../components/change-link';
import { RuleRows } from '../components/rule-rows';
import { SideLabel, TabColumns, WhoPanel, type WhoEntry } from '../components/who-panel';
import { useOnline } from '../hooks/use-rules-data';
import type { ConductLevel, ConductValues, RuleValues } from '../types/rules-types';
import { numbersEditor } from './editor-factories';
import type { RuleRowDef, TabProps } from './tab-types';

const cd = (values: RuleValues): ConductValues => values as unknown as ConductValues;
const monthsWords = (n: number): string => `${n} month${n === 1 ? '' : 's'}`;

const LEVEL_COPY: Record<ConductLevel['level'], { name: string; letter: string }> = {
  VERBAL_NOTE: { name: 'Verbal note', letter: 'None, a line on the file' },
  WRITTEN_WARNING: { name: 'Written warning', letter: 'Signed notice' },
  FINAL_WRITTEN_WARNING: { name: 'Final written warning', letter: 'Signed notice, then a hearing' },
};

export const CONDUCT_LIMIT_ROWS: readonly RuleRowDef[] = [
  {
    id: 'acknowledgeWithin',
    title: 'Time to sign that it was received',
    thing: 'the time to sign',
    help: 'After that the manager records why, with a witness',
    value: (p) => ({ text: `${cd(p.values).acknowledgeWithinDays} days`, mono: true }),
    Editor: numbersEditor({
      title: 'Change the time to sign',
      helper: 'Days a person has to sign that a notice was received. Notices already issued keep their dates.',
      specs: [{ min: 1, max: 30, name: 'days to sign' }],
      read: (v) => [cd(v).acknowledgeWithinDays],
      now: (v) => [`${cd(v).acknowledgeWithinDays} days`],
      build: ([n]) => ({ acknowledgeWithinDays: n }),
    }),
  },
  {
    id: 'appealWithin',
    title: 'Time to appeal',
    thing: 'the time to appeal',
    help: 'Counted from the day the notice is issued, signed or not',
    value: (p) => ({ text: `${cd(p.values).appealWithinDays} days`, mono: true }),
    Editor: numbersEditor({
      title: 'Change the time to appeal',
      helper: 'Days a person has to appeal a notice. Notices already issued keep their dates.',
      specs: [{ min: 1, max: 60, name: 'days to appeal' }],
      read: (v) => [cd(v).appealWithinDays],
      now: (v) => [`${cd(v).appealWithinDays} days`],
      build: ([n]) => ({ appealWithinDays: n }),
    }),
  },
];

const WHO: WhoEntry[] = [
  { role: 'Whoever issues', text: 'Raises, signs and issues a notice', tone: 'may' },
  { role: 'HR', text: 'Decides every appeal, can withdraw any notice', tone: 'may' },
  { role: 'Branch Manager', text: 'Reads own site', tone: 'read' },
  { role: 'Director', text: 'Changes this rule, reads all', tone: 'may' },
];

/** Months a level stays on the file. Only the months change: the ladder, the names and the letters are fixed. */
function LevelsTable({ props }: { props: TabProps }) {
  const { page, onSaved, onStale } = props;
  const online = useOnline();
  const [editing, setEditing] = React.useState<ConductLevel | null>(null);
  const answer = page.rows.levels;
  return (
    <section aria-label="Levels" className="flex flex-col gap-2">
      <SideLabel>THE RULE TODAY</SideLabel>
      <Table look="workforce" aria-label="Conduct levels">
        <TableHeader>
          <TableRow>
            <TableHead>LEVEL</TableHead>
            <TableHead>STAYS ON THE FILE</TableHead>
            <TableHead>LETTER</TableHead>
            <TableHead className="w-[72px]"><span className="sr-only">Change</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cd(page.values).levels.map((level) => (
            <TableRow key={level.level}>
              <TableCell className="font-semibold">{LEVEL_COPY[level.level].name}</TableCell>
              <TableCell className="font-wds-mono">{monthsWords(level.validForMonths)}</TableCell>
              <TableCell>{LEVEL_COPY[level.level].letter}</TableCell>
              <TableCell>
                {answer?.canChange ? (
                  <ChangeLink thing={`how long a ${LEVEL_COPY[level.level].name.toLowerCase()} stays`} state={{ kind: 'change' }} onChange={() => setEditing(level)} offline={!online} />
                ) : (
                  <ChangeLink thing={`how long a ${LEVEL_COPY[level.level].name.toLowerCase()} stays`} state={{ kind: 'locked', whoCan: answer?.lockedReason?.whoCan ?? [] }} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing ? (
        <NumbersEditor
          page={page}
          onSaved={onSaved}
          onStale={onStale}
          onClose={() => setEditing(null)}
          config={{
            title: `Change how long a ${LEVEL_COPY[editing.level].name.toLowerCase()} stays`,
            helper: `Only the months a ${LEVEL_COPY[editing.level].name.toLowerCase()} stays on the file change. The letter and the level name are fixed. Notices already issued keep their old end date.`,
            specs: [{ min: 1, max: 60, name: 'months on the file' }],
            read: (v) => [cd(v).levels.find((l) => l.level === editing.level)?.validForMonths ?? null],
            now: (v) => [`${cd(v).levels.find((l) => l.level === editing.level)?.validForMonths ?? '?'} mo`],
            build: ([n]) => ({ levels: cd(page.values).levels.map((l) => ({ level: l.level, validForMonths: l.level === editing.level ? n : l.validForMonths })) }),
          }}
        />
      ) : null}
    </section>
  );
}

export function ConductTab(props: TabProps) {
  return (
    <TabColumns
      left={
        <>
          <LevelsTable props={props} />
          <RuleRows defs={CONDUCT_LIMIT_ROWS} page={props.page} caption="TIME LIMITS" onSaved={props.onSaved} onStale={props.onStale} />
        </>
      }
      right={
        <>
          <WhoPanel title="WHO DOES WHAT" entries={WHO} />
          <Callout tone="neutral" variant="dashed" title="Nothing is ever deleted">
            When time is up a notice stops showing on the file but stays in the log. The person who issued a notice never decides its appeal.
          </Callout>
        </>
      }
    />
  );
}
