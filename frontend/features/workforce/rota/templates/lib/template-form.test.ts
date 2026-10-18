import { describe, expect, it } from 'vitest';

import { MORNING } from '../../_shared/lib/rota-fixture';
import { EMPTY_FORM, canSave, formOf, paidMinutesOf, suggestLetter, timesChanged, toCreateBody, toUpdateBody, validateTemplate } from './template-form';

const form = { ...EMPTY_FORM, name: 'Early bake', start: '04:00', end: '12:00', breakMinutes: 30 };

describe('Shift template form', () => {
  it('works out paid hours as the dialog shows them', () => {
    expect(paidMinutesOf(form)).toBe(450);
    expect(paidMinutesOf({ ...form, end: '' })).toBeNull();
    expect(paidMinutesOf({ ...form, breakMinutes: 600 })).toBeNull();
  });
  it('refuses an overnight shift and a missing name', () => {
    expect(validateTemplate({ ...form, end: '03:00' }).end).toMatch(/no overnight/);
    expect(validateTemplate({ ...form, name: ' ' }).name).toMatch(/name/);
    expect(canSave(form)).toBe(true);
    expect(canSave({ ...form, end: '04:00' })).toBe(false);
  });
  it('suggests the first free letter in the name', () => {
    expect(suggestLetter('Early bake', new Set(['M', 'A']))).toBe('E');
    expect(suggestLetter('Afternoon', new Set(['A']))).toBe('F');
    expect(suggestLetter('Mid-day', new Set(['m', 'i', 'd', 'a', 'y']))).toBeUndefined();
  });
  it('builds a create body for this site or the whole company', () => {
    expect(toCreateBody(form, 's1', 'E')).toMatchObject({ siteId: 's1', letter: 'E', colour: 'BLUE', startTime: '04:00', unpaidBreakMinutes: 30 });
    expect(toCreateBody({ ...form, scope: 'company' }, 's1', undefined).siteId).toBeNull();
  });
  it('sends only what changed on an edit, and says when times moved', () => {
    const same = formOf(MORNING);
    expect(toUpdateBody(MORNING, same)).toEqual({});
    expect(toUpdateBody(MORNING, { ...same, name: 'Opening' })).toEqual({ name: 'Opening' });
    expect(timesChanged(MORNING, same)).toBe(false);
    expect(timesChanged(MORNING, { ...same, start: '07:00' })).toBe(true);
    expect(toUpdateBody(MORNING, { ...same, start: '07:00' }, 'Cover for a gap')).toEqual({ startTime: '07:00', reason: 'Cover for a gap' });
  });
});
