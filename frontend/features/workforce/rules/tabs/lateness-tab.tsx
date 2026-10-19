'use client';

import * as React from 'react';

import { RuleRows } from '../components/rule-rows';
import { SitesPanel } from '../components/sites-panel';
import { TabColumns, WhoPanel, rowNames, whoEntries } from '../components/who-panel';
import { hoursAsDays } from '../lib/rules-words';
import type { LatenessValues } from '../types/rules-types';
import { choiceEditor, numbersEditor } from './editor-factories';
import { LatenessPolicyEditor, policyWords } from './lateness-policy-editor';
import type { RuleRowDef, TabProps } from './tab-types';

const v = (page: { values: unknown }): LatenessValues => page.values as LatenessValues;

export const LATENESS_ROWS: readonly RuleRowDef[] = [
  {
    id: 'graceMinutes',
    title: 'Grace period',
    thing: 'the grace period',
    help: 'Arriving up to this many minutes late is not recorded as late',
    value: (p) => ({ text: `${v(p).graceMinutes} min`, mono: true }),
    Editor: numbersEditor({
      title: 'Change the grace period',
      helper: 'Only the minutes of grace change. Late marks already recorded stay as they are.',
      appliesTo: true,
      specs: [{ min: 0, max: 60, name: 'grace period in minutes' }],
      read: (values) => [(values as unknown as LatenessValues).graceMinutes],
      now: (values) => [`${(values as unknown as LatenessValues).graceMinutes} min`],
      build: ([n]) => ({ graceMinutes: n }),
    }),
  },
  {
    id: 'afterGrace',
    title: 'What happens after the grace period',
    thing: 'what happens after the grace period',
    help: 'Record only · deduct after a number of late days · deduct from the first minute',
    value: (p) => ({ text: policyWords(v(p)) }),
    Editor: LatenessPolicyEditor,
  },
  {
    id: 'deductionCap',
    title: 'Deduction cap in one payroll',
    thing: 'the deduction cap',
    help: 'As a share of the monthly basic pay',
    value: (p) => ({ text: v(p).deductionCapPercentOfPay === null ? 'No cap' : `${v(p).deductionCapPercentOfPay}%`, mono: v(p).deductionCapPercentOfPay !== null }),
    Editor: numbersEditor({
      title: 'Change the deduction cap',
      helper: 'The most that can be deducted for lateness in one payroll, as a share of the monthly basic pay. It is the same for every site.',
      specs: [{ min: 0, max: 100, decimals: 2, nullable: 'No cap', name: 'deduction cap in percent' }],
      read: (values) => [(values as unknown as LatenessValues).deductionCapPercentOfPay],
      now: (values) => [(values as unknown as LatenessValues).deductionCapPercentOfPay === null ? 'No cap' : `${(values as unknown as LatenessValues).deductionCapPercentOfPay}%`],
      build: ([n]) => ({ deductionCapPercentOfPay: n }),
    }),
  },
  {
    id: 'excuseWindow',
    title: 'Time to excuse a late arrival',
    thing: 'the time to excuse a late arrival',
    help: 'The manager or head can excuse it, with a reason, for this long',
    value: (p) => ({ text: hoursAsDays(v(p).excuseWindowHours), mono: true }),
    Editor: numbersEditor({
      title: 'Change the time to excuse a late arrival',
      helper: 'After this many days a late arrival can no longer be excused.',
      appliesTo: true,
      specs: [{ min: 1, max: 30, name: 'days to excuse a late arrival' }],
      read: (values) => [(values as unknown as LatenessValues).excuseWindowHours / 24],
      now: (values) => [hoursAsDays((values as unknown as LatenessValues).excuseWindowHours)],
      build: ([n]) => ({ excuseWindowHours: (n ?? 0) * 24 }),
    }),
  },
  {
    id: 'makeUpSameDay',
    title: 'Make up the time the same day',
    thing: 'making up the time the same day',
    help: 'Staying on cancels the lateness',
    value: (p) => ({ text: v(p).makeUpSameDay ? 'On' : 'Off', muted: !v(p).makeUpSameDay }),
    Editor: choiceEditor({
      title: 'Change making up the time the same day',
      helper: 'When on, a person who stays on for the minutes they were late has no late mark.',
      legend: 'Make up the time the same day',
      appliesTo: true,
      options: [
        { value: 'off', title: 'Off', description: 'A late mark stays.' },
        { value: 'on', title: 'On', description: 'Staying on cancels it.' },
      ],
      read: (values) => ((values as unknown as LatenessValues).makeUpSameDay ? 'on' : 'off'),
      build: (value) => ({ makeUpSameDay: value === 'on' }),
    }),
  },
];

const TITLES = rowNames(LATENESS_ROWS);

export function LatenessTab({ page, access, onSaved, onStale, backHref }: TabProps) {
  return (
    <TabColumns
      left={<RuleRows defs={LATENESS_ROWS} page={page} onSaved={onSaved} onStale={onStale} />}
      right={
        <>
          <WhoPanel entries={whoEntries(access, TITLES, true)} />
          <SitesPanel page={page} slug="lateness" backHref={backHref} />
        </>
      }
    />
  );
}
