/** Database proof for Needs you: merge, order, counts equal rows, partial, registry, legacy sites, reminders. Lane database only. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AccessSubject } from '../_shared/workforce-access';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);
const NOW = new Date('2026-10-20T08:00:00Z');

describe.skipIf(!enabled)('Needs you', () => {
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const service = await import('./needs-you-service');
    const overdue = await import('./needs-you-overdue');
    const registry = await import('./sources/registry');
    const types = await import('./needs-you-types');
    return { prisma, service, overdue, registry, types };
  };
  const userOf = async (email: string): Promise<AccessSubject> => {
    const { prisma } = await load();
    const u = await prisma.user.findFirstOrThrow({ where: { email } });
    return { id: u.id, role: u.role, siteId: u.siteId };
  };
  const row = (id: string, kind: string, since: string, badge: 'workforce-timesheets' | 'workforce-payroll' | null = 'workforce-timesheets') => ({ id, kind, text: `Row ${id}`, opens: '/x', badge, since, siteId: null, siteName: null, waitingOnRole: 'MANAGER', personUserId: null, canRemind: true });

  beforeEach(async () => {
    (await load()).registry.clearNeedsYouSources();
  });
  afterAll(async () => {
    const { prisma, registry } = await load();
    registry.clearNeedsYouSources();
    await prisma.$disconnect();
  });

  it('merges sources oldest first, ties by kind order, and the badge counts equal the rows', async () => {
    const { service, registry } = await load();
    registry.registerNeedsYouSource({ id: 'a', kinds: ['alpha', 'beta'], list: async () => [row('beta:1', 'beta', '2026-10-01T00:00:00Z'), row('alpha:1', 'alpha', '2026-10-01T00:00:00Z'), row('alpha:2', 'alpha', '2026-09-30T00:00:00Z', 'workforce-payroll')] });
    registry.registerNeedsYouSource({ id: 'b', kinds: ['gamma'], list: async () => [row('gamma:1', 'gamma', '2026-10-05T00:00:00Z', null)], count: async () => ({}) });
    const dir = await userOf('director@wendo.test');
    const list = await service.listNeedsYou(dir, NOW);
    expect(list.rows.map((r) => r.id)).toEqual(['alpha:2', 'alpha:1', 'beta:1', 'gamma:1']);
    expect(list.partial).toBe(false);
    const counts = await service.countNeedsYou(dir, NOW);
    const tally = (key: string) => list.rows.filter((r) => r.badge === key).length;
    expect(counts.badges['workforce-timesheets']).toBe(tally('workforce-timesheets'));
    expect(counts.badges['workforce-payroll']).toBe(tally('workforce-payroll'));
    expect(counts.total).toBe(3);
  });

  it('one failing source drops its rows and says partial; registering an id twice replaces it', async () => {
    const { service, registry } = await load();
    registry.registerNeedsYouSource({ id: 'good', kinds: ['g'], list: async () => [row('g:1', 'g', '2026-10-01T00:00:00Z')] });
    registry.registerNeedsYouSource({ id: 'bad', kinds: ['x'], list: async () => Promise.reject(new Error('boom')) });
    registry.registerNeedsYouSource({ id: 'good', kinds: ['g'], list: async () => [row('g:2', 'g', '2026-10-02T00:00:00Z')] });
    const dir = await userOf('director@wendo.test');
    const list = await service.listNeedsYou(dir, NOW);
    expect(list.rows.map((r) => r.id)).toEqual(['g:2']);
    expect(list.partial).toBe(true);
    expect(registry.registeredSources()).toHaveLength(2);
  });

  it('caps the card at 500 rows and keeps the true total', async () => {
    const { service, registry } = await load();
    registry.registerNeedsYouSource({ id: 'many', kinds: ['m'], list: async () => Array.from({ length: 520 }, (_, i) => row(`m:${i}`, 'm', new Date(NOW.getTime() - i * 1000).toISOString())) });
    const list = await service.listNeedsYou(await userOf('director@wendo.test'), NOW);
    expect(list.rows).toHaveLength(500);
    expect(list.total).toBe(520);
  });

  it('answers 404 without the capability, and a row is gone once its source stops listing it', async () => {
    const { service, registry } = await load();
    let waiting = true;
    registry.registerNeedsYouSource({ id: 'one', kinds: ['o'], list: async () => (waiting ? [row('o:1', 'o', '2026-10-01T00:00:00Z')] : []) });
    const waiter: AccessSubject = { id: '00000000-0000-4000-8000-000000000001', role: 'WAITER', siteId: null };
    await expect(service.listNeedsYou(waiter, NOW)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.countNeedsYou(waiter, NOW)).rejects.toMatchObject({ statusCode: 404 });
    const dir = await userOf('director@wendo.test');
    expect((await service.listNeedsYou(dir, NOW)).rows).toHaveLength(1);
    waiting = false;
    expect((await service.listNeedsYou(dir, NOW)).rows).toHaveLength(0);
  });

  it('undo goes to the source that owns the row, else UNDO_UNAVAILABLE', async () => {
    const { service, registry } = await load();
    const undone: string[] = [];
    registry.registerNeedsYouSource({ id: 'u', kinds: ['u'], list: async () => [], undo: async (_s, id) => void undone.push(id) });
    registry.registerNeedsYouSource({ id: 'n', kinds: ['n'], list: async () => [] });
    const dir = await userOf('director@wendo.test');
    expect(await service.undoRow(dir, 'u:5')).toEqual({ undone: true });
    expect(undone).toEqual(['u:5']);
    await expect(service.undoRow(dir, 'n:5')).rejects.toMatchObject({ code: 'UNDO_UNAVAILABLE' });
  });

  it('the built sources, for every desk role: counts equal rows, no legacy site rows, no pay figure in any text', async () => {
    const { service, registry, prisma } = await load();
    const { registerNeedsYou } = await import('./register-needs-you');
    registerNeedsYou();
    const switches = await prisma.attendanceSiteSwitch.findMany({ where: { enabled: true }, select: { siteId: true } });
    for (const email of ['director@wendo.test', 'bm.town@wendo.test', 'accountant@wendo.test', 'store.manager@wendo.test', 'admin@wendo.test']) {
      const who = await userOf(email);
      const list = await service.listNeedsYou(who, NOW);
      const counts = await service.countNeedsYou(who, NOW);
      expect(list.partial, email).toBe(false);
      expect(Object.values(counts.badges).reduce((a, b) => a + b, 0), email).toBe(list.rows.filter((r) => r.badge).length);
      for (const r of list.rows) {
        expect(r.text, `${email} ${r.id}`).not.toMatch(/\bKES\b|\bKsh\b|\d[\d,]*\.\d{2}\b/i);
        if (r.siteId && ['overtime', 'clock-fix', 'shift-closed', 'month', 'casual-pay'].includes(r.kind)) expect(switches.map((s) => s.siteId), `${email} ${r.id}`).toContain(r.siteId);
      }
    }
    expect(registry.registeredSources().map((s) => s.id)).toEqual(['time', 'month-and-casual', 'pay', 'security']);
  });

  it('a Director reminds once per item per day; a second press is REMINDER_ALREADY_SENT and a non-Director gets 404', async () => {
    const { overdue, registry, prisma } = await load();
    const item = row(`probe:${NOW.getTime()}`, 'probe', '2026-10-01T00:00:00Z');
    registry.registerNeedsYouSource({ id: 'probe', kinds: ['probe'], list: async () => [], overdue: async () => [item], remindees: async () => [] });
    const dir = await userOf('director@wendo.test');
    const rows = await overdue.listOverdue(dir, NOW);
    expect(rows.rows[0]).toMatchObject({ id: item.id, remindedToday: false, waitingDays: 19 });
    expect(await overdue.remind(dir, item.id, 'remind-key-0001', NOW)).toEqual({ reminded: true });
    await expect(overdue.remind(dir, item.id, 'remind-key-0002', NOW)).rejects.toMatchObject({ code: 'REMINDER_ALREADY_SENT' });
    expect((await overdue.listOverdue(dir, NOW)).rows[0]?.remindedToday).toBe(true);
    await expect(overdue.remind(dir, 'nothing:1', 'remind-key-0003', NOW)).rejects.toMatchObject({ code: 'ITEM_NOT_OVERDUE' });
    await expect(overdue.listOverdue(await userOf('bm.town@wendo.test'), NOW)).rejects.toMatchObject({ statusCode: 404 });
    await prisma.workforceNeedsYouReminder.deleteMany({ where: { itemId: item.id } });
  });
});
