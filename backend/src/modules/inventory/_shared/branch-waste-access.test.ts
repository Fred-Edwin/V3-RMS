/**
 * Branch waste: role by capability (docs/features/inventory/branch-waste-contract.md §3). One row per role, so a change to the table
 * in central-store-access.ts shows up here as one line. Department heads and members hold none of these from the table: logging and
 * reversing your own entry is the department rule in the service, so `branch_waste.log` and `branch_waste.reverse_own` belong to no role.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, actorCan, capabilitiesOf, type Capability } from './central-store-access';

const ALL: Capability[] = ['branch_waste.log', 'branch_waste.reverse_own', 'branch_waste.read', 'branch_waste.read_any_branch', 'branch_waste.reverse_any'];

const grid: Record<string, Capability[]> = {
  // Reads every branch; does not act in a branch.
  STORE_MANAGER: ['branch_waste.read_any_branch'],
  // Reads every branch and may reverse any entry (waste has no PIN, so there is nothing to sign); has no department, so cannot log.
  SYSTEM_ADMIN: ['branch_waste.read', 'branch_waste.read_any_branch', 'branch_waste.reverse_any'],
  ACCOUNTANT: ['branch_waste.read_any_branch'],
  DIRECTOR: ['branch_waste.read_any_branch'],
  // Reads the branch's waste with values and reverses any entry of it (own branch is a service rule).
  BRANCH_MANAGER_AS_MANAGER: ['branch_waste.read', 'branch_waste.reverse_any'],
  STORE_ATTENDANT: [],
  // Department heads and members hold nothing here: their rights are the department rule.
  WAITER: [],
  CHEF: [],
  BARISTA: [],
};

const roleOf = (key: string): string => (key === 'BRANCH_MANAGER_AS_MANAGER' ? 'MANAGER' : key);
const mine = (c: string): boolean => c.startsWith('branch_waste.');

describe('Branch waste capability grid', () => {
  it('declares exactly the five capabilities', () => {
    expect(CAPABILITIES.filter(mine).sort()).toEqual([...ALL].sort());
  });

  it.each(Object.entries(grid))('%s holds exactly its rows', (key, expected) => {
    expect(capabilitiesOf(roleOf(key)).filter(mine).sort()).toEqual([...expected].sort());
  });

  it('every desktop role reads branch waste, the four hub roles across branches and the Branch Manager their own', () => {
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR']) {
      expect(actorCan({ role } as never, 'branch_waste.read_any_branch'), role).toBe(true);
    }
    expect(actorCan({ role: 'MANAGER' } as never, 'branch_waste.read')).toBe(true);
    expect(actorCan({ role: 'MANAGER' } as never, 'branch_waste.read_any_branch')).toBe(false);
  });

  it('only the Branch Manager and the System Admin reverse any entry; nobody else', () => {
    for (const role of ['MANAGER', 'SYSTEM_ADMIN']) expect(actorCan({ role } as never, 'branch_waste.reverse_any'), role).toBe(true);
    for (const role of ['STORE_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'STORE_ATTENDANT', 'CHEF', 'WAITER', 'BARISTA']) {
      expect(actorCan({ role } as never, 'branch_waste.reverse_any'), role).toBe(false);
    }
  });

  it('logging and reversing your own entry is the department rule: no role holds those rows from the table', () => {
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_ATTENDANT', 'CHEF', 'WAITER', 'BARISTA']) {
      expect(actorCan({ role } as never, 'branch_waste.log'), `${role} log`).toBe(false);
      expect(actorCan({ role } as never, 'branch_waste.reverse_own'), `${role} reverse_own`).toBe(false);
    }
  });

  it('the front end mirror lists the same names', () => {
    const source = readFileSync(join(__dirname, '../../../../../frontend/features/inventory/_shared/lib/capabilities.ts'), 'utf8');
    const mirrored = [...source.matchAll(/'(branch_waste\.[a-z_]+)'/g)].map((m) => m[1]);
    expect(mirrored.sort()).toEqual([...ALL].sort());
  });
});
