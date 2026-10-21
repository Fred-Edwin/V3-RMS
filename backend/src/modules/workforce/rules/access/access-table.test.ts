import { describe, expect, it } from 'vitest';
import { AUDIENCE_ROLE, toldAudiencesOf } from '../plan/plan-notice';
import { RULE_FIELD_POLICY } from '../rules-field-policy';
import { GROUPS, fieldsOf } from '../rules-values';
import { ROWS } from './access-catalogue';
import { buildAccessTable } from './access-table';

describe('the row catalogue covers every stored field exactly once', () => {
  it.each(GROUPS)('%s: every field of the group sits in one row, and no row names a field that does not exist', (group) => {
    const listed = ROWS[group].flatMap((row) => row.fields);
    expect([...listed].sort()).toEqual([...fieldsOf(group)].sort());
    expect(new Set(listed).size).toBe(listed.length);
    expect(new Set(ROWS[group].map((row) => row.id)).size).toBe(ROWS[group].length);
  });

  it('a Fixed row holds no editable field, and every other row with fields holds at least one', () => {
    for (const group of GROUPS) {
      const policy = RULE_FIELD_POLICY[group] as Record<string, { edit: string | null; derived?: boolean }>;
      for (const row of ROWS[group]) {
        const editable = row.fields.filter((field) => policy[field]?.edit !== null && policy[field]?.derived !== true);
        if (row.fixed) expect(editable, `${group}.${row.id}`).toEqual([]);
        else if (row.fields.length > 0) expect(editable.length, `${group}.${row.id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('the Who edits what table', () => {
  const table = buildAccessTable();
  const row = (slug: string) => table.find((r) => r.slug === slug)!;

  it('has one row for each of the ten tabs, in order, with a slug and a label', () => {
    expect(table.map((r) => r.slug)).toEqual(['lateness', 'overtime', 'attendance', 'leave', 'probation', 'casual', 'conduct', 'statutory', 'holidays', 'week']);
    expect(table.map((r) => r.group)).toEqual(GROUPS);
  });

  it('is generated from the access table: lateness is the Director and System Admin for any site and the Branch Manager for their own', () => {
    expect(row('lateness').changedBy).toEqual([
      { role: 'DIRECTOR', scope: 'ALL', rows: null },
      { role: 'BRANCH_MANAGER', scope: 'OWN_SITE', rows: ['graceMinutes', 'afterGrace', 'excuseWindow', 'makeUpSameDay'] },
      { role: 'SYSTEM_ADMIN', scope: 'ALL', rows: null },
    ]);
    expect(row('lateness').text.changedBy).toBe('Director · Branch Manager for own site (all but the deduction cap) · System Admin');
    expect(row('lateness').confirmedBy).toEqual([]);
    expect(row('lateness').text.confirmedBy).toBe('No one, starts on its date');
  });

  it('overtime: the Director changes everything, the Branch Manager the tail, caps, budget and window, the Accountant confirms the multiplier', () => {
    expect(row('overtime').text.changedBy).toBe('Director · Branch Manager for own site (all but the multiplier) · System Admin');
    expect(row('overtime').text.confirmedBy).toBe('Accountant (the multiplier)');
    expect(row('overtime').text.told).toBe('Accountant, HR');
  });

  it('single-owner tabs: attendance, probation, casual work, conduct, week and breaks are the Director’s and the System Admin’s', () => {
    for (const slug of ['attendance', 'probation', 'casual', 'conduct', 'week']) {
      expect(row(slug).changedBy, slug).toEqual([{ role: 'DIRECTOR', scope: 'ALL', rows: null }, { role: 'SYSTEM_ADMIN', scope: 'ALL', rows: null }]);
      expect(row(slug).confirmedBy, slug).toEqual([]);
    }
  });

  it('leave: the Director, HR and the System Admin change everything; the Branch Manager only minimum cover at their own site', () => {
    expect(row('leave').text.changedBy).toBe('Director · HR (leave types) · Branch Manager for own site (minimum cover) · System Admin');
  });

  it('statutory: the Accountant, the Director and the System Admin change it; only the Accountant confirms it', () => {
    expect(row('statutory').changedBy.map((c) => c.role)).toEqual(['DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN']);
    expect(row('statutory').confirmedBy).toEqual([{ role: 'ACCOUNTANT', what: 'tables' }]);
    expect(row('statutory').text.told).toBe('Director, HR');
  });

  it('holidays: the Director and System Admin change both, the Accountant the rate; each confirms their own', () => {
    expect(row('holidays').text.changedBy).toBe('Director · Accountant (the pay rate) · System Admin');
    expect(row('holidays').text.confirmedBy).toBe('Director (the list) · System Admin (the list) · Accountant (the pay rate)');
  });

  it('the System Admin changes every tab; HR changes leave types and nothing else', () => {
    const rolesOf = (role: string) => table.filter((r) => r.changedBy.some((c) => c.role === role)).map((r) => r.slug);
    expect(rolesOf('SYSTEM_ADMIN')).toEqual(table.map((r) => r.slug));
    expect(rolesOf('HR_MANAGER')).toEqual(['leave']);
    expect(rolesOf('ACCOUNTANT')).toEqual(['statutory', 'holidays']);
    expect(rolesOf('BRANCH_MANAGER')).toEqual(['lateness', 'overtime', 'leave']);
  });

  it('the told column is the audience map', () => {
    for (const r of table) {
      expect(r.told.map((t) => t.role).sort(), r.slug).toEqual([...new Set(toldAudiencesOf(r.group).map((a) => AUDIENCE_ROLE[a]))].sort());
    }
  });
});
