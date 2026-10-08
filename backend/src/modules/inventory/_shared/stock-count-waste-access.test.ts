/**
 * Stock, Counting and Waste: role by capability (docs/features/inventory/stock-count-waste-contract.md §3). One row per
 * role, so a change to the table in central-store-access.ts shows up here as one line. Read for every desktop role,
 * write by job; the Store Attendant is blind to stock figures.
 */
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, actorCan, capabilitiesOf, type Capability } from './central-store-access';

const READS: Capability[] = ['stock.read', 'counts.read', 'waste.read'];

const ALL_ELEVEN: Capability[] = [
  'stock.read',
  'counts.read',
  'counts.record',
  'counts.resolve',
  'counts.setup',
  'counts.acknowledge',
  'counts.set_director_alert',
  'waste.read',
  'waste.log',
  'waste.reverse_own',
  'waste.reverse_any',
];

const grid: Record<string, Capability[]> = {
  // The Store Manager does the jobs, but "Mark seen" and the alert amount are the Director's.
  STORE_MANAGER: ALL_ELEVEN.filter((c) => c !== 'counts.acknowledge' && c !== 'counts.set_director_alert'),
  SYSTEM_ADMIN: ALL_ELEVEN,
  ACCOUNTANT: READS,
  BRANCH_MANAGER_AS_MANAGER: READS,
  DIRECTOR: [...READS, 'counts.acknowledge', 'counts.set_director_alert'],
  STORE_ATTENDANT: ['counts.record', 'waste.read', 'waste.log', 'waste.reverse_own'],
  WAITER: [],
  CHEF: [],
  BARISTA: [],
};

const roleOf = (key: string): string => (key === 'BRANCH_MANAGER_AS_MANAGER' ? 'MANAGER' : key);
const mine = (c: string): boolean => /^(stock|counts|waste)\./.test(c);

describe('Stock, Counting and Waste capability grid', () => {
  it('declares exactly the eleven capabilities', () => {
    expect(CAPABILITIES.filter(mine).sort()).toEqual([...ALL_ELEVEN].sort());
  });

  it.each(Object.entries(grid))('%s holds exactly its rows', (key, expected) => {
    const held = capabilitiesOf(roleOf(key)).filter(mine);
    expect(held.sort()).toEqual([...expected].sort());
  });

  it('every desktop role reads every Stock, Counting and Waste screen', () => {
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER']) {
      for (const cap of READS) expect(actorCan({ role } as never, cap), `${role} ${cap}`).toBe(true);
    }
  });

  it('the Accountant and the Branch Manager write nothing here', () => {
    for (const role of ['ACCOUNTANT', 'MANAGER']) {
      for (const cap of ALL_ELEVEN.filter((c) => !READS.includes(c))) expect(actorCan({ role } as never, cap), `${role} ${cap}`).toBe(false);
    }
  });

  it('the Director writes only "Mark seen" and the alert amount', () => {
    const writes = ALL_ELEVEN.filter((c) => !READS.includes(c)).filter((c) => actorCan({ role: 'DIRECTOR' } as never, c));
    expect(writes.sort()).toEqual(['counts.acknowledge', 'counts.set_director_alert']);
  });

  it('only the Director and the System Admin acknowledge or set the alert amount', () => {
    for (const cap of ['counts.acknowledge', 'counts.set_director_alert'] as const) {
      const holders = Object.keys(grid).map(roleOf).filter((role) => actorCan({ role } as never, cap));
      expect([...new Set(holders)].sort()).toEqual(['DIRECTOR', 'SYSTEM_ADMIN']);
    }
  });

  it('only the Store Manager and the System Admin resolve, approve, set up and reverse any waste', () => {
    for (const cap of ['counts.resolve', 'counts.setup', 'waste.reverse_any'] as const) {
      const holders = Object.keys(grid).map(roleOf).filter((role) => actorCan({ role } as never, cap));
      expect([...new Set(holders)].sort()).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN']);
    }
  });

  it('the Attendant counts and logs waste but never reads stock or other people’s counts', () => {
    const attendant = { role: 'STORE_ATTENDANT' } as never;
    expect(actorCan(attendant, 'counts.record')).toBe(true);
    expect(actorCan(attendant, 'waste.log')).toBe(true);
    expect(actorCan(attendant, 'stock.read')).toBe(false);
    expect(actorCan(attendant, 'counts.read')).toBe(false);
    expect(actorCan(attendant, 'counts.resolve')).toBe(false);
    expect(actorCan(attendant, 'waste.reverse_any')).toBe(false);
  });
});
