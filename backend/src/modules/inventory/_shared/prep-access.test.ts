/**
 * Prep: role by capability (docs/features/inventory/prep-plan.md §2). One row per role, so a change to the table in
 * central-store-access.ts shows up here as one line.
 */
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, actorCan, capabilitiesOf, type Capability } from './central-store-access';

const PREP: Capability[] = [
  'prep.read',
  'prep.see_costs',
  'prep.read_flags',
  'prep.record',
  'prep.fix_any',
  'prep.review',
  'prep.recipes_write',
];

const grid: Record<string, Capability[]> = {
  STORE_MANAGER: PREP,
  SYSTEM_ADMIN: PREP,
  ACCOUNTANT: ['prep.read', 'prep.see_costs', 'prep.read_flags'],
  DIRECTOR: ['prep.read', 'prep.see_costs', 'prep.read_flags'],
  MANAGER: ['prep.read', 'prep.see_costs', 'prep.read_flags'],
  STORE_ATTENDANT: ['prep.read', 'prep.record'],
  WAITER: [],
  CHEF: [],
  BARISTA: [],
};

describe('Prep capability grid', () => {
  it('declares exactly the seven prep capabilities', () => {
    expect(CAPABILITIES.filter((c) => c.startsWith('prep.')).sort()).toEqual([...PREP].sort());
  });

  it.each(Object.entries(grid))('%s holds exactly its Prep rows', (role, expected) => {
    const held = capabilitiesOf(role).filter((c) => c.startsWith('prep.'));
    expect(held.sort()).toEqual([...expected].sort());
  });

  it('the Attendant never reads costs or flags and cannot fix others’ runs', () => {
    const attendant = { role: 'STORE_ATTENDANT' as const };
    expect(actorCan(attendant, 'prep.see_costs')).toBe(false);
    expect(actorCan(attendant, 'prep.read_flags')).toBe(false);
    expect(actorCan(attendant, 'prep.fix_any')).toBe(false);
    expect(actorCan(attendant, 'prep.record')).toBe(true);
  });

  it('only the Store Manager and System Admin write recipes, review and fix any run', () => {
    for (const cap of ['prep.recipes_write', 'prep.review', 'prep.fix_any'] as const) {
      const holders = Object.keys(grid).filter((role) => actorCan({ role: role as 'MANAGER' }, cap));
      expect(holders.sort()).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN']);
    }
  });
});
