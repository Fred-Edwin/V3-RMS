'use client';

import * as React from 'react';

import { Callout } from '../../_shared';
import { RuleRows } from '../components/rule-rows';
import { SitesPanel } from '../components/sites-panel';
import { TabColumns, WhoPanel, rowNames, whoEntries } from '../components/who-panel';
import { hoursAsDays, instantDay, minutesAsHours, multiplierWords } from '../lib/rules-words';
import type { OvertimeValues, RuleValues, RulesPage } from '../types/rules-types';
import { numbersEditor } from './editor-factories';
import type { RuleRowDef, TabProps } from './tab-types';

const ov = (values: RuleValues): OvertimeValues => values as unknown as OvertimeValues;
const capWords = (m: number | null): string => (m === null ? 'No cap' : minutesAsHours(m));
const budgetWords = (m: number | null): string => (m === null ? 'No budget' : minutesAsHours(m));

function multiplierValue(page: RulesPage): React.ReactNode {
  const answer = page.rows.multiplier;
  const set = ov(page.values).multipliers.ordinaryDay !== null;
  if (answer?.confirmedBy && set) {
    return (
      <span className="flex flex-col items-end gap-0.5">
        <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-success-fg">
          Confirmed by {answer.confirmedBy.name}, {answer.confirmedBy.role === 'ACCOUNTANT' ? 'Accountant' : answer.confirmedBy.role}
        </span>
        <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{instantDay(answer.confirmedBy.at)}</span>
      </span>
    );
  }
  // A value that waits shows the "Waiting for ..." tag the row already carries; only an empty rate needs words here.
  return answer?.waitingForConfirmation ? null : <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Not set yet</span>;
}

export const OVERTIME_ROWS: readonly RuleRowDef[] = [
  {
    id: 'serviceTail',
    title: 'Service tail',
    thing: 'the service tail',
    help: 'Recognised with no form, but only if orders or tickets are still open at shift end',
    value: (p) => ({ text: `${ov(p.values).serviceTailMinutes} min`, mono: true }),
    Editor: numbersEditor({
      title: 'Change the service tail',
      helper: 'Minutes after the shift end that count with no form, when orders or tickets are still open.',
      appliesTo: true,
      specs: [{ min: 0, max: 120, name: 'service tail in minutes' }],
      read: (v) => [ov(v).serviceTailMinutes],
      now: (v) => [`${ov(v).serviceTailMinutes} min`],
      build: ([n]) => ({ serviceTailMinutes: n }),
    }),
  },
  {
    id: 'weeklyCap',
    title: 'Weekly cap for one person',
    thing: 'the weekly cap',
    help: 'Beyond it, the Branch Manager must authorise each hour',
    value: (p) => ({ text: capWords(ov(p.values).weeklyCapMinutes), mono: ov(p.values).weeklyCapMinutes !== null }),
    Editor: numbersEditor({
      title: 'Change the weekly cap',
      helper: 'Hours of overtime one person can do in a week before each hour needs authorising. Steps of half an hour.',
      appliesTo: true,
      specs: [{ min: 0, max: 168, decimals: 1, step: 0.5, nullable: 'No cap', name: 'weekly cap in hours' }],
      read: (v) => [ov(v).weeklyCapMinutes === null ? null : ov(v).weeklyCapMinutes! / 60],
      now: (v) => [capWords(ov(v).weeklyCapMinutes)],
      build: ([n]) => ({ weeklyCapMinutes: n === null ? null : Math.round(n * 60) }),
    }),
  },
  {
    id: 'branchBudget',
    title: 'Branch budget for a month',
    thing: 'the branch budget',
    help: 'A warning to the Branch Manager and Director when it is passed',
    value: (p) => ({ text: budgetWords(ov(p.values).branchBudgetMinutesPerPeriod), mono: ov(p.values).branchBudgetMinutesPerPeriod !== null }),
    Editor: numbersEditor({
      title: 'Change the branch budget',
      helper: 'Hours of overtime a branch may use in a month before a warning goes to the Branch Manager and the Director.',
      appliesTo: true,
      specs: [{ min: 0, max: 5000, decimals: 1, step: 0.5, nullable: 'No budget', name: 'branch budget in hours' }],
      read: (v) => [ov(v).branchBudgetMinutesPerPeriod === null ? null : ov(v).branchBudgetMinutesPerPeriod! / 60],
      now: (v) => [budgetWords(ov(v).branchBudgetMinutesPerPeriod)],
      build: ([n]) => ({ branchBudgetMinutesPerPeriod: n === null ? null : Math.round(n * 60) }),
    }),
  },
  {
    id: 'approvalWindow',
    title: 'Time to authorise',
    thing: 'the time to authorise',
    help: 'Then it goes to the next person who can act',
    value: (p) => ({ text: hoursAsDays(ov(p.values).approvalWindowHours), mono: true }),
    Editor: numbersEditor({
      title: 'Change the time to authorise',
      helper: 'After this many days an unanswered request goes to the next person who can act.',
      appliesTo: true,
      specs: [{ min: 1, max: 30, name: 'days to authorise' }],
      read: (v) => [ov(v).approvalWindowHours / 24],
      now: (v) => [hoursAsDays(ov(v).approvalWindowHours)],
      build: ([n]) => ({ approvalWindowHours: (n ?? 0) * 24 }),
    }),
  },
  {
    id: 'multiplier',
    title: 'Pay multiplier',
    thing: 'the pay multiplier',
    tinted: true,
    help: (p) => {
      const m = ov(p.values).multipliers;
      return `Ordinary day ${multiplierWords(m.ordinaryDay)} · rest day ${multiplierWords(m.restDay)} · public holiday set in Holidays`;
    },
    value: () => ({ text: '' }),
    render: multiplierValue,
    Editor: numbersEditor({
      title: 'Change the pay multiplier',
      helper: 'What overtime pays, as a multiple of the hourly rate. The public holiday rate is set in Holidays.',
      specs: [
        { label: 'Ordinary day', min: 1, max: 5, decimals: 4, name: 'ordinary day multiplier' },
        { label: 'Rest day', min: 1, max: 5, decimals: 4, name: 'rest day multiplier' },
      ],
      read: (v) => [ov(v).multipliers.ordinaryDay === null ? null : Number(ov(v).multipliers.ordinaryDay), ov(v).multipliers.restDay === null ? null : Number(ov(v).multipliers.restDay)],
      now: (v) => [multiplierWords(ov(v).multipliers.ordinaryDay), multiplierWords(ov(v).multipliers.restDay)],
      build: ([a, b]) => ({ multipliers: { ordinaryDay: String(a), restDay: String(b) } }),
    }),
  },
];

const NAMES = rowNames(OVERTIME_ROWS);

export function OvertimeTab({ page, access, onSaved, onStale, backHref }: TabProps) {
  return (
    <TabColumns
      left={<RuleRows defs={OVERTIME_ROWS} page={page} onSaved={onSaved} onStale={onStale} />}
      right={
        <>
          <WhoPanel title="WHO CHANGES WHAT" entries={whoEntries(access, NAMES, true)} />
          <Callout tone="warning" title="A new multiplier waits for the Accountant">
            If the Director changes it, the old multiplier stays in use until the Accountant confirms the new one.
          </Callout>
          <SitesPanel page={page} slug="overtime" backHref={backHref} />
        </>
      }
    />
  );
}
