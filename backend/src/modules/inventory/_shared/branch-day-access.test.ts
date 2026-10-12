/**
 * Branch day: role by capability (docs/features/inventory/branch-day-contract.md §3). One row per role, so a change to the table in
 * central-store-access.ts shows up here as one line. Department heads and members hold none of these from the table: checking the opening
 * and counting the evening is the department rule in the service, so `branch_day.count` belongs to no role.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, actorCan, capabilitiesOf, type Capability } from './central-store-access';

const ALL: Capability[] = ['branch_day.count', 'branch_day.count_on_behalf', 'branch_day.read', 'branch_day.read_any_branch', 'branch_day.close', 'branch_day.correct'];

const grid: Record<string, Capability[]> = {
  // Reads every branch's day, read only. Does not close, correct or count.
  STORE_MANAGER: ['branch_day.read_any_branch'],
  // May do every action with their own PIN (flow table), but counting for a department is "on behalf", which is the Branch Manager's alone (owner, 8 Oct).
  SYSTEM_ADMIN: ['branch_day.read', 'branch_day.read_any_branch', 'branch_day.close', 'branch_day.correct'],
  ACCOUNTANT: ['branch_day.read_any_branch'],
  DIRECTOR: ['branch_day.read_any_branch'],
  BRANCH_MANAGER_AS_MANAGER: ['branch_day.read', 'branch_day.close', 'branch_day.correct', 'branch_day.count_on_behalf'],
  STORE_ATTENDANT: [],
  // Department heads and members hold nothing here: their rights are the department rule.
  WAITER: [],
  CHEF: [],
  BARISTA: [],
};

const roleOf = (key: string): string => (key === 'BRANCH_MANAGER_AS_MANAGER' ? 'MANAGER' : key);
const mine = (c: string): boolean => c.startsWith('branch_day.');

describe('Branch day capability grid', () => {
  it('declares exactly the six capabilities', () => {
    expect(CAPABILITIES.filter(mine).sort()).toEqual([...ALL].sort());
  });

  it.each(Object.entries(grid))('%s holds exactly its rows', (key, expected) => {
    expect(capabilitiesOf(roleOf(key)).filter(mine).sort()).toEqual([...expected].sort());
  });

  it('every desktop role reads the day: the four hub roles across branches and the Branch Manager their own', () => {
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR']) {
      expect(actorCan({ role } as never, 'branch_day.read_any_branch'), role).toBe(true);
    }
    expect(actorCan({ role: 'MANAGER' } as never, 'branch_day.read')).toBe(true);
    expect(actorCan({ role: 'MANAGER' } as never, 'branch_day.read_any_branch')).toBe(false);
  });

  it('only the Branch Manager and the System Admin close the day or correct a count; nobody else', () => {
    for (const role of ['MANAGER', 'SYSTEM_ADMIN']) {
      expect(actorCan({ role } as never, 'branch_day.close'), role).toBe(true);
      expect(actorCan({ role } as never, 'branch_day.correct'), role).toBe(true);
    }
    for (const role of ['STORE_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'STORE_ATTENDANT', 'CHEF', 'WAITER', 'BARISTA']) {
      expect(actorCan({ role } as never, 'branch_day.close'), role).toBe(false);
      expect(actorCan({ role } as never, 'branch_day.correct'), role).toBe(false);
    }
  });

  it('counting for a department is the Branch Manager alone; the department counts by the department rule, so no role holds the plain count row', () => {
    expect(actorCan({ role: 'MANAGER' } as never, 'branch_day.count_on_behalf')).toBe(true);
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'STORE_ATTENDANT', 'CHEF', 'WAITER', 'BARISTA']) {
      expect(actorCan({ role } as never, 'branch_day.count_on_behalf'), `${role} on behalf`).toBe(false);
    }
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_ATTENDANT', 'CHEF', 'WAITER', 'BARISTA']) {
      expect(actorCan({ role } as never, 'branch_day.count'), `${role} count`).toBe(false);
    }
  });

  it('the front end mirror lists the same names', () => {
    const source = readFileSync(join(__dirname, '../../../../../frontend/features/inventory/_shared/lib/capabilities.ts'), 'utf8');
    const mirrored = [...source.matchAll(/'(branch_day\.[a-z_]+)'/g)].map((m) => m[1]);
    expect(mirrored.sort()).toEqual([...ALL].sort());
  });
});
