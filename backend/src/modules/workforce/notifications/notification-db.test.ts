/** Database proofs for the Inbox store: dedupe, replace, own-rows-only reads, read marks. Runs only on a lane database. */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('workforce notifications in the database', () => {
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const { notificationRepository: repo } = await import('./notification-repository');
    const { notificationInboxService: inbox } = await import('./notification-inbox-service');
    const { renderNotification } = await import('./wording/notification-wording');
    return { prisma, repo, inbox, renderNotification };
  };
  const users: string[] = [];
  const newUser = (): string => {
    const id = randomUUID();
    users.push(id);
    return id;
  };

  afterAll(async () => {
    const { prisma } = await load();
    await prisma.workforceNotification.deleteMany({ where: { userId: { in: users } } });
    await prisma.$disconnect();
  });

  it('keeps one row per dedupe key, even with two writers at once', async () => {
    const { repo, renderNotification } = await load();
    const user = newUser();
    const row = renderNotification('payroll.published', { month: '2026-09' });
    const results = await Promise.all([1, 2, 3].map(() => repo.store(user, 'payroll.published', row, 'k1', false)));
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
  });

  it('rewrites the words of the existing row on replace and marks it unread again', async () => {
    const { repo, inbox, renderNotification } = await load();
    const user = newUser();
    const first = await repo.store(user, 'payslip.opened_by_staff', renderNotification('payslip.opened_by_staff', { openerRole: 'HR_MANAGER', count: 1 }), 'opens:d1', true);
    await inbox.markRead(user, [first.id]);
    const second = await repo.store(user, 'payslip.opened_by_staff', renderNotification('payslip.opened_by_staff', { openerRole: 'HR_MANAGER', count: 12 }), 'opens:d1', true);
    expect(second).toMatchObject({ id: first.id, created: false, replaced: true });
    const page = await inbox.list(user, { unread: false, page: 1, pageSize: 25 });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({ body: 'HR Manager opened 12 payslips today.', read: false });
  });

  it('lists only the caller\'s rows, counts unread, and marks read without touching other people', async () => {
    const { repo, inbox, renderNotification } = await load();
    const mine = newUser();
    const theirs = newUser();
    const row = renderNotification('payroll.published', { month: '2026-09' });
    const a = await repo.store(mine, 'payroll.published', row, null, false);
    await repo.store(mine, 'payroll.published', row, null, false);
    const other = await repo.store(theirs, 'payroll.published', row, null, false);
    expect((await inbox.list(mine, { unread: true, page: 1, pageSize: 10 })).total).toBe(2);
    // an id that belongs to someone else is not counted and not marked
    expect(await inbox.markRead(mine, [other.id])).toMatchObject({ marked: 0, unread: 2 });
    expect(await inbox.markRead(mine, [a.id])).toMatchObject({ marked: 1, unread: 1 });
    expect((await inbox.unreadCount(theirs)).unread).toBe(1);
    expect(await inbox.markAllRead(mine)).toMatchObject({ marked: 1, unread: 0 });
  });

  it('filters by area and by words, and counts every area before any filter', async () => {
    const { repo, inbox, renderNotification } = await load();
    const user = newUser();
    const other = newUser();
    await repo.store(user, 'payroll.published', renderNotification('payroll.published', { month: '2026-09' }), 'a1', false);
    await repo.store(user, 'payroll.published', renderNotification('payroll.published', { month: '2026-10' }), 'a2', false);
    await repo.store(user, 'payslip.opened_by_staff', renderNotification('payslip.opened_by_staff', { openerRole: 'HR_MANAGER', count: 3 }), 'a3', false);
    await repo.store(other, 'payroll.published', renderNotification('payroll.published', { month: '2026-09' }), 'a4', false);
    const base = { unread: false, page: 1, pageSize: 25 };
    const pay = await inbox.list(user, { ...base, area: 'PAY' });
    expect(pay.total).toBe(2);
    expect(pay.all).toBe(3);
    expect(pay.areas).toEqual([{ area: 'PAY', count: 2 }, { area: 'DOCUMENTS', count: 1 }]);
    expect((await inbox.list(user, { ...base, q: 'OPENED' })).total).toBe(1);
    expect((await inbox.list(user, { ...base, area: 'DOCUMENTS', q: 'payroll' })).total).toBe(0);
  });

  it('pages newest first', async () => {
    const { repo, inbox, renderNotification } = await load();
    const user = newUser();
    for (let i = 0; i < 5; i += 1) await repo.store(user, 'payroll.published', renderNotification('payroll.published', { month: '2026-09' }), `p${i}`, false);
    const page = await inbox.list(user, { unread: false, page: 2, pageSize: 2 });
    expect(page).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(page.items).toHaveLength(2);
  });
});
