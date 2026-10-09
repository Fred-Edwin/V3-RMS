/**
 * Dispatch, deliveries, carriers and discrepancies: role by capability (docs/features/inventory/dispatch-contract.md §3). One row
 * per role, so a change to the table in central-store-access.ts shows up here as one line. Department members hold none of these
 * from the table: counting a delivery is the department rule in the service, so `deliveries.count` belongs to no role here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, actorCan, capabilitiesOf, type Capability } from './central-store-access';

const ALL: Capability[] = [
  'dispatch.read',
  'dispatch.pack',
  'dispatch.cancel',
  'carriers.read',
  'carriers.manage',
  'deliveries.count',
  'deliveries.confirm_on_behalf',
  'discrepancies.read',
  'discrepancies.record',
  'discrepancies.reverse',
];
const READS: Capability[] = ['dispatch.read', 'carriers.read', 'discrepancies.read'];
const STORE_JOBS: Capability[] = ['dispatch.pack', 'dispatch.cancel', 'carriers.manage', 'discrepancies.record', 'discrepancies.reverse'];

const grid: Record<string, Capability[]> = {
  // The store's jobs: pack, cancel, keep carriers, record and reverse findings. Not counting for a department, not confirming for one.
  STORE_MANAGER: [...READS, ...STORE_JOBS],
  // Every action with their own PIN, except what belongs to a branch department or its Branch Manager.
  SYSTEM_ADMIN: [...READS, ...STORE_JOBS],
  // Read only: Director and Accountant are informed, they do not act (discrepancies.md).
  ACCOUNTANT: READS,
  DIRECTOR: READS,
  // Reads, and confirms for any department of the branch (the real signer recorded). Own branch is a service rule.
  BRANCH_MANAGER_AS_MANAGER: [...READS, 'deliveries.confirm_on_behalf'],
  // Packs, reviews and signs; reads their own packing history only (a service rule). No carriers.read (P4 hands them the active list), no discrepancies.
  STORE_ATTENDANT: ['dispatch.read', 'dispatch.pack'],
  // Department heads and members hold nothing here: their rights are the department rule.
  WAITER: [],
  CHEF: [],
  BARISTA: [],
};

const roleOf = (key: string): string => (key === 'BRANCH_MANAGER_AS_MANAGER' ? 'MANAGER' : key);
const mine = (c: string): boolean => /^(dispatch|carriers|deliveries|discrepancies)\./.test(c);

describe('Dispatch, deliveries and discrepancies capability grid', () => {
  it('declares exactly the ten capabilities', () => {
    expect(CAPABILITIES.filter(mine).sort()).toEqual([...ALL].sort());
  });

  it.each(Object.entries(grid))('%s holds exactly its rows', (key, expected) => {
    expect(capabilitiesOf(roleOf(key)).filter(mine).sort()).toEqual([...expected].sort());
  });

  it('every desktop role reads dispatches, carriers and discrepancies', () => {
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER']) {
      for (const cap of READS) expect(actorCan({ role } as never, cap), `${role} ${cap}`).toBe(true);
    }
  });

  it('the Store Attendant reads dispatches and packs, and holds no discrepancy or carrier row', () => {
    expect(actorCan({ role: 'STORE_ATTENDANT' } as never, 'dispatch.read')).toBe(true);
    expect(actorCan({ role: 'STORE_ATTENDANT' } as never, 'dispatch.pack')).toBe(true);
    for (const cap of ['dispatch.cancel', 'carriers.read', 'carriers.manage', 'discrepancies.read', 'discrepancies.record', 'discrepancies.reverse'] as Capability[]) {
      expect(actorCan({ role: 'STORE_ATTENDANT' } as never, cap), cap).toBe(false);
    }
  });

  it('only the Store Manager and the System Admin cancel, keep carriers, and record or reverse findings', () => {
    for (const cap of ['dispatch.cancel', 'carriers.manage', 'discrepancies.record', 'discrepancies.reverse'] as Capability[]) {
      for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN']) expect(actorCan({ role } as never, cap), `${role} ${cap}`).toBe(true);
      for (const role of ['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'STORE_ATTENDANT', 'CHEF', 'WAITER']) expect(actorCan({ role } as never, cap), `${role} ${cap}`).toBe(false);
    }
  });

  it('confirming a department\'s delivery for it is the Branch Manager alone: not the System Admin, Director or Store Manager', () => {
    expect(actorCan({ role: 'MANAGER' } as never, 'deliveries.confirm_on_behalf')).toBe(true);
    for (const role of ['SYSTEM_ADMIN', 'DIRECTOR', 'STORE_MANAGER', 'ACCOUNTANT', 'STORE_ATTENDANT', 'CHEF', 'WAITER']) {
      expect(actorCan({ role } as never, 'deliveries.confirm_on_behalf'), role).toBe(false);
    }
  });

  it('counting a delivery is the department rule: no role holds `deliveries.count` from the table', () => {
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_ATTENDANT', 'CHEF', 'WAITER', 'BARISTA']) {
      expect(actorCan({ role } as never, 'deliveries.count'), role).toBe(false);
    }
  });

  it('the front end mirror lists the same names', () => {
    const source = readFileSync(join(__dirname, '../../../../../frontend/features/inventory/_shared/lib/capabilities.ts'), 'utf8');
    const mirrored = [...source.matchAll(/'((?:dispatch|carriers|deliveries|discrepancies)\.[a-z_]+)'/g)].map((m) => m[1]);
    expect(mirrored.sort()).toEqual([...ALL].sort());
  });
});
