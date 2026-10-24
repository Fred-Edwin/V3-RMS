import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClockCard, DayCard, DayStrip, PhoneButton, PhoneDarkHeader, PhoneHero, PhonePrompt, TimeRow, TimerChip, WeekBars } from '../phone/phone-parts';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;

describe('PhoneDarkHeader', () => {
  it('shows a back button only when there is somewhere to go back to', () => {
    expect(html(h(PhoneDarkHeader, { kicker: 'MY TIME · ROTA' }))).not.toContain('<button');
    const out = html(h(PhoneDarkHeader, { kicker: 'MY TIME · ROTA', onBack: noop, title: '12 to 18 October' }));
    expect(out).toContain('aria-label="Back"');
    expect(out).toContain('12 to 18 October');
  });
  it('can draw a big mono figure', () => {
    const out = html(h(PhoneDarkHeader, { kicker: 'K', figure: '38 h 10' }));
    expect(out).toContain('text-[34px]');
    expect(out).toContain('font-wds-mono');
  });
});

describe('TimerChip', () => {
  it('has grey, green and amber paints and a spoken label', () => {
    expect(html(h(TimerChip, { tone: 'green', time: '4:12', label: 'On shift for' }))).toContain('bg-wds-success-fg');
    expect(html(h(TimerChip, { tone: 'amber', time: '0:30' }))).toContain('bg-wds-warning-fg');
    const grey = html(h(TimerChip, { tone: 'grey', time: '06:00', label: 'Shift starts at' }));
    expect(grey).toContain('Shift starts at');
    expect(grey).toContain('06:00');
  });
});

describe('PhoneHero', () => {
  it('shows initials, the greeting and the line under it', () => {
    const out = html(h(PhoneHero, { name: 'Amina Hassan', greeting: 'Good morning, Amina', subtitle: 'Monday 12 October · Nyeri Town' }));
    expect(out).toContain('AH');
    expect(out).toContain('Good morning, Amina');
    expect(out).toContain('Monday 12 October');
  });
});

describe('ClockCard', () => {
  it('draws the 52 px timer and the actions it is given, no more', () => {
    const out = html(h(ClockCard, { shiftLabel: 'MORNING · 06:00 TO 14:00', statusLabel: 'NOT IN YET', timer: '00:12:00', caption: 'until your shift starts.', actions: h(PhoneButton, null, 'Clock in') }));
    expect(out).toContain('text-[52px]');
    expect(out).toContain('00:12:00');
    expect(out.match(/<button/g)).toHaveLength(1);
  });
  it('draws a progress bar with the now marker at the percent, clamped', () => {
    const out = html(h(ClockCard, { shiftLabel: 'S', statusLabel: 'ON SHIFT', statusTone: 'on', timer: '04:12:20', caption: 'c', progress: { percent: 140, ticks: ['06', '14'], label: 'Shift progress' } }));
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-valuenow="100"');
    expect(out).toContain('left:100%');
  });
});

describe('WeekBars', () => {
  const bars = [
    { letter: 'M', fraction: 1, state: 'planned' as const, today: true, label: 'Monday, 8 hours planned' },
    { letter: 'S', fraction: 0, state: 'off' as const, label: 'Saturday, day off' },
  ];
  it('draws a 40 px bar, or the 2 px line of a day off, and marks today', () => {
    const out = html(h(WeekBars, { title: 'This week', range: '12 TO 18 OCT', bars, caption: '40 h planned' }));
    expect(out).toContain('height:40px');
    expect(out).toContain('height:2px');
    expect(out).toContain('text-wds-selected-edge');
    expect(out).toContain('aria-label="Saturday, day off"');
  });
});

describe('DayStrip', () => {
  it('fills only the chosen day', () => {
    const out = html(h(DayStrip, { label: 'Day', value: 'b', onChange: noop, days: [{ value: 'a', dow: 'MON', day: '12' }, { value: 'b', dow: 'TUE', day: '13' }] }));
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out.match(/bg-wds-text-ink/g)).toHaveLength(1);
    expect(out).toContain('min-h-[44px]');
  });
});

describe('PhonePrompt and PhoneButton', () => {
  it('puts the buttons in a stack at the bottom', () => {
    const out = html(h(PhonePrompt, { kicker: 'STAYING ON', title: 'Why are you staying?', body: 'One tap.', actions: h(PhoneButton, { size: 'lg' }, 'Stay on') }));
    expect(out).toContain('text-[30px]');
    expect(out).toContain('mt-auto');
    expect(out).toContain('h-14');
  });
  it('heights are 46, 52 and 56', () => {
    expect(html(h(PhoneButton, { size: 'sm' }, 'x'))).toContain('h-[46px]');
    expect(html(h(PhoneButton, { size: 'md' }, 'x'))).toContain('h-[52px]');
    expect(html(h(PhoneButton, { size: 'lg' }, 'x'))).toContain('h-14');
  });
});

describe('DayCard', () => {
  it('marks today, a changed shift and a day off', () => {
    expect(html(h(DayCard, { day: 'Mon 12', today: true, shift: { tone: 'morning', label: 'Morning 06:00 to 14:00' } }))).toContain('TODAY');
    const changed = html(h(DayCard, { day: 'Thu 15', shift: { tone: 'afternoon', label: 'Afternoon 14:00 to 22:00' }, changedNote: 'Changed from Morning' }));
    expect(changed).toContain('bg-wds-warning-bg');
    expect(changed).toContain('Changed from Morning');
    const off = html(h(DayCard, { day: 'Sat 17', dayOff: true }));
    expect(off).toContain('Day off');
    expect(off).toContain('bg-wds-neutral-100');
  });
});

describe('TimeRow', () => {
  it('ok shows a green tick and hours', () => {
    const out = html(h(TimeRow, { day: 'Mon 5', range: '05:58 → 14:01', hours: '8 h 03' }));
    expect(out).toContain('✓ ');
    expect(out).toContain('text-wds-success-fg');
  });
  it('problem shows the red bar, the note and the report button only when given', () => {
    const withBtn = html(h(TimeRow, { day: 'Fri 9', range: 'r', hours: '5 h 22', state: 'problem', note: 'Clocked out early. Is this wrong?', report: { label: 'Report a problem', onClick: noop } }));
    expect(withBtn).toContain('border-l-wds-error-fg');
    expect(withBtn).toContain('Report a problem');
    const without = html(h(TimeRow, { day: 'Fri 9', range: 'r', hours: '5 h 22', state: 'problem', note: 'Clocked out early. Is this wrong?' }));
    expect(without).not.toContain('<button');
  });
});
