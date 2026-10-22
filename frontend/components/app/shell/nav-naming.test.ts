import { describe, expect, it } from 'vitest';

import type { AppRole } from '@/types/auth';
import { NAV_ROWS, menuFor } from './nav-table';
import { DESKTOP, EVERYTHING, FLOOR, ctxFor } from './nav-test-helpers';

/**
 * The naming table (docs/features/workforce/final-pass/design-notes-1-round-1.md): one name per page, sentence case. A name the table
 * retired must not come back in any row, and no caption of any person's menu may hold two links with the same name.
 */
const RETIRED = [
  'Schedule', 'Rota', 'Department Shifts', 'Leave Requests', 'Casuals', 'Casual pool', 'Contract Types', 'HR Overview', 'HR Home', 'Day', 'Past days', 'Stock',
  'Sales dashboard', 'Branch settings', 'Leadership Accounts', 'Menu', 'Team', 'Leave Calendar', 'Jump box', 'Waiting for you', 'Overdue approvals',
];

/** Capital letters beyond the first word are allowed only for these (proper names and abbreviations). */
const CAPITAL_OK = new Set(['KES', 'M-Pesa', 'QR', 'PIN', 'HR', 'Central', 'Store', 'Nyeri']);

const allLabels = (): Array<{ where: string; label: string }> =>
  NAV_ROWS.flatMap((r) => [{ where: r.key, label: r.label }, ...(r.subItems ?? []).map((s) => ({ where: `${r.key}/${s.key}`, label: s.label }))]);

describe('the naming table', () => {
  it('has no retired name in any row or sub-link', () => {
    for (const { where, label } of allLabels()) expect(RETIRED, `${where} is called "${label}", a name the naming table retired`).not.toContain(label);
  });

  it('keeps every label in sentence case: a capital first letter, then lower case except proper names', () => {
    for (const { where, label } of allLabels()) {
      expect(label, `${where}`).toMatch(/^[A-Z0-9]/);
      for (const word of label.split(' ').slice(1)) {
        if (CAPITAL_OK.has(word)) continue;
        expect(word, `${where} "${label}" is not sentence case`).not.toMatch(/^[A-Z]/);
      }
    }
  });

  it('has no leftover Inbox for HR or the System Admin, and no Dashboard for the waiter, chef or barista', () => {
    const inbox = NAV_ROWS.filter((r) => r.label === 'Inbox');
    for (const r of inbox) {
      expect(r.roles, r.key).not.toContain('HR_MANAGER');
      expect(r.roles, r.key).not.toContain('SYSTEM_ADMIN');
    }
    for (const r of NAV_ROWS.filter((row) => row.label === 'Dashboard' && row.group === 'staff-nav')) {
      for (const role of ['WAITER', 'CHEF', 'BARISTA'] as AppRole[]) expect(r.roles, r.key).not.toContain(role);
    }
  });

  const contexts: Array<[string, AppRole, Parameters<typeof ctxFor>[1]]> = [
    ...DESKTOP.map((r): [string, AppRole, Parameters<typeof ctxFor>[1]] => [r, r, { can: EVERYTHING, attendanceOn: true, payrollOn: true }]),
    ...FLOOR.map((r): [string, AppRole, Parameters<typeof ctxFor>[1]] => [`${r} head`, r, { isDepartmentHead: true, can: EVERYTHING, attendanceOn: true }]),
    ...FLOOR.map((r): [string, AppRole, Parameters<typeof ctxFor>[1]] => [`${r} member`, r, { isDepartmentMember: true, can: EVERYTHING, attendanceOn: true }]),
    ['STORE_ATTENDANT', 'STORE_ATTENDANT', { can: EVERYTHING, attendanceOn: true }],
  ];

  for (const [name, role, over] of contexts) {
    it(`${name}: no duplicate label under one caption, and no duplicate feature row or personal item`, () => {
      const menu = menuFor(ctxFor(role, over));
      for (const feature of menu.features) {
        const seen = new Map<string, number>();
        let caption = '';
        for (const sub of feature.subItems ?? []) {
          caption = sub.section ?? caption;
          const id = `${caption}/${sub.label}`;
          seen.set(id, (seen.get(id) ?? 0) + 1);
        }
        for (const [id, n] of Array.from(seen)) expect(n, `${name}: "${id}" appears ${n} times under ${feature.label}`).toBe(1);
      }
      const featureLabels = menu.features.map((f) => f.label);
      expect(new Set(featureLabels).size, `${name}: ${featureLabels.join(', ')}`).toBe(featureLabels.length);
      const personal = menu.account.map((a) => a.label);
      expect(new Set(personal).size, `${name}: ${personal.join(', ')}`).toBe(personal.length);
    });
  }
});
