/** Database proof for Home: every role gets its Home, the See all page filters and pages, nobody without the capability reads Needs you. Lane database only. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AccessSubject } from '../_shared/workforce-access';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);
const NOW = new Date('2026-10-20T08:00:00Z');

describe.skipIf(!enabled)('Home', () => {
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const registry = await import('../needs-you/sources/registry');
    const page = await import('../needs-you/needs-you-page');
    const home = await import('./home-service');
    return { prisma, registry, page, home };
  };
  const userOf = async (email: string): Promise<AccessSubject> => {
    const { prisma } = await load();
    const u = await prisma.user.findFirstOrThrow({ where: { email } });
    return { id: u.id, role: u.role, siteId: u.siteId };
  };
  const row = (id: string, kind: string, since: string, siteId: string, siteName: string) => ({ id, kind, text: `Row ${id}`, opens: '/x', badge: null, since, siteId, siteName, waitingOnRole: 'DIRECTOR', personUserId: null, canRemind: false });

  beforeEach(async () => {
    (await load()).registry.clearNeedsYouSources();
  });
  afterAll(async () => {
    const { prisma, registry } = await load();
    registry.clearNeedsYouSources();
    await prisma.$disconnect();
  });

  it('gives the Director a Home with five numbers, the top five rows grouped, and overdue counted', async () => {
    const { registry, home } = await load();
    const rows = Array.from({ length: 7 }, (_, i) => row(`leave:${i}`, 'leave', new Date(NOW.getTime() - (i + 1) * 86_400_000).toISOString(), 's1', 'Nyeri Town'));
    registry.registerNeedsYouSource({ id: 'leave', kinds: ['leave'], list: async () => rows });
    const view = await home.homeView(await userOf('director@wendo.test'), NOW);
    expect(view.audience).toBe('DIRECTOR');
    expect(view.kpis).toHaveLength(5);
    expect(view.needsYou?.total).toBeGreaterThanOrEqual(7);
    expect(view.needsYou?.overdue).toBeGreaterThanOrEqual(4);
    // One row per kind: the overdue leave items together first, then the rest of the leave.
    expect(view.needsYou?.rows[0]).toMatchObject({ overdue: true, kindLabel: expect.stringMatching(/^Overdue · \d+$/) });
    expect(view.needsYou?.rows.length).toBeLessThanOrEqual(5);
    expect(view.needsYou?.kinds).toBeGreaterThanOrEqual(2);
  });

  it('gives a person without Needs you a Home with no Needs you table', async () => {
    const { home } = await load();
    const { prisma } = await load();
    const waiter = await prisma.user.findFirst({ where: { role: 'WAITER', isActive: true } });
    if (!waiter) return;
    const view = await home.homeView({ id: waiter.id, role: waiter.role, siteId: waiter.siteId }, NOW);
    expect(view.needsYou).toBeNull();
    expect(view.audience).toBe('STAFF');
  });

  it('filters the See all list by group, site and search, and pages it', async () => {
    const { registry, page } = await load();
    const mk = (n: number, kind: string, site: [string, string]) => Array.from({ length: n }, (_, i) => row(`${kind}:${site[0]}:${i}`, kind, new Date(NOW.getTime() - (i + 1) * 3_600_000).toISOString(), site[0], site[1]));
    registry.registerNeedsYouSource({
      id: 'mix',
      kinds: ['leave', 'overtime'],
      list: async () => [...mk(12, 'leave', ['s1', 'Nyeri Town']), ...mk(3, 'overtime', ['s2', 'Nyeri Highway'])],
    });
    const dir = await userOf('director@wendo.test');
    const first = await page.pageNeedsYou(dir, { page: 1, pageSize: 10 }, NOW);
    expect(first.rows).toHaveLength(10);
    expect(first.total).toBeGreaterThanOrEqual(15);
    const leaveOnly = await page.pageNeedsYou(dir, { group: 'leave', page: 2, pageSize: 10 }, NOW);
    expect(leaveOnly.total).toBe(12);
    expect(leaveOnly.rows).toHaveLength(2);
    const highway = await page.pageNeedsYou(dir, { siteId: 's2', page: 1, pageSize: 10 }, NOW);
    expect(highway.total).toBe(3);
    expect(highway.groups.map((g) => g.key)).toEqual(['timesheets']);
    const search = await page.pageNeedsYou(dir, { q: 'leave:s1:3', page: 1, pageSize: 10 }, NOW);
    expect(search.total).toBe(1);
    // The chips count what the search and site leave, whatever chip is chosen.
    const chosen = await page.pageNeedsYou(dir, { group: 'leave', siteId: 's2', page: 1, pageSize: 10 }, NOW);
    expect(chosen.total).toBe(0);
    expect(chosen.groups.map((g) => g.key)).toEqual(['timesheets']);
  });

  it('answers 404 for the page when the person holds no Needs you capability', async () => {
    const { prisma, page } = await load();
    const waiter = await prisma.user.findFirst({ where: { role: 'WAITER', isActive: true } });
    if (!waiter) return;
    await expect(page.pageNeedsYou({ id: waiter.id, role: waiter.role, siteId: waiter.siteId }, { page: 1, pageSize: 10 }, NOW)).rejects.toThrow('Not found');
  });
});
