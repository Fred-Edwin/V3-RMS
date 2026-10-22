import { describe, expect, it } from 'vitest';

import { needsYouPageFromWire } from './role-home-services';

describe('needsYouPageFromWire', () => {
  it('turns the API\'s "organization" names into the screen\'s site names, and keeps everything else', () => {
    const page = needsYouPageFromWire({
      rows: [{ id: 'r1', kind: 'leave', kindLabel: 'Leave', text: 'x', line: 'y', action: 'Review', opens: '/app/workforce/leave', since: '2026-10-20T08:00:00.000Z', organizationId: 'o1', organizationName: 'Nyeri Town', overdue: false }],
      organizations: [{ id: 'o1', name: 'Nyeri Town' }],
      total: 1,
      all: 1,
      overdue: 0,
      groups: [],
      page: 1,
      pageSize: 10,
      partial: false,
    } as unknown as Parameters<typeof needsYouPageFromWire>[0]);
    expect(page.sites).toEqual([{ id: 'o1', name: 'Nyeri Town' }]);
    expect(page.rows[0]).toMatchObject({ siteId: 'o1', siteName: 'Nyeri Town', kind: 'leave' });
    expect(page.rows[0]).not.toHaveProperty('organizationId');
    expect(page.total).toBe(1);
  });

  it('gives an empty site list when the API sends none', () => {
    const page = needsYouPageFromWire({ rows: [], total: 0, all: 0, overdue: 0, groups: [], page: 1, pageSize: 10, partial: false } as unknown as Parameters<typeof needsYouPageFromWire>[0]);
    expect(page.sites).toEqual([]);
  });
});
