/**
 * Requisitions and Departments: role by capability (docs/features/inventory/requisitions-contract.md §3). One row per role,
 * so a change to the table in central-store-access.ts shows up here as one line. Read for every desktop role, write by job;
 * heads and members hold none of these (their rights are the department rule in the service).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, actorCan, capabilitiesOf, type Capability } from './central-store-access';

const ALL: Capability[] = [
  'requisitions.read',
  'requisitions.see_value',
  'requisitions.start',
  'requisitions.change_quantity',
  'requisitions.approve',
  'requisitions.cancel',
  'requisitions.nudge',
  'requisitions.set_urgent',
  'requisitions.edit_on_behalf',
  'requisitions.send_on_behalf',
  'departments.read',
  'departments.write',
];
const READS: Capability[] = ['requisitions.read', 'requisitions.see_value', 'departments.read'];
const ON_BEHALF: Capability[] = ['requisitions.edit_on_behalf', 'requisitions.send_on_behalf'];
const BRANCH_JOBS: Capability[] = ALL.filter((c) => !READS.includes(c) && !ON_BEHALF.includes(c));

const grid: Record<string, Capability[]> = {
  // The Store Manager reads everything here; the branch's jobs are not theirs.
  STORE_MANAGER: READS,
  // Everything except "on behalf", which is the Branch Manager's alone.
  SYSTEM_ADMIN: ALL.filter((c) => !ON_BEHALF.includes(c)),
  ACCOUNTANT: READS,
  // The Director reads everything and may approve any requisition or addition; no other write.
  DIRECTOR: [...READS, 'requisitions.approve'],
  BRANCH_MANAGER_AS_MANAGER: ALL,
  // Reads every requisition to pack it: no money (no see_value) and no Departments screen.
  STORE_ATTENDANT: ['requisitions.read'],
  WAITER: [],
  CHEF: [],
  BARISTA: [],
};

const roleOf = (key: string): string => (key === 'BRANCH_MANAGER_AS_MANAGER' ? 'MANAGER' : key);
const mine = (c: string): boolean => /^(requisitions|departments)\./.test(c);

describe('Requisitions and Departments capability grid', () => {
  it('declares exactly the twelve capabilities', () => {
    expect(CAPABILITIES.filter(mine).sort()).toEqual([...ALL].sort());
  });

  it.each(Object.entries(grid))('%s holds exactly its rows', (key, expected) => {
    expect(capabilitiesOf(roleOf(key)).filter(mine).sort()).toEqual([...expected].sort());
  });

  it('every desktop role reads requisitions with money and the departments', () => {
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER']) {
      for (const cap of READS) expect(actorCan({ role } as never, cap), `${role} ${cap}`).toBe(true);
    }
  });

  it('the Store Attendant sees no money', () => {
    expect(actorCan({ role: 'STORE_ATTENDANT' } as never, 'requisitions.see_value')).toBe(false);
  });

  it('only the Branch Manager and the System Admin run the branch jobs; the Director only approves', () => {
    for (const cap of BRANCH_JOBS) {
      expect(actorCan({ role: 'MANAGER' } as never, cap), `MANAGER ${cap}`).toBe(true);
      expect(actorCan({ role: 'SYSTEM_ADMIN' } as never, cap), `SYSTEM_ADMIN ${cap}`).toBe(true);
      expect(actorCan({ role: 'STORE_MANAGER' } as never, cap), `STORE_MANAGER ${cap}`).toBe(false);
      expect(actorCan({ role: 'ACCOUNTANT' } as never, cap), `ACCOUNTANT ${cap}`).toBe(false);
      expect(actorCan({ role: 'DIRECTOR' } as never, cap), `DIRECTOR ${cap}`).toBe(cap === 'requisitions.approve');
    }
  });

  it('"on behalf" (Amendment 2) is the Branch Manager alone: not the System Admin, not the Director (who approves)', () => {
    for (const cap of ON_BEHALF) {
      expect(actorCan({ role: 'MANAGER' } as never, cap), `MANAGER ${cap}`).toBe(true);
      for (const role of ['SYSTEM_ADMIN', 'DIRECTOR', 'STORE_MANAGER', 'ACCOUNTANT', 'STORE_ATTENDANT', 'CHEF', 'WAITER']) {
        expect(actorCan({ role } as never, cap), `${role} ${cap}`).toBe(false);
      }
    }
  });

  it('the front end mirror lists the same names', () => {
    const source = readFileSync(join(__dirname, '../../../../../frontend/features/inventory/_shared/lib/capabilities.ts'), 'utf8');
    const mirrored = [...source.matchAll(/'((?:requisitions|departments)\.[a-z_]+)'/g)].map((m) => m[1]);
    expect(mirrored.sort()).toEqual([...ALL].sort());
  });
});
