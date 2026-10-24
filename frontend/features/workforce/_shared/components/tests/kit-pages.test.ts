import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { nextInGroup } from '../../lib/data/roving';
import { Callout } from '../messages/callout';
import { ActionCards, AddChip, ChoiceChips, OptionList, RadioCards, RemovableChip } from '../fields/choice-controls';
import { FormField, TimeField } from '../fields/form-parts';
import { PageHeader, PeriodStepper, SegmentedControl, UnderlineTabs } from '../layout/page-parts';
import { ChecklistRows, NoteRows, Panel, SettingRows, StatBoxes } from '../layout/panel-parts';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;

describe('arrow keys in a group', () => {
  const values = ['a', 'b', 'c'];
  it('moves forward and back, wrapping', () => {
    expect(nextInGroup('ArrowRight', values, 'a')).toBe('b');
    expect(nextInGroup('ArrowRight', values, 'c')).toBe('a');
    expect(nextInGroup('ArrowLeft', values, 'a')).toBe('c');
    expect(nextInGroup('Home', values, 'c')).toBe('a');
    expect(nextInGroup('End', values, 'a')).toBe('c');
  });
  it('skips disabled items and ignores other keys', () => {
    expect(nextInGroup('ArrowRight', values, 'a', new Set(['b']))).toBe('c');
    expect(nextInGroup('x', values, 'a')).toBeNull();
  });
});

describe('page parts', () => {
  it('draws a 24 px title, or 28 px on Rules, with actions at the right', () => {
    expect(html(h(PageHeader, { title: 'Rota', subtitle: 'Sub' }))).toContain('text-[24px]');
    const lg = html(h(PageHeader, { title: 'Rules', size: 'lg', actions: h('button', null, 'Go') }));
    expect(lg).toContain('text-[28px]');
    expect(lg).toContain('Go');
  });
  it('gives the stepper named arrows', () => {
    const out = html(h(PeriodStepper, { label: 'Mon 12 to Sun 18 October 2026', onPrevious: noop, onNext: noop }));
    expect(out).toContain('aria-label="Previous period"');
    expect(out).toContain('aria-label="Next period"');
  });
  it('marks one tab selected with a 2 px underline and keeps the rest out of the tab order', () => {
    const out = html(h(UnderlineTabs, { label: 'Groups', items: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], value: 'a', onChange: noop }));
    expect(out).toContain('role="tablist"');
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out.match(/tabindex="-1"/g)).toHaveLength(1);
    expect(out).toContain('border-b-2');
  });
  it('fills only the chosen segment with ink', () => {
    const out = html(h(SegmentedControl, { label: 'View', items: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], value: 'b', onChange: noop }));
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out.match(/bg-wds-text-ink/g)).toHaveLength(1);
  });
});

describe('Callout', () => {
  it('tints by tone', () => {
    expect(html(h(Callout, { tone: 'error', title: 'Not in yet' }))).toContain('bg-wds-error-bg');
    expect(html(h(Callout, { tone: 'warning', title: 'W' }))).toContain('border-wds-warning-border');
  });
  it('draws a 4 px bar, or a dashed box', () => {
    expect(html(h(Callout, { variant: 'bar', tone: 'success', title: 'T' }))).toContain('border-l-4');
    expect(html(h(Callout, { variant: 'dashed', kicker: 'K' }))).toContain('border-dashed');
  });
  it('puts the action at the end when asked', () => {
    const out = html(h(Callout, { variant: 'bar', title: 'T', actionAt: 'end', action: h('button', null, 'Undo') }));
    expect(out).toContain('justify-between');
    expect(out).toContain('Undo');
  });
  it('shows the square bullet only when asked', () => {
    expect(html(h(Callout, { bullet: true, children: 'x' }))).toContain('bg-wds-primary');
    expect(html(h(Callout, { children: 'x' }))).not.toContain('bg-wds-primary');
  });
});

describe('panels and rows', () => {
  it('shows a count badge and a caption in the panel header', () => {
    const out = html(h(Panel, { title: 'Needs a look', count: 5, caption: 'UPDATED', children: 'body' }));
    expect(out).toContain('Needs a look');
    expect(out).toContain('>5<');
    expect(out).toContain('UPDATED');
  });
  it('writes setting rows with a mono value', () => {
    const out = html(h(SettingRows, { rows: [{ title: 'Grace', description: 'd', value: '5 min', mono: true }] }));
    expect(out).toContain('font-wds-mono');
    expect(out).toContain('Grace');
  });
  it('tones a stat cell', () => {
    const out = html(h(StatBoxes, { variant: 'times', cells: [{ label: 'EXTRA', value: '1 h 30', tone: 'warning' }, { label: 'AFTER', value: 'x', tone: 'success' }] }));
    expect(out).toContain('bg-wds-warning-bg');
    expect(out).toContain('bg-wds-success-bg');
  });
  it('compact boxes tone the number but do not fill the cell', () => {
    const out = html(h(StatBoxes, { cells: [{ label: 'Left out, need you', value: '2', tone: 'warning' }] }));
    expect(out).toContain('text-wds-warning-fg');
    expect(out).not.toContain('bg-wds-warning-bg');
  });
  it('names the state of a checklist row for a screen reader', () => {
    const out = html(h(ChecklistRows, { rows: [{ title: 'T', state: 'problem' }] }));
    expect(out).toContain('Problem: ');
  });
  it('writes a note row with a marker and a right note', () => {
    const out = html(h(NoteRows, { rows: [{ text: 'Mark', note: 'On leave', marker: 'warning' }] }));
    expect(out).toContain('On leave');
    expect(out).toContain('bg-wds-caramel-600');
  });
});

describe('choice controls', () => {
  const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
  it('chips are radios, the chosen one filled ink, with an optional hint', () => {
    const out = html(h(ChoiceChips, { legend: 'Break', hint: 'optional', options, value: 'a', onChange: noop }));
    expect(out.match(/type="radio"/g)).toHaveLength(2);
    expect(out.match(/checked=""/g)).toHaveLength(1);
    expect(out).toContain('optional');
  });
  it('the option list can show a tick on the chosen option', () => {
    expect(html(h(OptionList, { legend: 'Why', options, value: 'a', onChange: noop, tick: true }))).toContain('✓');
    expect(html(h(OptionList, { legend: 'Why', options, value: 'a', onChange: noop }))).not.toContain('✓');
  });
  it('radio cards use the warm fill and espresso border when chosen', () => {
    const out = html(h(RadioCards, { legend: 'Who', options: [{ value: 'a', title: 'A', description: 'd' }, { value: 'b', title: 'B' }], value: 'a', onChange: noop }));
    expect(out).toContain('border-wds-primary');
    expect(out).toContain('border-[5px]');
  });
  it('action cards: one brown, and a disabled card shows its reason', () => {
    const out = html(
      h(ActionCards, {
        label: 'Do',
        items: [
          { key: 'a', title: 'A', primary: true, onSelect: noop },
          { key: 'b', title: 'B', disabled: true, disabledReason: 'Already done.', onSelect: noop },
        ],
      })
    );
    expect(out.match(/bg-wds-primary /g)).toHaveLength(1);
    expect(out).toContain('Already done.');
  });
  it('chips with a remove button and a dashed add chip', () => {
    expect(html(h(RemovableChip, { label: 'Pastry', onRemove: noop }))).toContain('aria-label="Remove Pastry"');
    expect(html(h(AddChip, { onClick: noop, children: '+ Department' }))).toContain('border-dashed');
  });
});

describe('form parts', () => {
  it('links the label, the control and the helper', () => {
    const out = html(h(FormField, { label: 'Name', helper: 'Shown on the rota', children: ({ id, describedBy }) => h('input', { id, 'aria-describedby': describedBy, autoComplete: 'off' }) }));
    const id = /for="([^"]+)"/.exec(out)?.[1];
    expect(id).toBeTruthy();
    expect(out).toContain(`id="${id}"`);
    expect(out).toContain(`aria-describedby="${id}-note"`);
  });
  it('an error replaces the helper and is announced', () => {
    const out = html(h(FormField, { label: 'Name', helper: 'h', error: 'Give it a name.', children: ({ id }) => h('input', { id, autoComplete: 'off' }) }));
    expect(out).toContain('role="alert"');
    expect(out).toContain('Give it a name.');
    expect(out).not.toContain('>h<');
  });
  it('the time field is a mono box that never asks the phone for a numeric keyboard', () => {
    const out = html(h(TimeField, { label: 'Starts', value: '04:00', onChange: noop }));
    expect(out).not.toContain('inputMode="numeric"');
    expect(out).toContain('font-wds-mono');
    expect(out).toContain('value="04:00"');
  });
});
