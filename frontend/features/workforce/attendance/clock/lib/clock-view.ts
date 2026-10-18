import { formatHms } from '../../../_shared';
import { hmOf, hoursAndMinutes, pillTime, shiftLabelOf } from '../../_shared/lib/nairobi-clock';
import type { MyDay, MyEntry } from '../../_shared/types/attendance-types';

/**
 * What the clock card says, worked out from the server's answer and the server-corrected time. Pure: the components only draw it.
 * The phase follows the server's state, with one step ahead of it: once the scheduled end has passed on a shift still running, the
 * prompt shows at once (the server confirms on the next poll), so the phone never waits up to 30 seconds to ask.
 */

export type ClockPhase = 'BEFORE' | 'OPEN' | 'NOT_IN' | 'ON' | 'HEADS_UP' | 'PROMPT' | 'STAYING' | 'DONE' | 'AUTO_CLOSED' | 'MISSED';

export function phaseOf(entry: MyEntry, nowMs: number): ClockPhase {
  switch (entry.state) {
    case 'UPCOMING':
      return 'BEFORE';
    case 'CLOCK_IN_OPEN':
      return 'OPEN';
    case 'NOT_IN':
      return 'NOT_IN';
    case 'ON_SHIFT':
      if (nowMs >= Date.parse(entry.endsAt)) return 'PROMPT';
      return nowMs >= Date.parse(entry.headsUpFrom) ? 'HEADS_UP' : 'ON';
    case 'PROMPT_DUE':
      return 'PROMPT';
    case 'STAYING_ON':
      return 'STAYING';
    case 'DONE':
      return 'DONE';
    case 'AUTO_CLOSED':
      return 'AUTO_CLOSED';
    case 'MISSED':
      return 'MISSED';
  }
}

export interface ClockCardModel {
  phase: ClockPhase;
  shiftLabel: string;
  statusLabel: string;
  statusTone: 'muted' | 'on' | 'warning';
  timer: string;
  caption: string;
  progress?: { percent: number; ticks: string[]; label: string };
  /** The button the person may press now. */
  action: 'CLOCK_IN' | 'CLOCK_OUT' | null;
  /** Clock-in is not open yet: the button shows but says why it waits. */
  clockInWaits: boolean;
}

const secondsBetween = (fromMs: number, toMs: number): number => Math.max(0, Math.floor((toMs - fromMs) / 1000));

/** Hour labels under the bar, every two hours from the start, and the end. "06 08 10 12 14". */
export function tickLabels(startTime: string, endTime: string): string[] {
  const start = Number(startTime.slice(0, 2));
  let end = Number(endTime.slice(0, 2));
  if (end <= start) end += 24;
  const labels: string[] = [];
  for (let h = start; h < end; h += 2) labels.push(String(h % 24).padStart(2, '0'));
  labels.push(String(end % 24).padStart(2, '0'));
  return labels;
}

export function clockCardModel(entry: MyEntry, day: MyDay, nowMs: number): ClockCardModel {
  const phase = phaseOf(entry, nowMs);
  const shiftLabel = shiftLabelOf(entry.templateName, entry.startTime, entry.endTime);
  const startMs = Date.parse(entry.startsAt);
  const endMs = Date.parse(entry.endsAt);
  const serverNowMs = Date.parse(day.serverNow);
  const onSeconds = entry.clockedInAt ? entry.secondsOnShift + secondsBetween(serverNowMs, nowMs) : 0;
  const minutesToEnd = Math.max(0, Math.ceil((endMs - nowMs) / 60000));
  const inAt = entry.clockedInAt ? hmOf(entry.clockedInAt) : '';
  const progress = {
    percent: ((nowMs - startMs) / (endMs - startMs)) * 100,
    ticks: tickLabels(entry.startTime, entry.endTime),
    label: 'How far through your shift',
  };

  switch (phase) {
    case 'BEFORE':
    case 'OPEN':
      return {
        phase,
        shiftLabel,
        statusLabel: 'NOT IN YET',
        statusTone: 'muted',
        timer: formatHms(secondsBetween(nowMs, startMs)),
        caption: `until your shift starts. Clock in opens at ${hmOf(entry.opensAt)}.`,
        action: 'CLOCK_IN',
        clockInWaits: phase === 'BEFORE',
      };
    case 'NOT_IN':
      return {
        phase,
        shiftLabel,
        statusLabel: 'NOT IN YET',
        statusTone: 'muted',
        timer: formatHms(secondsBetween(startMs, nowMs)),
        caption: `since your shift started at ${entry.startTime}. Clocking in now counts as late.`,
        action: 'CLOCK_IN',
        clockInWaits: false,
      };
    case 'ON':
      return {
        phase,
        shiftLabel,
        statusLabel: 'ON SHIFT',
        statusTone: 'on',
        timer: formatHms(onSeconds),
        caption: `In at ${inAt}${entry.countsAsLate ? `, ${entry.minutesLate} min late` : ', on time'}. Your shift ends in ${hoursAndMinutes(minutesToEnd)}.`,
        progress,
        action: 'CLOCK_OUT',
        clockInWaits: false,
      };
    case 'HEADS_UP':
      return {
        phase,
        shiftLabel,
        statusLabel: `ENDS IN ${minutesToEnd} MIN`,
        statusTone: 'warning',
        timer: formatHms(onSeconds),
        caption: `In at ${inAt}. Your shift ends at ${entry.endTime}.`,
        progress,
        action: 'CLOCK_OUT',
        clockInWaits: false,
      };
    case 'PROMPT':
    case 'STAYING':
      return {
        phase,
        shiftLabel,
        statusLabel: phase === 'STAYING' ? 'STAYING ON' : 'SHIFT ENDED',
        statusTone: 'warning',
        timer: formatHms(onSeconds),
        caption: phase === 'STAYING' ? `Past ${entry.endTime}. Your manager sees why you stayed.` : `Your shift ended at ${entry.endTime}.`,
        action: 'CLOCK_OUT',
        clockInWaits: false,
      };
    case 'DONE':
      return {
        phase,
        shiftLabel,
        statusLabel: 'DONE',
        statusTone: 'muted',
        timer: formatHms(entry.workedMinutes * 60),
        caption: `Clocked out at ${entry.clockedOutAt ? hmOf(entry.clockedOutAt) : '--:--'}. You worked ${hoursAndMinutes(entry.workedMinutes)}.`,
        action: null,
        clockInWaits: false,
      };
    case 'AUTO_CLOSED':
      return {
        phase,
        shiftLabel,
        statusLabel: `CLOSED AT ${entry.clockedOutAt ? hmOf(entry.clockedOutAt) : entry.endTime}`,
        statusTone: 'warning',
        timer: formatHms(entry.workedMinutes * 60),
        caption: 'Your phone closed this shift because the end-of-shift question was not answered.',
        action: null,
        clockInWaits: false,
      };
    case 'MISSED':
      return {
        phase,
        shiftLabel,
        statusLabel: 'MISSED',
        statusTone: 'muted',
        timer: formatHms(0),
        caption: 'Your shift is over and no clock-in was recorded. Ask your manager to put it right.',
        action: null,
        clockInWaits: false,
      };
  }
}

/** The shift pill in the phone's top bar: grey with the start time before the shift, green with hours on shift, amber near and after the end. */
export function shiftPillOf(day: MyDay, nowMs: number): { tone: 'grey' | 'green' | 'amber'; time: string; label: string } | null {
  const entry = day.current;
  if (!day.enabled || !entry) return null;
  const phase = phaseOf(entry, nowMs);
  const onSeconds = entry.clockedInAt ? entry.secondsOnShift + secondsBetween(Date.parse(day.serverNow), nowMs) : 0;
  switch (phase) {
    case 'BEFORE':
    case 'OPEN':
    case 'NOT_IN':
      return { tone: 'grey', time: entry.startTime, label: 'Shift starts at' };
    case 'ON':
      return { tone: 'green', time: pillTime(onSeconds), label: 'On shift for' };
    case 'HEADS_UP':
    case 'PROMPT':
    case 'STAYING':
      return { tone: 'amber', time: pillTime(onSeconds), label: 'On shift for' };
    default:
      return null;
  }
}
