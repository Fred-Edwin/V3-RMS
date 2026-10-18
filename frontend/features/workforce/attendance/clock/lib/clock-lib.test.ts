import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hmOf, instantAt, undoCount } from '../../_shared/lib/nairobi-clock';
import type { MyDay, MyEntry } from '../../_shared/types/attendance-types';
import { clockCardModel, phaseOf, shiftPillOf, tickLabels } from './clock-view';
import { dequeue, enqueue, loadQueue, readyToSend } from './offline-queue';
import { withWorked } from './week-worked';

const at = (hm: string): string => instantAt('2026-10-12', hm);
const ms = (hm: string): number => Date.parse(at(hm));

const entry = (over: Partial<MyEntry> = {}): MyEntry => ({
  entryId: 'e1',
  templateName: 'Morning',
  colour: 'BLUE',
  startTime: '06:00',
  endTime: '14:00',
  state: 'ON_SHIFT',
  opensAt: at('05:45'),
  startsAt: at('06:00'),
  endsAt: at('14:00'),
  headsUpFrom: at('13:50'),
  autoCloseAt: at('14:15'),
  clockedInAt: at('05:58'),
  clockedOutAt: null,
  closedBy: null,
  secondsOnShift: 0,
  workedMinutes: 0,
  minutesLate: 0,
  countsAsLate: false,
  undo: null,
  stayedOn: null,
  ...over,
});
const dayOf = (current: MyEntry, serverNow = at('10:10')): MyDay => ({
  enabled: true,
  serverNow,
  organizationName: 'Nyeri Town',
  current,
  today: [current],
  next: null,
  week: { first: '2026-10-12', last: '2026-10-18', plannedMinutes: 2400, workedMinutes: 240, days: [] },
  leftovers: [],
  notices: [],
});

describe('Nairobi clock times', () => {
  it('reads an instant as Nairobi shows it, whatever the phone zone', () => {
    expect(hmOf('2026-10-12T03:00:00Z')).toBe('06:00');
    expect(instantAt('2026-10-12', '06:00')).toBe('2026-10-12T06:00:00+03:00');
  });
  it('counts the undo window as minutes and seconds', () => {
    expect(undoCount(112)).toBe('1:52');
    expect(undoCount(0)).toBe('0:00');
  });
});

describe('the clock card phases', () => {
  it('follows the server state, and asks the prompt a step early once the end has passed', () => {
    expect(phaseOf(entry({ state: 'UPCOMING' }), ms('05:00'))).toBe('BEFORE');
    expect(phaseOf(entry({ state: 'CLOCK_IN_OPEN' }), ms('05:50'))).toBe('OPEN');
    expect(phaseOf(entry({ state: 'NOT_IN', clockedInAt: null }), ms('06:20'))).toBe('NOT_IN');
    expect(phaseOf(entry(), ms('10:00'))).toBe('ON');
    expect(phaseOf(entry(), ms('13:50'))).toBe('HEADS_UP');
    expect(phaseOf(entry(), ms('14:00'))).toBe('PROMPT');
    expect(phaseOf(entry({ state: 'STAYING_ON' }), ms('14:20'))).toBe('STAYING');
    expect(phaseOf(entry({ state: 'AUTO_CLOSED' }), ms('15:00'))).toBe('AUTO_CLOSED');
  });

  it('before the shift it counts down and says when clock-in opens', () => {
    const open = entry({ state: 'CLOCK_IN_OPEN', clockedInAt: null });
    const model = clockCardModel(open, dayOf(open, at('05:48')), ms('05:48'));
    expect(model).toMatchObject({ statusLabel: 'NOT IN YET', timer: '00:12:00', action: 'CLOCK_IN', clockInWaits: false });
    expect(model.caption).toBe('until your shift starts. Clock in opens at 05:45.');
  });

  it('on shift it counts up from the server clock, says on time or late, and offers clock out', () => {
    const on = entry({ secondsOnShift: 8 });
    const model = clockCardModel(on, dayOf(on, at('06:00')), ms('06:00') + 2000);
    expect(model).toMatchObject({ statusLabel: 'ON SHIFT', statusTone: 'on', timer: '00:00:10', action: 'CLOCK_OUT' });
    expect(model.caption).toBe('In at 05:58, on time. Your shift ends in 8 h 0 m.');
    const late = entry({ clockedInAt: at('06:22'), countsAsLate: true, minutesLate: 22 });
    expect(clockCardModel(late, dayOf(late), ms('10:00')).caption).toContain('In at 06:22, 22 min late.');
  });

  it('shows the amber heads-up ten minutes before the end', () => {
    const on = entry();
    expect(clockCardModel(on, dayOf(on, at('13:50')), ms('13:50'))).toMatchObject({ statusLabel: 'ENDS IN 10 MIN', statusTone: 'warning' });
  });

  it('the hour labels run every two hours from the start to the end', () => {
    expect(tickLabels('06:00', '14:00')).toEqual(['06', '08', '10', '12', '14']);
    expect(tickLabels('22:00', '06:00')).toEqual(['22', '00', '02', '04', '06']);
    expect(tickLabels('19:15', '19:50')).toEqual(['19:15', '19:50']);
  });

  it('the shift pill is grey before, green during, amber near the end, and absent when done', () => {
    expect(shiftPillOf(dayOf(entry({ state: 'UPCOMING', clockedInAt: null })), ms('05:00'))).toMatchObject({ tone: 'grey', time: '06:00' });
    expect(shiftPillOf(dayOf(entry({ secondsOnShift: 15120 }), at('10:10')), ms('10:10'))).toMatchObject({ tone: 'green', time: '4:12' });
    expect(shiftPillOf(dayOf(entry(), at('13:55')), ms('13:55'))?.tone).toBe('amber');
    expect(shiftPillOf(dayOf(entry({ state: 'DONE' })), ms('15:00'))).toBeNull();
    expect(shiftPillOf({ ...dayOf(entry()), enabled: false }, ms('10:00'))).toBeNull();
  });
});

describe('taps kept on the phone', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('keeps a tap once per id, with the time of the tap, and removes it when sent', () => {
    const tap = { kind: 'IN' as const, deviceAt: at('05:58'), body: { clientEventId: 'tap-1111-aaaa' } };
    expect(enqueue(tap)).toBe(true);
    expect(enqueue(tap)).toBe(true);
    expect(loadQueue()).toHaveLength(1);
    expect(readyToSend(tap, new Date('2026-10-12T04:30:00Z'))).toMatchObject({ clientEventId: 'tap-1111-aaaa', deviceAt: at('05:58'), sentAt: '2026-10-12T04:30:00.000Z' });
    dequeue('tap-1111-aaaa');
    expect(loadQueue()).toHaveLength(0);
  });

  it('survives a browser that refuses storage: nothing is kept and the caller is told', () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    };
    expect(loadQueue()).toEqual([]);
    expect(enqueue({ kind: 'OUT', deviceAt: at('14:00'), body: { clientEventId: 'tap-2222-bbbb' } })).toBe(false);
  });
});

describe('this week with hours worked', () => {
  const planned = {
    range: '12 TO 18 OCT',
    hours: '40 h',
    hoursOf: 'planned this week',
    bars: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => ({ letter, fraction: 0.8, state: 'planned' as const, today: i === 0, label: `Day ${i}, 8 hours planned` })),
  };
  it('draws a worked day green at the hours worked and reads hours so far against planned', () => {
    const day: MyDay = { ...dayOf(entry()), week: { first: '2026-10-12', last: '2026-10-18', plannedMinutes: 2400, workedMinutes: 485, days: planned.bars.map((_, i) => ({ date: `2026-10-${12 + i}`, plannedMinutes: 480, workedMinutes: i === 0 ? 485 : 0, state: 'WORKED' as const })) } };
    const week = withWorked(planned, day);
    expect(week.bars[0]).toMatchObject({ state: 'worked' });
    expect(week.bars[0]?.label).toContain('8 h 5 m worked');
    expect(week.bars[1]).toMatchObject({ state: 'planned' });
    expect(week).toMatchObject({ hours: '8 h 5 m', hoursOf: 'so far of 40 h 0 m planned' });
  });
  it('leaves the planned card alone for a branch still on the old clock', () => {
    expect(withWorked(planned, { ...dayOf(entry()), enabled: false })).toBe(planned);
  });
});
