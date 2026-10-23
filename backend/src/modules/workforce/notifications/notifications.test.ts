import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/queues', () => ({ notificationQueue: { add: vi.fn() } }));
vi.mock('../../../config/firebase', () => ({ firebaseMessaging: null }));
vi.mock('../../../config/database', () => ({ prisma: {} }));
vi.mock('../../../repositories/auth-repository', () => ({ authRepository: {} }));
vi.mock('../../../sockets/socket', () => ({ getSocketServer: vi.fn(() => { throw new Error('no socket'); }), userRoomName: (id: string) => `user:${id}` }));

import { createNotifier, type NotifierDeps } from './notification-service';
import { renderNotification, knownKinds, isKnownKind } from './wording/notification-wording';
import { dayLabel } from './wording/notification-format';
import { inQuietHours, nextQuietHoursEnd, isHeldInQuietHours } from './quiet-hours';

const FIGURE = /(\d[\d,.]*\s*(kes|ksh|shillings?))|((kes|ksh)\.?\s*\d)/i;

// 2026-10-20 Nairobi times as UTC instants (Nairobi is UTC+3)
const at = (hhmmNairobi: string, day = '2026-10-20'): Date => new Date(`${day}T${hhmmNairobi}:00+03:00`);

describe('quiet hours', () => {
  it('is 22:00 to 05:00 Nairobi', () => {
    expect(inQuietHours(at('21:59'))).toBe(false);
    expect(inQuietHours(at('22:00'))).toBe(true);
    expect(inQuietHours(at('02:30'))).toBe(true);
    expect(inQuietHours(at('04:59'))).toBe(true);
    expect(inQuietHours(at('05:00'))).toBe(false);
  });

  it('holds until the next 05:00', () => {
    expect(nextQuietHoursEnd(at('23:10')).toISOString()).toBe(at('05:00', '2026-10-21').toISOString());
    expect(nextQuietHoursEnd(at('02:00')).toISOString()).toBe(at('05:00').toISOString());
  });

  it('holds only plain information', () => {
    const night = at('23:00');
    expect(isHeldInQuietHours('information', night)).toBe(true);
    for (const tone of ['changed', 'needsLook', 'done', 'problem'] as const) expect(isHeldInQuietHours(tone, night)).toBe(false);
  });
});

describe('wording', () => {
  it('renders every known kind with no pay figure, even when handed hostile data', () => {
    const hostile = { name: 'Joy Chebet', role: 'WAITER', month: '2026-09', site: 'Nyeri Town', date: '2026-10-19', at: '2026-10-19T11:05:00Z', device: 'Tecno, Android', place: 'Nairobi', count: 12, version: 2, months: 2, outcome: 'APPROVED', kind: 'CLOCK_OUT', net: 'KES 91,000', text: 'Clock fix', days: 4, seq: 7 };
    for (const kind of knownKinds()) {
      const r = renderNotification(kind, hostile);
      expect(`${r.title} ${r.body}`).not.toMatch(FIGURE);
      expect(r.title.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the plain row when a figure slips into the words', () => {
    const r = renderNotification('needs_you.overdue_reminder', { text: 'Pay of KES 91,000', days: 3 });
    expect(r.title).toBe('Something changed');
    expect(r.body).not.toMatch(FIGURE);
  });

  it('an unknown kind is a quiet plain row', () => {
    expect(renderNotification('made.up', {})).toMatchObject({ title: 'Something changed', push: false });
  });

  it('words the security rows the way the spec does, with a role next to every name', () => {
    const d = { name: 'Joy Chebet', role: 'WAITER', month: '2026-09', device: 'Tecno, Android', place: 'Nairobi', at: '2026-10-19T11:05:00Z' };
    expect(renderNotification('payslip.on_unconfirmed_phone_admin', d).body).toContain("Joy Chebet, Waiter's September 2026 payslip was opened on a phone that is not confirmed");
    expect(renderNotification('payslip.three_wrong_codes_admin', d).body).toContain("3 wrong codes on Joy Chebet, Waiter's payslips");
    expect(renderNotification('payslip.on_unconfirmed_phone', d)).toMatchObject({ tone: 'problem', push: true });
    expect(renderNotification('payslip.three_wrong_codes', d).body).toContain('Nothing is locked');
    expect(renderNotification('security.wasnt_me_admin', d).body).toContain('Every session was signed out');
  });

  it('never shows a conduct reason or a code in the shared rows', () => {
    const r = renderNotification('payslip.on_unconfirmed_phone', { month: '2026-09', device: 'x', place: 'y', at: null, code: '1234', reason: 'late' });
    expect(`${r.title} ${r.body}`).not.toMatch(/1234|late/);
  });

  it('names the person and the action in a People or Pay notice, never an amount, and points a staff notice at My file', () => {
    const d = { name: 'Grace Wanjiku', amount: 48000 };
    for (const kind of ['pay.change_requested', 'pay.changed_by_director', 'pay.bank_changed', 'pay.change_decided', 'employee.exit_recorded', 'employee.hired']) {
      const r = renderNotification(kind, d);
      expect(`${r.title} ${r.body}`, kind).toContain('Grace Wanjiku');
      expect(`${r.title} ${r.body}`, kind).not.toMatch(/48000|48,000/);
    }
    expect(renderNotification('employee.hired', d).href).toBe('/app/workforce/team');
    expect(renderNotification('file_request.asked', {}).href).toBe('/app/workforce/my-file');
    expect(renderNotification('probation.extended', { months: 1 }).href).toBe('/app/workforce/my-file');
    expect(renderNotification('pay.bank_changed', {}).body).toContain('A person');
  });

  it('shows the year only when the date is not this year, in one format', () => {
    const now = new Date('2026-10-22T09:00:00Z');
    expect(dayLabel('2026-11-01', now)).toBe('Sun 1 Nov');
    expect(dayLabel('2025-12-17', now)).toBe('Wed 17 Dec 2025');
  });

  it('a leave or time request waiting is a Needs you row, so it does not push', () => {
    expect(renderNotification('time_request.created', { kind: 'CLOCK_OUT', date: '2026-10-19' }).push).toBe(false);
    expect(renderNotification('casual.sent', { date: '2026-10-19' }).push).toBe(false);
  });

  it('every kind a built segment passes to told() has wording', () => {
    const root = join(__dirname, '..');
    const kinds = new Set<string>();
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) for (const m of readFileSync(path, 'utf8').matchAll(/told\([^;]*?,\s*'([a-z_.]+)'/g)) kinds.add(m[1]!);
      }
    };
    walk(root);
    expect(kinds.size).toBeGreaterThan(20);
    expect([...kinds].filter((k) => !isKnownKind(k) && k !== 'attendance.clocked_for' ? true : false)).toEqual([]);
  });
});

const makeDeps = (over: Partial<NotifierDeps> = {}) => {
  const deps = {
    store: vi.fn(async () => ({ id: 'n1', created: true, replaced: false })),
    tokensOf: vi.fn(async () => ['tok']),
    push: vi.fn(async () => 1),
    nudge: vi.fn(),
    hold: vi.fn(async () => undefined),
    log: { info: vi.fn(), warn: vi.fn() },
    ...over,
  } satisfies NotifierDeps;
  return deps;
};

describe('the notifier', () => {
  it('stores one row, nudges once and pushes once for a normal notification', async () => {
    const deps = makeDeps();
    await createNotifier(deps).send('u1', 'payroll.published', { month: '2026-09' }, { now: at('10:00') });
    expect(deps.store).toHaveBeenCalledTimes(1);
    expect(deps.nudge).toHaveBeenCalledWith('u1');
    expect(deps.push).toHaveBeenCalledTimes(1);
    expect(deps.hold).not.toHaveBeenCalled();
  });

  it('holds information at night but still stores the row and nudges at once', async () => {
    const deps = makeDeps();
    await createNotifier(deps).send('u1', 'payroll.month_calculated', { month: '2026-09' }, { now: at('23:30') });
    expect(deps.store).toHaveBeenCalledTimes(1);
    expect(deps.nudge).toHaveBeenCalledTimes(1);
    expect(deps.push).not.toHaveBeenCalled();
    expect(deps.hold).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.hold).mock.calls[0]![1].toISOString()).toBe(at('05:00', '2026-10-21').toISOString());
  });

  it('sends a problem at night, at once', async () => {
    const deps = makeDeps();
    await createNotifier(deps).send('u1', 'payslip.three_wrong_codes', {}, { now: at('23:30') });
    expect(deps.push).toHaveBeenCalledTimes(1);
    expect(deps.hold).not.toHaveBeenCalled();
  });

  it('a duplicate inside its window changes nothing and sends nothing', async () => {
    const deps = makeDeps({ store: vi.fn(async () => ({ id: 'n1', created: false, replaced: false })) });
    await createNotifier(deps).send('u1', 'payroll.published', {}, { dedupeKey: 'k' });
    expect(deps.nudge).not.toHaveBeenCalled();
    expect(deps.push).not.toHaveBeenCalled();
  });

  it('a replaced row (a running count) nudges but does not ring the phone again', async () => {
    const deps = makeDeps({ store: vi.fn(async () => ({ id: 'n1', created: false, replaced: true })) });
    await createNotifier(deps).send('u1', 'payslip.opened_by_staff', { count: 5 }, { dedupeKey: 'k', replace: true });
    expect(deps.nudge).toHaveBeenCalledTimes(1);
    expect(deps.push).not.toHaveBeenCalled();
  });

  it('a kind with no push (a Needs you row) is stored and nudged only', async () => {
    const deps = makeDeps();
    await createNotifier(deps).send('u1', 'time_request.created', { kind: 'CLOCK_OUT' });
    expect(deps.store).toHaveBeenCalledTimes(1);
    expect(deps.push).not.toHaveBeenCalled();
  });

  it('never throws: a failing store or push is logged, not raised', async () => {
    const deps = makeDeps({ store: vi.fn(async () => { throw new Error('db down'); }) });
    await expect(createNotifier(deps).send('u1', 'payroll.published', {})).resolves.toBeUndefined();
    expect(deps.log.warn).toHaveBeenCalled();
    const pushFails = makeDeps({ push: vi.fn(async () => { throw new Error('fcm down'); }) });
    await expect(createNotifier(pushFails).send('u1', 'payroll.published', {})).resolves.toBeUndefined();
  });

  it('dispatches a held push when the job fires, and never throws', async () => {
    const deps = makeDeps();
    await createNotifier(deps).dispatchHeld({ userId: 'u1', notificationId: 'n1', title: 't', body: 'b', href: null, tone: 'information' });
    expect(deps.push).toHaveBeenCalledWith(['tok'], expect.objectContaining({ notificationId: 'n1' }));
    const failing = makeDeps({ tokensOf: vi.fn(async () => { throw new Error('x'); }) });
    await expect(createNotifier(failing).dispatchHeld({ userId: 'u1', notificationId: 'n1', title: 't', body: 'b', href: null, tone: 'information' })).resolves.toBeUndefined();
  });
});
