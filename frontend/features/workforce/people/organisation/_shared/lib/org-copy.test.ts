import { describe, expect, it } from 'vitest';

import type { DepartmentSummary, OrgOverview, SiteBlock } from '../types/org-types';
import { approvalsGoTo, firstSiteToShow, overviewKpis, siteStatus, siteSubline } from './org-copy';

const head = (name: string, extra: Partial<DepartmentSummary['head'] & object> = {}) => ({ employeeId: 'e', userId: 'u', name, isActing: false, since: '2026-01-01', returnsOn: null, ...extra });
const dept = (over: Partial<DepartmentSummary> = {}): DepartmentSummary => ({
  id: 'd', organizationId: 's', name: 'Kitchen', inventoryTag: 'KITCHEN', description: null, isActive: true, people: 3, head: null, actingHead: null, hasGap: true, ...over,
});
const site = (over: Partial<SiteBlock> = {}): SiteBlock => ({ id: 's', name: 'Nyeri Town', type: 'BRANCH', isHub: false, headsAllowed: true, departments: [dept(), dept({ id: 'd2', people: 1 })], gaps: 1, ...over });
const overview = (sites: SiteBlock[]): OrgOverview => ({ organizations: sites, counts: { organizations: sites.length, departments: 12, heads: 3, gaps: 7 } });

describe('overviewKpis', () => {
  it('shows the four numbers, a dash for heads on leave, and makes the gap cell a button only when there is a gap', () => {
    const cells = overviewKpis(overview([site()]), 6, () => undefined);
    expect(cells.map((c) => [c.label, c.value])).toEqual([['DEPARTMENTS', '12'], ['WITHOUT A HEAD', '7'], ['HEADS ON LEAVE', '–'], ['CASUAL POOLS', '6']]);
    expect(cells[1]?.actionable).toBe(true);
    const none = overviewKpis({ ...overview([]), counts: { organizations: 1, departments: 2, heads: 2, gaps: 0 } }, null, () => undefined);
    expect(none[1]?.actionable).toBe(false);
    expect(none[3]?.value).toBe('–');
    expect(none[0]?.detail).toBe('across 1 site');
  });
});

describe('site rows', () => {
  it('counts people and departments', () => {
    expect(siteSubline(site())).toBe('2 departments · 4 people');
    expect(siteSubline(site({ departments: [dept({ people: 1 })] }))).toBe('1 department · 1 person');
  });
  it('says Complete when there is no gap, and the count of gaps otherwise', () => {
    expect(siteStatus(site({ gaps: 1 }))).toEqual({ text: '1 gap', tone: 'warning' });
    expect(siteStatus(site({ gaps: 3 })).text).toBe('3 gaps');
    expect(siteStatus(site({ gaps: 0 }))).toEqual({ text: 'Complete', tone: 'success' });
  });
  it('opens the chosen site, else the first with a gap, else the first', () => {
    const a = site({ id: 'a', gaps: 0 });
    const b = site({ id: 'b', gaps: 2 });
    expect(firstSiteToShow(overview([a, b]), null)?.id).toBe('b');
    expect(firstSiteToShow(overview([a, b]), 'a')?.id).toBe('a');
    expect(firstSiteToShow(overview([a]), null)?.id).toBe('a');
  });
});

describe('approvalsGoTo', () => {
  it('goes to the head, to an acting head until the return day, or to the Branch Manager for now', () => {
    expect(approvalsGoTo(dept({ head: head('Nancy Wangari'), hasGap: false }), true)).toEqual({ text: 'Nancy Wangari', tone: 'default' });
    expect(approvalsGoTo(dept({ head: head('Kelvin Kings'), actingHead: head('Faith Njeri', { isActing: true, returnsOn: '2026-10-09' }), hasGap: false }), true)).toEqual({ text: 'Faith Njeri, until 9 Oct', tone: 'warning' });
    expect(approvalsGoTo(dept(), true)).toEqual({ text: 'The Branch Manager, for now', tone: 'warning' });
  });
  it('never says "for now" at the Central Store, which has no heads', () => {
    expect(approvalsGoTo(dept({ hasGap: false }), false).text).toBe('The unit manager');
  });
});
