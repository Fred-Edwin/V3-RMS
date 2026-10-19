'use client';

import * as React from 'react';

import { Callout } from '../../_shared';
import { RuleRows } from '../components/rule-rows';
import { TabColumns, WhoPanel, rowNames, whoEntries } from '../components/who-panel';
import type { AttendanceValues, RuleValues } from '../types/rules-types';
import { numbersEditor } from './editor-factories';
import type { RuleRowDef, TabProps } from './tab-types';

const at = (values: RuleValues): AttendanceValues => values as unknown as AttendanceValues;
const FROM_MIDNIGHT = 'A clock rule changes from midnight (Nairobi) at the start of the day you choose. A shift open at that moment finishes under the old rule.';
const undoWords = (seconds: number): string => (seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`);
const radiusWords = (m: number | null): string => (m === null ? 'System setting' : `${m} m`);
const promptWords = (v: AttendanceValues): string => `${v.shiftEndHeadsUpMinutes} min before · every ${v.shiftEndPromptRepeatMinutes} min`;

export const ATTENDANCE_ROWS: readonly RuleRowDef[] = [
  {
    id: 'clockInOpens',
    title: 'Clock-in opens before the shift',
    thing: 'when clock-in opens',
    help: 'Only on a rostered shift',
    value: (p) => ({ text: `${at(p.values).clockInOpensMinutesBefore} min`, mono: true }),
    Editor: numbersEditor({
      title: 'Change when clock-in opens',
      helper: FROM_MIDNIGHT,
      specs: [{ min: 0, max: 240, name: 'minutes before the shift' }],
      read: (v) => [at(v).clockInOpensMinutesBefore],
      now: (v) => [`${at(v).clockInOpensMinutesBefore} min`],
      build: ([n]) => ({ clockInOpensMinutesBefore: n }),
    }),
  },
  {
    id: 'locationRadius',
    title: 'How close to the site',
    thing: 'how close to the site',
    help: 'The phone checks it. Without a signal the tap is saved and checked later.',
    value: (p) => ({ text: radiusWords(at(p.values).locationRadiusMetres), mono: at(p.values).locationRadiusMetres !== null }),
    Editor: numbersEditor({
      title: 'Change how close to the site',
      helper: `How near the site a phone must be to clock in. ${FROM_MIDNIGHT}`,
      specs: [{ min: 10, max: 5000, nullable: 'Use the system setting', name: 'distance in metres' }],
      read: (v) => [at(v).locationRadiusMetres],
      now: (v) => [radiusWords(at(v).locationRadiusMetres)],
      build: ([n]) => ({ locationRadiusMetres: n }),
    }),
  },
  {
    id: 'undoWindow',
    title: 'Undo a clock tap',
    thing: 'the undo time',
    help: 'After this, only a manager can change it',
    value: (p) => ({ text: undoWords(at(p.values).undoWindowSeconds), mono: true }),
    Editor: numbersEditor({
      title: 'Change the undo time',
      helper: `How long a person can undo their own tap, in minutes. ${FROM_MIDNIGHT}`,
      specs: [{ min: 0, max: 10, decimals: 1, step: 0.5, name: 'undo time in minutes' }],
      read: (v) => [at(v).undoWindowSeconds / 60],
      now: (v) => [undoWords(at(v).undoWindowSeconds)],
      build: ([n]) => ({ undoWindowSeconds: Math.round((n ?? 0) * 60) }),
    }),
  },
  {
    id: 'shiftEndPrompt',
    title: 'Shift-end prompt',
    thing: 'the shift-end prompt',
    help: 'A heads-up before the end, then it repeats until answered',
    value: (p) => ({ text: promptWords(at(p.values)), mono: true }),
    Editor: numbersEditor({
      title: 'Change the shift-end prompt',
      helper: `When the heads-up appears, and how often it repeats until answered. ${FROM_MIDNIGHT}`,
      specs: [
        { label: 'Heads-up (min before)', min: 0, max: 60, name: 'minutes before the end' },
        { label: 'Repeat (every min)', min: 1, max: 30, name: 'minutes between prompts' },
      ],
      read: (v) => [at(v).shiftEndHeadsUpMinutes, at(v).shiftEndPromptRepeatMinutes],
      now: (v) => [`${at(v).shiftEndHeadsUpMinutes} min`, `${at(v).shiftEndPromptRepeatMinutes} min`],
      build: ([a, b]) => ({ shiftEndHeadsUpMinutes: a, shiftEndPromptRepeatMinutes: b }),
    }),
  },
  {
    id: 'autoClose',
    title: 'Shift closes by itself',
    thing: 'when a shift closes by itself',
    help: 'At the scheduled end, if nobody answers the prompt',
    value: (p) => ({ text: `after ${at(p.values).autoCloseAfterMinutes} min`, mono: true }),
    Editor: numbersEditor({
      title: 'Change when a shift closes by itself',
      helper: `Minutes after the scheduled end when an unanswered shift is closed. ${FROM_MIDNIGHT}`,
      specs: [{ min: 1, max: 240, name: 'minutes after the end' }],
      read: (v) => [at(v).autoCloseAfterMinutes],
      now: (v) => [`${at(v).autoCloseAfterMinutes} min`],
      build: ([n]) => ({ autoCloseAfterMinutes: n }),
    }),
  },
  {
    id: 'clockSkew',
    title: 'Phone clock out by more than',
    thing: 'the phone clock difference',
    help: 'Flagged, never trusted. Hours use the server’s time.',
    value: (p) => ({ text: `${at(p.values).clockSkewFlagMinutes} min`, mono: true }),
    Editor: numbersEditor({
      title: 'Change the phone clock difference',
      helper: `A phone whose clock is further off than this is flagged. ${FROM_MIDNIGHT}`,
      specs: [{ min: 1, max: 120, name: 'minutes of difference' }],
      read: (v) => [at(v).clockSkewFlagMinutes],
      now: (v) => [`${at(v).clockSkewFlagMinutes} min`],
      build: ([n]) => ({ clockSkewFlagMinutes: n }),
    }),
  },
  { id: 'rounding', title: 'Rounding', thing: 'rounding', help: 'Hours are never rounded', value: () => ({ text: 'No rounding', muted: true }) },
];

const NAMES = rowNames(ATTENDANCE_ROWS);

export function AttendanceTab({ page, access, onSaved, onStale }: TabProps) {
  return (
    <TabColumns
      left={<RuleRows defs={ATTENDANCE_ROWS} page={page} onSaved={onSaved} onStale={onStale} />}
      right={
        <>
          <WhoPanel entries={whoEntries(access, NAMES, false)} />
          <Callout tone="neutral" variant="dashed" title="One company rule, on purpose">
            Attendance is one company rule on purpose. A site cannot have its own clock, so that hours are counted the same everywhere.
          </Callout>
        </>
      }
    />
  );
}
