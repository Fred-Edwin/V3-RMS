import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { instantAt } from '../../_shared/lib/nairobi-clock';
import type { MyEntry } from '../../_shared/types/attendance-types';
import { attendanceAskOf } from '../../switch/hooks/use-attendance-on';
import { switchLines } from '../../switch/lib/switch-copy';
import { leftoverWords } from '../lib/clock-copy';
import { HeadsUpNote, UndoNote, WaitingToSend } from './clock-notes';
import { LeavingEarlyPrompt } from './leaving-early-prompt';
import { ShiftEndPrompt } from './shift-end-prompt';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;
const at = (hm: string): string => instantAt('2026-10-12', hm);

const entry: MyEntry = {
  entryId: 'e1',
  templateName: 'Morning',
  colour: 'BLUE',
  startTime: '06:00',
  endTime: '14:00',
  state: 'PROMPT_DUE',
  opensAt: at('05:45'),
  startsAt: at('06:00'),
  endsAt: at('14:00'),
  headsUpFrom: at('13:50'),
  autoCloseAt: at('14:15'),
  clockedInAt: at('05:58'),
  clockedOutAt: null,
  closedBy: null,
  secondsOnShift: 28800,
  workedMinutes: 480,
  minutesLate: 0,
  countsAsLate: false,
  undo: { kind: 'IN', until: at('06:02') },
  stayedOn: null,
};

describe('the shift-end prompt', () => {
  const props = { entry, firstName: 'Amina', workedMinutes: 480, autoCloseMinutes: 15, busy: false, error: null, onFinish: noop, onStayOn: noop };
  it('asks to finish or stay on, and says what happens when nobody answers', () => {
    const out = html(h(ShiftEndPrompt, { ...props, leftovers: [] }));
    expect(out).toContain('14:00 · SHIFT END');
    expect(out).toContain('Your shift has ended, Amina');
    expect(out).toContain('You worked 8 h 0 m today');
    expect(out).toContain('Finish now');
    expect(out).toContain('Stay on');
    expect(out).toContain('If you do not answer in 15 minutes');
    expect(out).toContain('role="dialog"');
  });
  it('shows what is left in the person’s own job, and a hand-over for a waiter, without hiding Finish now', () => {
    const out = html(h(ShiftEndPrompt, { ...props, leftovers: [{ kind: 'OPEN_TABLES', items: [{ orderId: 'o1', orderNumber: 4, table: '4', unpaid: 2350 }] }] }));
    expect(out).toContain('1 open table is yours');
    expect(out).toContain('Hand over tables');
    expect(out).toContain('Finish now anyway');
  });
  it('words for each job’s leftovers', () => {
    expect(leftoverWords({ kind: 'OPEN_TICKETS', items: [{ ticketId: 't', station: 'BARISTA', status: 'PENDING' }, { ticketId: 'u', station: 'BARISTA', status: 'PENDING' }] }).title).toBe('2 tickets still open');
    expect(leftoverWords({ kind: 'PENDING_DISPATCHES', items: [{ dispatchId: 'd', reference: null, toSiteName: 'Nyeri Highway' }] }).detail).toContain('Nyeri Highway is waiting for it');
  });
});

describe('leaving early', () => {
  it('asks why with the four reasons, and keeps Clock out off until one is chosen', () => {
    const out = html(h(LeavingEarlyPrompt, { entry: { ...entry, state: 'ON_SHIFT' }, nowMs: Date.parse(at('11:20')), busy: false, error: null, onClockOut: noop, onBack: noop }));
    expect(out).toContain('Leaving early?');
    expect(out).toContain('2 H 40 MIN BEFORE YOUR SHIFT ENDS');
    for (const reason of ['Sent home by my manager', 'Unwell', 'Emergency', 'Other']) expect(out).toContain(reason);
    expect(out).toMatch(/disabled=""[^>]*>Clock out|<button[^>]*disabled[^>]*>Clock out/);
    expect(out).toContain('Back to work');
  });
});

describe('the notes around the clock card', () => {
  it('shows the Undo with its window while it is open, and nothing once it is over', () => {
    const open = html(h(UndoNote, { entry, nowMs: Date.parse(at('06:00')) + 8000, busy: false, onUndo: noop }));
    expect(open).toContain('Clocked in at 05:58');
    expect(open).toContain('Undo · 1:52');
    expect(html(h(UndoNote, { entry, nowMs: Date.parse(at('06:05')), busy: false, onUndo: noop }))).toBe('');
  });
  it('the heads-up says when the prompt will come', () => {
    expect(html(h(HeadsUpNote, { entry, minutes: 10 }))).toContain('In 10 minutes your phone will ask you to finish or stay on');
  });
  it('a tap kept on the phone shows as waiting with its time, and a phone that could not keep it says so', () => {
    const queued = [{ kind: 'IN' as const, deviceAt: at('05:58'), body: { clientEventId: 'tap-1111-aaaa' } }];
    const out = html(h(WaitingToSend, { queued, site: 'Nyeri Town', notSaved: false }));
    expect(out).toContain('Saved on this phone: clocked in 05:58');
    expect(out).toContain('Waiting to send · 1');
    expect(html(h(WaitingToSend, { queued: [], site: 'Nyeri Town', notSaved: false }))).toBe('');
    expect(html(h(WaitingToSend, { queued: [], site: 'Nyeri Town', notSaved: true }))).toContain('could not keep your tap');
  });
});

describe('the switch', () => {
  it('says the old clock stops answering when it goes on, and answers again when it goes off', () => {
    const off = { organizationId: 'o', organizationName: 'Nyeri Town', enabled: false, enabledAt: null, changedAt: null };
    expect(switchLines(off).join(' ')).toContain('old clock stops answering');
    expect(switchLines(off).join(' ')).toContain('cannot switch on while someone is clocked in');
    expect(switchLines({ ...off, enabled: true }).join(' ')).toContain('old clock works again at once');
  });
  it('the menu asks for the right thing by role: own day for floor staff and heads, the branch list for the board roles, nothing else', () => {
    expect(attendanceAskOf('WAITER', false)).toBe('own');
    expect(attendanceAskOf('STORE_ATTENDANT', false)).toBe('own');
    expect(attendanceAskOf('MANAGER', false)).toBe('branches');
    expect(attendanceAskOf('DIRECTOR', false)).toBe('branches');
    expect(attendanceAskOf('KITCHEN_DISPLAY', false)).toBe('none');
    expect(attendanceAskOf(null, false)).toBe('none');
  });
});
