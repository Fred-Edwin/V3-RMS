import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SHIFT_PAINT, SHIFT_TONES, shiftCellLabel, shiftLongLabel } from '../lib/shift-palette';
import { PickShiftButton, ShiftChip, ShiftGrid, ShiftLegend, ShiftSwatchPicker, TwoLineRow } from './schedule-parts';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;

describe('shift palette', () => {
  it('has the five colours, each with words', () => {
    expect(SHIFT_TONES).toHaveLength(5);
    for (const t of SHIFT_TONES) expect(SHIFT_PAINT[t].label.length).toBeGreaterThan(0);
  });
  it('writes cell and long labels', () => {
    expect(shiftCellLabel('06:00', '14:00')).toBe('06–14');
    expect(shiftCellLabel('4:00', '12:00')).toBe('04–12');
    expect(shiftLongLabel('Morning', '06:00', '14:00')).toBe('Morning 06:00 to 14:00');
  });
  it('uses tokens, never a hex', () => {
    for (const t of SHIFT_TONES) expect(SHIFT_PAINT[t].chip).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('ShiftChip', () => {
  it('is plain text without onSelect and a button with it', () => {
    expect(html(h(ShiftChip, { tone: 'morning', label: '06–14' }))).not.toContain('<button');
    expect(html(h(ShiftChip, { tone: 'morning', label: '06–14', onSelect: noop }))).toContain('<button');
  });
  it('is 74 px wide in a cell and auto width when long', () => {
    expect(html(h(ShiftChip, { tone: 'morning', label: '06–14' }))).toContain('w-[74px]');
    expect(html(h(ShiftChip, { tone: 'morning', label: 'Morning 06:00 to 14:00', long: true }))).not.toContain('w-[74px]');
  });
  it('draws the ring, the amber border and the changed-from note', () => {
    expect(html(h(ShiftChip, { tone: 'afternoon', label: 'x', chosen: true }))).toContain('border-wds-primary');
    expect(html(h(ShiftChip, { tone: 'afternoon', label: 'x', flagged: true }))).toContain('border-wds-caramel-600');
    expect(html(h(ShiftChip, { tone: 'morning', label: 'x', changedFrom: 'Afternoon' }))).toContain('Changed from Afternoon');
  });
  it('leave is set in sans, shifts in mono', () => {
    expect(html(h(ShiftChip, { tone: 'leave', label: 'Leave' }))).toContain('font-wds-sans');
    expect(html(h(ShiftChip, { tone: 'morning', label: '06–14' }))).toContain('font-wds-mono');
  });
});

describe('other schedule pieces', () => {
  it('draws the dashed pick-shift cell at 84 by 32', () => {
    const out = html(h(PickShiftButton, { onClick: noop }));
    expect(out).toContain('border-dashed');
    expect(out).toContain('w-[84px]');
    expect(out).toContain('Pick shift');
  });
  it('lists the colours in the legend', () => {
    const out = html(h(ShiftLegend, { items: [{ tone: 'morning' }, { tone: 'leave' }] }));
    expect(out).toContain('Morning');
    expect(out).toContain('Leave');
  });
  it('marks one swatch checked and names each one', () => {
    const out = html(h(ShiftSwatchPicker, { value: 'earlyBake', onChange: noop }));
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out).toContain('aria-label="Early bake"');
    expect(out).toContain('role="radiogroup"');
  });
});

describe('ShiftGrid', () => {
  const rows = [
    { id: '1', name: 'Victor Maina', sub: 'Head', cells: [{ tone: 'morning' as const, label: '06–14' }, null], hours: '40' },
    { id: '2', name: 'Joy Chebet', sub: 'Also at Highway Sat', subTone: 'warning' as const, cells: [null, { tone: 'afternoon' as const, label: '14–22', flagged: true }], hours: '40' },
  ];
  const out = html(h(ShiftGrid, { label: 'Rota', days: ['MON 12', 'TUE 13'], rows, footer: { label: 'ON, NEEDS 4', cells: [{ text: '4' }, { text: '3 thin', tone: 'warning' }] } }));
  it('is a table with named columns and a row header per person', () => {
    expect(out).toContain('aria-label="Rota"');
    expect(out).toContain('scope="col"');
    expect(out).toContain('scope="row"');
    expect(out).toContain('MON 12');
  });
  it('draws a day off as a dash and gives every cell a spoken name', () => {
    expect(out).toContain('—');
    expect(out).toContain('Victor Maina, MON 12, 06–14');
    expect(out).toContain('Victor Maina, TUE 13, no shift');
  });
  it('shows the amber note and the thin footer', () => {
    expect(out).toContain('text-wds-warning-fg');
    expect(out).toContain('3 thin');
    expect(out).toContain('ON, NEEDS 4');
  });
  it('sets the width from the number of days (150 + 84 each + 56)', () => {
    expect(out).toContain('width:374px');
  });
});

describe('TwoLineRow', () => {
  it('is plain text without onSelect, a button with it, with the caramel bar when chosen', () => {
    expect(html(h(TwoLineRow, { title: 'Service', sub: '10 people' }))).not.toContain('<button');
    const chosen = html(h(TwoLineRow, { title: 'Barista', sub: '7 people', onSelect: noop, selected: true }));
    expect(chosen).toContain('<button');
    expect(chosen).toContain('border-l-wds-caramel-600');
    expect(chosen).toContain('aria-current="true"');
  });
  it('colours the status word', () => {
    expect(html(h(TwoLineRow, { title: 'a', status: 'Complete', statusTone: 'success' }))).toContain('text-wds-success-fg');
  });
});
