import type { ChipSpec } from '../../_shared/lib/block2-words';
import { personComma } from '../../_shared/lib/block2-words';
import type { TrackerRow } from '../../_shared/components/block2-phone-parts';
import { dateTimeText, timeText } from '../../requisitions/lib/time';
import type { DispatchFile, DispatchStage, TrackerStep } from '../_shared/types/dispatch-contract';

const TITLES: Record<TrackerStep['key'], string> = {
  APPROVED: 'Approved',
  PACKED: 'Packed and signed',
  ON_THE_WAY: 'On the way',
  COUNTED: 'Counted at the branch',
  CLOSED: 'Closed',
};

const nairobiDay = (iso: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date(iso));

/** "3:05 pm" today, "Wed 7 Oct · 3:05 pm" on another day. */
export const whenText = (iso: string, now: Date = new Date()): string => (nairobiDay(iso) === nairobiDay(now.toISOString()) ? timeText(iso) : dateTimeText(iso));

const AMBER_STAGES: readonly DispatchStage[] = ['WAITING_FOR_BRANCH', 'GAP_HELD'];

/** The vertical tracker of the dispatch file (D22 "One tracker"): green tick done, ringed current, grey to come, red cross cancelled. */
export function dispatchTrackerRows(file: Pick<DispatchFile, 'tracker' | 'stage' | 'cancelled' | 'carrier'>, now: Date = new Date()): { rows: TrackerRow[]; tone: 'success' | 'warning'; heading: string } {
  const steps = file.tracker.map((step): TrackerRow => {
    let line: string | null = null;
    if (step.at) {
      const when = whenText(step.at, now);
      if (step.key === 'ON_THE_WAY') line = `${when} · ${(step.carrier ?? file.carrier).name}`;
      else line = step.by ? `${when} · ${personComma(step.by)}` : when;
    } else if (step.key === 'COUNTED') line = 'Waiting';
    return { key: step.key, title: TITLES[step.key], line, state: step.state };
  });
  if (file.cancelled) {
    const reached = steps.filter((s) => s.state === 'DONE').map((s): TrackerRow => ({ ...s, state: 'DONE' }));
    return {
      heading: 'Where it stopped',
      tone: 'success',
      rows: [...reached, { key: 'CANCELLED', title: 'Cancelled', line: `${whenText(file.cancelled.at, now)} · ${personComma(file.cancelled.by)}`, state: 'CANCELLED' }],
    };
  }
  return { heading: 'Where it is', tone: AMBER_STAGES.includes(file.stage) ? 'warning' : 'success', rows: steps };
}

/** The chip under the header of the Attendant's file (N1, N1b). A closed file with a finding says so. */
export function attendantFileChip(file: Pick<DispatchFile, 'stage' | 'items'>): ChipSpec {
  const hasGap = file.items.some((i) => i.discrepancy !== null);
  switch (file.stage) {
    case 'CANCELLED':
      return { text: 'Cancelled', tone: 'neutral' };
    case 'WAITING_FOR_BRANCH':
      return { text: 'Waiting for the branch', tone: 'warning', dot: true };
    case 'GAP_HELD':
      return { text: 'Gap found', tone: 'warning' };
    case 'CLOSED':
      return hasGap ? { text: 'Gap found · finding recorded', tone: 'warning' } : { text: 'Closed', tone: 'success' };
    case 'CONFIRMED':
      return { text: 'Counted', tone: 'success' };
    default:
      return { text: 'On the way', tone: 'info' };
  }
}

/** "packed short at the store" out of "Joseph M. recorded a finding on DSC-NYR-0007: packed short at the store". Null when there is none. */
export function recordedFinding(file: Pick<DispatchFile, 'activity'>): { text: string; actor: string; roleLabel: string; at: string } | null {
  const sorted = [...file.activity].sort((a, b) => b.at.localeCompare(a.at));
  const event = sorted.find((e) => e.type === 'FINDING_RECORDED');
  if (!event) return null;
  const after = event.sentence.split(': ').slice(1).join(': ').trim();
  return { text: after ? after.charAt(0).toUpperCase() + after.slice(1) : 'Finding recorded', actor: event.actor.name, roleLabel: event.actor.roleLabel, at: event.at };
}

/** The first discrepancy on the file, for the box under the items. */
export function firstDiscrepancy(file: Pick<DispatchFile, 'items'>): { id: string; reference: string; status: 'OPEN' | 'RECORDED' | 'REVERSED'; itemName: string; gapQty: string | null | undefined } | null {
  const item = file.items.find((i) => i.discrepancy !== null);
  if (!item?.discrepancy) return null;
  return { ...item.discrepancy, itemName: item.itemName, gapQty: item.gapQty };
}

/** The gap column: "0" for no gap, "-2" with its sign otherwise; "–" until the branch has counted. */
export const gapText = (gapQty: string | null | undefined): string | null => {
  if (gapQty === undefined || gapQty === null) return null;
  const n = Number(gapQty);
  if (!Number.isFinite(n) || n === 0) return '0';
  return n > 0 ? `+${Number(n.toFixed(3))}` : String(Number(n.toFixed(3)));
};
