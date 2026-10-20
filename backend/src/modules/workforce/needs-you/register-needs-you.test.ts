import { beforeEach, describe, expect, it, vi } from 'vitest';

const nudged: string[][] = [];
vi.mock('../notifications', async (original) => ({ ...(await original<typeof import('../notifications')>()), nudgeUsers: (ids: string[]) => void nudged.push([...ids]) }));
vi.mock('./needs-you-repository', () => ({
  needsYouQueries: {
    allRoles: () => ['MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN', 'WAITER'],
    usersByRoles: async (roles: string[], siteId: string | null) => roles.map((r) => `${r}@${siteId ?? 'company'}`) },
}));

describe('Needs you nudges', () => {
  beforeEach(() => {
    nudged.length = 0;
  });

  it.each([
    ['time_request.created', { siteId: 'site-1', requestId: 'r', employeeId: 'e', userId: null, kind: 'CLOCK_TIME_WRONG', waitingOnRole: 'BRANCH_MANAGER', waitingOnUserId: null }],
    ['overtime.requested', { siteId: 'site-1', employeeId: 'e', overtimeRequestId: 'o', minutesRequested: 30 }],
    ['leave.requested', { siteId: 'site-1', requestId: 'l', employeeId: 'e' }],
    ['conduct.appeal_sent', { siteId: 'site-1', appealId: 'a', employeeId: 'e' }],
    ['payroll.month_sent', { monthKey: '2026-09', sentById: 'u' }],
  ] as const)('%s nudges the people who hold needs_you.read near it', async (name, payload) => {
    const { registerNeedsYou } = await import('./register-needs-you');
    const { workforceEvents } = await import('../_shared/events');
    registerNeedsYou();
    workforceEvents.emit(name, payload as never);
    await new Promise((r) => setTimeout(r, 20));
    expect(nudged.length).toBeGreaterThan(0);
    const people = nudged.flat();
    expect(people.some((p) => p.endsWith('@company'))).toBe(true); // head office readers always
    if ('siteId' in payload) expect(people.some((p) => p.endsWith('@site-1'))).toBe(true); // the site's own managers
  });
});
