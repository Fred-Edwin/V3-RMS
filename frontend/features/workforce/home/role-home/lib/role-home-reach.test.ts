import { describe, expect, it } from 'vitest';
import { reachableKpis } from './role-home-reach';
import type { HomeKpi } from '../types/role-home-types';

const kpi = (key: string, href: string | null): HomeKpi => ({ key, label: key, value: '1', detail: '', tone: 'normal', href });
const KPIS = [kpi('active', '/app/workforce/employees'), kpi('on-leave', '/app/workforce/leave'), kpi('leave-waiting', '/app/workforce/leave'), kpi('timesheets', '/app/workforce/timesheets'), kpi('no-head', '/app/workforce/organisation')];

describe('Home cards the menu can reach', () => {
  it('keeps every card while the clock is on', () => {
    expect(reachableKpis(KPIS, true).map((k) => k.key)).toEqual(['active', 'on-leave', 'leave-waiting', 'timesheets', 'no-head']);
  });

  it('drops the leave and timesheet work cards while the clock is off and unlinks the rest that pointed there', () => {
    const shown = reachableKpis(KPIS, false);
    expect(shown.map((k) => k.key)).toEqual(['active', 'on-leave', 'no-head']);
    expect(shown.find((k) => k.key === 'on-leave')?.href).toBeNull();
    expect(shown.find((k) => k.key === 'active')?.href).toBe('/app/workforce/employees');
  });
});
